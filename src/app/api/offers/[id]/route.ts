import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { nextOrderNo } from "@/lib/ids";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { offerPatchSchema } from "@/lib/schemas";
import { OFFER_MANUAL_TRANSITIONS } from "@/lib/state";
import { Role } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "offers:respond", key: user.id, ...Rate.action });

    const body = offerPatchSchema.parse(await readBody(req));
    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { lot: { include: { crop: true, farmer: true } }, buyer: true },
    });
    if (!offer) throw { status: 404, message: "Offer not found" };

    const isOwner = offer.lot.farmerId === user.id && (user.role === Role.FARMER || user.role === Role.FPO);
    const isBidder = offer.buyerId === user.id && user.role === Role.BUYER;
    if (!isOwner && !isBidder) {
      throw { status: 403, message: "You are not a party to this offer" };
    }

    // Buyers may only counter or withdraw their own offer; accepting or
    // rejecting is the lot owner's decision.
    if (isBidder && !isOwner && body.action === "accept") {
      throw { status: 403, message: "Only the lot owner can accept offers" };
    }

    const history = (offer.history as unknown as { status: string; at: Date; by: string; note?: string }[]) ?? [];
    const stamp = { at: new Date(), by: user.name };
    // A buyer rejecting their own offer = withdrawing it (SUBMITTED only).
    const buyerWithdraw = isBidder && !isOwner && body.action === "reject";
    const allowedFrom = buyerWithdraw
      ? (["SUBMITTED"] as const)
      : OFFER_MANUAL_TRANSITIONS[body.action];
    const openStatus = (allowedFrom as readonly string[]).includes(offer.status);

    // Lazy expiry: an open offer past its expiresAt is closed before any
    // response is applied.
    if (openStatus && offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
      await prisma.offer.updateMany({
        where: { id: offer.id, status: { in: [...allowedFrom] } },
        data: { status: "EXPIRED", history: [...history, { status: "EXPIRED", ...stamp, note: "Offer expired" }] },
      });
      throw { status: 400, message: "This offer expired and can no longer be responded to" };
    }

    if (body.action === "counter") {
      if (!body.pricePerKg) throw { status: 400, message: "Counter offer price is required" };
      if (isBidder && !isOwner && body.pricePerKg >= offer.pricePerKg) {
        // Buyers cannot raise their own price silently; only counter lower.
        throw { status: 400, message: "A buyer counter must be below the current offer price" };
      }
    }

    // Owner may accept/reject/counter, bidder counters — all conditional on
    // the offer still being open (guards races + expiry at write time).
    const respond = await prisma.$transaction(async (tx) => {
      const target =
        body.action === "accept"
          ? "ACCEPTED"
          : body.action === "reject"
            ? buyerWithdraw
              ? "WITHDRAWN"
              : "REJECTED"
            : "COUNTERED";
      const price = body.action === "counter" ? body.pricePerKg! : undefined;

      const claim = await tx.offer.updateMany({
        where: { id: offer.id, status: { in: [...allowedFrom] } },
        data: {
          ...(target === "COUNTERED" ? { status: "COUNTERED", pricePerKg: price } : { status: target }),
          history: [
            ...history,
            {
              status: target,
              ...stamp,
              ...(price ? { note: `Countered to ₹${price}/kg` } : body.message ? { note: body.message } : {}),
            },
          ],
        },
      });
      if (claim.count === 0) {
        const current = await tx.offer.findUnique({ where: { id: offer.id }, select: { status: true } });
        if (current?.status === "ACCEPTED") throw { status: 409, message: "Offer already accepted" };
        throw { status: 409, message: `Offer is no longer open (${current?.status ?? "changed"})` };
      }
      return price;
    });

    if (body.action === "reject") {
      if (buyerWithdraw) {
        await notify({ userId: offer.lot.farmerId, type: "OFFER", title: "Offer withdrawn", body: `${user.name} withdrew offer ${offer.offerNo} for lot ${offer.lot.lotNo}.`, link: `/lots/${offer.lot.lotNo}` });
        await logAudit(user.id, "OFFER_WITHDRAWN", "Offer", offer.id, { offerNo: offer.offerNo });
        return ok({ status: "WITHDRAWN" });
      }
      await notify({ userId: offer.buyerId, type: "OFFER", title: "Offer rejected", body: `Your offer ${offer.offerNo} for lot ${offer.lot.lotNo} was rejected.`, link: `/lots/${offer.lot.lotNo}` });
      await logAudit(user.id, "OFFER_REJECTED", "Offer", offer.id, { offerNo: offer.offerNo });
      return ok({ status: "REJECTED" });
    }

    if (body.action === "counter") {
      const price = respond!;
      await prisma.lot.updateMany({
        where: { id: offer.lotId, status: { in: ["LISTED", "OFFER_RECEIVED", "NEGOTIATING"] } },
        data: { status: "NEGOTIATING" },
      });
      await notify({ userId: isOwner ? offer.buyerId : offer.lot.farmerId, type: "OFFER", title: "Counter offer", body: `${user.name} countered ${offer.offerNo} at ₹${price}/kg.`, link: `/lots/${offer.lot.lotNo}` });
      await logAudit(user.id, "OFFER_COUNTERED", "Offer", offer.id, { offerNo: offer.offerNo, price });
      return ok({ status: "COUNTERED", pricePerKg: price });
    }

    // accept → create the order atomically (unique offerId blocks duplicates)
    try {
      const orderNo = await nextOrderNo();
      await prisma.$transaction(async (tx) => {
        const lotClaim = await tx.lot.updateMany({
          where: { id: offer.lotId, status: { in: ["LISTED", "OFFER_RECEIVED", "NEGOTIATING"] } },
          data: { status: "BOOKED" },
        });
        if (lotClaim.count === 0) throw { status: 409, message: "Lot is no longer available" };
        const total = offer.quantityKg * offer.pricePerKg;
        await tx.order.create({
          data: {
            orderNo,
            lotId: offer.lotId,
            offerId: offer.id,
            sellerId: offer.lot.farmerId,
            buyerId: offer.buyerId,
            cropName: offer.lot.crop.name,
            quantityKg: offer.quantityKg,
            pricePerKg: offer.pricePerKg,
            totalAmount: total,
            status: "ACCEPTED",
            pickupAddress: offer.lot.location,
            deliveryAddress: "Bengaluru",
            timeline: [{ status: "ACCEPTED", at: new Date(), note: `Offer ${offer.offerNo} accepted` }],
          },
        });
      });
      await notify({
        userId: offer.buyerId,
        type: "ORDER",
        title: "Offer accepted — order created",
        body: `${user.name} accepted your offer ${offer.offerNo} for ${offer.quantityKg} kg @ ₹${offer.pricePerKg}/kg (order ${orderNo}).`,
        link: "/orders",
      });
      await logAudit(user.id, "OFFER_ACCEPTED", "Offer", offer.id, { offerNo: offer.offerNo, orderNo });
      return ok({ status: "ACCEPTED", orderNo, total: offer.quantityKg * offer.pricePerKg });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        throw { status: 409, message: "Offer already accepted — an order already exists" };
      }
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}

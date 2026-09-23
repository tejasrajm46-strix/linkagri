import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { nextOfferNo } from "@/lib/ids";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { offerCreateSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";

export async function POST(req: Request, { params }: { params: Promise<{ lotNo: string }> }) {
  const { lotNo } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.BUYER]);
    if (!user.verified) {
      throw { status: 403, message: "Your buyer account must be verified before you can send offers" };
    }
    rateLimit({ scope: "offers:create", key: user.id, ...Rate.action });

    const body = offerCreateSchema.parse(await readBody(req));
    const lot = await prisma.lot.findUnique({
      where: { lotNo: lotNo.toUpperCase() },
      include: { crop: true, farmer: true },
    });
    if (!lot) throw { status: 404, message: "Lot not found" };
    if (lot.farmerId === user.id) {
      throw { status: 400, message: "You cannot make an offer on your own lot" };
    }

    const qty = body.quantityKg ?? lot.quantityKg;
    if (qty > lot.quantityKg) {
      throw { status: 400, message: `Only ${lot.quantityKg} kg available in this lot` };
    }

    const offerNo = await nextOfferNo();
    // Transactional guard: the lot must still be open for offers when the
    // record lands — prevents racing a withdraw/sale between check and write.
    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.create({
        data: {
          offerNo,
          lotId: lot.id,
          buyerId: user.id,
          quantityKg: qty,
          pricePerKg: body.pricePerKg,
          message: body.message ?? null,
          expiresAt: new Date(Date.now() + 48 * 3600000),
          history: [{ status: "SUBMITTED", at: new Date(), by: user.name }],
        },
      });
      const bumped = await tx.lot.updateMany({
        where: { id: lot.id, status: { in: ["LISTED", "OFFER_RECEIVED", "NEGOTIATING"] } },
        data: { status: "OFFER_RECEIVED" },
      });
      if (bumped.count === 0) {
        throw { status: 409, message: `This lot is ${lot.status.toLowerCase()} and not open for offers` };
      }
      return offer;
    });

    await notify({
      userId: lot.farmerId,
      type: "OFFER",
      title: "New offer received",
      body: `${user.name} offered ₹${body.pricePerKg}/kg for your lot ${lot.lotNo} (${qty} kg).`,
      link: `/lots/${lot.lotNo}`,
    });
    await logAudit(user.id, "OFFER_SENT", "Offer", result.id, { offerNo, lotNo: lot.lotNo });
    return ok({ offer: result, lotNo: lot.lotNo }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

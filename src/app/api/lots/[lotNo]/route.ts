import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { lotPatchSchema } from "@/lib/schemas";
import { LOT_MANUAL_TRANSITIONS, isOpenOffer } from "@/lib/state";
import { Role } from "@prisma/client";

async function loadLot(lotNo: string) {
  return prisma.lot.findUnique({
    where: { lotNo: lotNo.toUpperCase() },
    include: {
      crop: true,
      farmer: { include: { farmerProfile: true } },
      fpo: true,
      qualityReports: true,
      offers: {
        include: { buyer: { select: { id: true, name: true, buyerProfile: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ lotNo: string }> }) {
  const { lotNo } = await params;
  try {
    const user = await requireSession();
    const lot = await loadLot(lotNo);
    if (!lot) throw { status: 404, message: "Lot not found" };

    const isAdmin = user.role === Role.ADMIN;
    const isOwner = lot.farmerId === user.id;
    const isFpoMember = !isOwner && lot.fpoId !== null && (await prisma.fpoMember.findFirst({ where: { fpoId: lot.fpoId, userId: user.id } })) !== null;
    const buyerOpen = user.role === Role.BUYER && (lot.status === "LISTED" || lot.offers.some((o) => o.buyerId === user.id && isOpenOffer(o.status)));

    if (!isAdmin && !isOwner && !isFpoMember && !buyerOpen) {
      throw { status: 404, message: "Lot not found" };
    }

    // A non-owner viewer only ever sees their own offers, never the full
    // bidding history (farmers/admin keep full visibility).
    if (!isAdmin && !isOwner && !isFpoMember) {
      lot.offers = lot.offers.filter((o) => o.buyerId === user.id);
    }
    return ok({ lot });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ lotNo: string }> }) {
  const { lotNo } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO, Role.ADMIN]);
    rateLimit({ scope: "lots:patch", key: user.id, ...Rate.action });

    const body = lotPatchSchema.parse(await readBody(req));
    const lot = await prisma.lot.findUnique({ where: { lotNo: lotNo.toUpperCase() } });
    if (!lot) throw { status: 404, message: "Lot not found" };
    if (lot.farmerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "Only the lot owner can update this lot" };
    }

    const data: Record<string, unknown> = {};
    if (body.qualityScore !== undefined) {
      data.qualityScore = body.qualityScore;
    }

    const target = body.withdraw ? "WITHDRAWN" : body.status;
    if (target) {
      const allowedFrom = LOT_MANUAL_TRANSITIONS[target];
      if (!allowedFrom || !allowedFrom.includes(lot.status)) {
        throw {
          status: 400,
          message: `Cannot change lot from ${lot.status} to ${target}`,
        };
      }
      data.status = target;
    }
    if (Object.keys(data).length === 0) {
      throw { status: 400, message: "Nothing to update" };
    }

    // Conditional update: status must still be the state we checked.
    const updated = await prisma.lot.updateMany({
      where: { id: lot.id, ...(data.status ? { status: lot.status } : {}) },
      data,
    });
    if (updated.count === 0) {
      throw { status: 409, message: "This lot changed state — refresh and try again" };
    }
    if (data.status) {
      await logAudit(user.id, `LOT_${data.status}`, "Lot", lot.id, { lotNo: lot.lotNo, by: user.role });
    }
    if (data.qualityScore) {
      await logAudit(user.id, "LOT_QUALITY_UPDATED", "Lot", lot.id, { qualityScore: data.qualityScore });
    }
    const fresh = await prisma.lot.findUnique({ where: { id: lot.id } });
    return ok({ lot: fresh });
  } catch (e) {
    return fail(e);
  }
}

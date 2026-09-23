import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail } from "@/lib/apiHelpers";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  try {
    assertSameOrigin(req);
    const admin = await requireSession([Role.ADMIN]);
    rateLimit({ scope: "admin:stats", key: admin.id, ...Rate.admin });
    const [
      farmers,
      fpos,
      buyers,
      transporters,
      lots,
      activeLots,
      demands,
      orders,
      disputes,
      openDisputes,
      pendingPayments,
      verificationQueue,
      priceRows,
      highValue,
      suspicious,
      totalPaid,
      totalPending,
    ] = await Promise.all([
      prisma.user.count({ where: { role: Role.FARMER } }),
      prisma.user.count({ where: { role: Role.FPO } }),
      prisma.user.count({ where: { role: Role.BUYER } }),
      prisma.user.count({ where: { role: Role.TRANSPORTER } }),
      prisma.lot.count(),
      prisma.lot.count({ where: { status: { in: ["LISTED", "OFFER_RECEIVED", "NEGOTIATING"] } } }),
      prisma.buyerDemand.count({ where: { status: "ACTIVE" } }),
      prisma.order.count(),
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "EVIDENCE_REQUESTED", "ESCALATED"] } } }),
      prisma.payment.count({ where: { status: { in: ["PENDING", "OVERDUE"] } } }),
      prisma.user.findMany({ where: { verified: false }, select: { id: true, name: true, email: true, role: true, createdAt: true }, take: 20 }),
      prisma.marketPrice.findMany({ select: { marketId: true, fetchedAt: true, source: true }, distinct: ["marketId"], orderBy: { fetchedAt: "desc" } }),
      prisma.order.findMany({ where: { totalAmount: { gte: 30000 } }, orderBy: { totalAmount: "desc" }, take: 10, select: { orderNo: true, totalAmount: true, status: true, cropName: true, createdAt: true } }),
      prisma.payment.findMany({ where: { status: { in: ["FAILED", "DISPUTED"] } }, take: 10, select: { id: true, amount: true, status: true, reference: true } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: { in: ["PENDING", "OVERDUE"] } } }),
    ]);

    const markets = await prisma.market.findMany({ select: { name: true } });
    const freshness = priceRows.map((p) => ({ marketId: p.marketId, fetchedAt: p.fetchedAt, source: p.source }));

    return ok({
      stats: {
        farmers,
        fpos,
        buyers,
        transporters,
        lots,
        activeLots,
        demands,
        orders,
        disputes,
        openDisputes,
        pendingPayments,
        totalPaid: totalPaid._sum.amount ?? 0,
        totalPending: totalPending._sum.amount ?? 0,
      },
      verificationQueue,
      freshness: { markets: markets.length, rows: freshness },
      highValue,
      suspicious,
    });
  } catch (e) {
    return fail(e);
  }
}
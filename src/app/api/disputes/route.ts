import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { nextDisputeNo } from "@/lib/ids";
import { readBody, ok, fail } from "@/lib/apiHelpers";
import { disputeCreateSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { Role } from "@prisma/client";

const include = {
  raisedBy: { select: { name: true, role: true } },
  order: { select: { orderNo: true, totalAmount: true } },
  lot: { select: { lotNo: true } },
} as const;

export async function GET() {
  try {
    const user = await requireSession();
    const disputes =
      user.role === Role.ADMIN
        ? await prisma.dispute.findMany({ include, orderBy: { createdAt: "desc" } })
        : await prisma.dispute.findMany({ where: { raisedById: user.id }, include, orderBy: { createdAt: "desc" } });
    return ok({ disputes });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "disputes:create", key: user.id, ...Rate.action });

    const body = disputeCreateSchema.parse(await readBody(req));

    let orderId: string | null = null;
    if (body.orderId) {
      const order = await prisma.order.findUnique({ where: { id: body.orderId }, select: { id: true, sellerId: true, buyerId: true } });
      if (!order) throw { status: 404, message: "Order not found" };
      if (order.sellerId !== user.id && order.buyerId !== user.id && user.role !== Role.ADMIN) {
        throw { status: 403, message: "You are not a party to this order" };
      }
      orderId = order.id;
    }

    const dispute = await prisma.dispute.create({
      data: {
        disputeNo: await nextDisputeNo(),
        raisedById: user.id,
        orderId,
        type: body.type,
        description: body.description,
        evidence: body.evidence ?? [],
        status: "OPEN",
      },
    });
    await logAudit(user.id, "DISPUTE_RAISED", "Dispute", dispute.id, { disputeNo: dispute.disputeNo });
    return ok({ dispute }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

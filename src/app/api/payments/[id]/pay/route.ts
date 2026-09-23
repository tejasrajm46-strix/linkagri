import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { paySchema } from "@/lib/schemas";
import { Role } from "@prisma/client";

/**
 * DEMO LEDGER SETTLEMENT — clearly isolated from real gateway payments.
 *
 * This endpoint exists so the SIH demo can show a payment completing without
 * external services. It is NOT a payment gateway:
 *   - the payment is only marked PAID after a server-side conditional update
 *     (idempotent — a payment can be settled at most once);
 *   - only the payer (or an admin, audited) may settle;
 *   - a client can never set the amount, status, or order it refers to.
 *
 * When a real provider is configured (PAYMENT_PROVIDER=razorpay|cashfree…)
 * this endpoint refuses to act: payments must then be created/verified
 * server-side from gateway webhooks with signature checks (see README).
 */
const gatewayConfigured = Boolean(process.env.PAYMENT_PROVIDER);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.BUYER, Role.ADMIN]);
    rateLimit({ scope: "payments:settle", key: user.id, ...Rate.payment });

    if (gatewayConfigured) {
      throw { status: 400, message: "Payments are processed by the gateway on this deployment" };
    }

    const body = paySchema.parse(await readBody(req));
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { order: { include: { seller: { select: { id: true } } } } },
    });
    if (!payment) throw { status: 404, message: "Payment record not found" };
    if (payment.payerId && payment.payerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "Only the payer can settle this payment" };
    }
    if (payment.amount <= 0) throw { status: 400, message: "Invalid payment amount" };
    if (payment.order.status === "CLOSED" || payment.order.status === "PAID") {
      throw { status: 409, message: "This order is already fully settled" };
    }

    const reference = body.reference ?? `UPI-${Math.floor(10000 + Math.random() * 89999)}`;
    if (reference.length > 120) throw { status: 400, message: "Reference too long" };

    const settled = await prisma.$transaction(async (tx) => {
      // Idempotent claim: at most one concurrent request can settle.
      const claim = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
        data: { status: "PAID", paidAt: new Date(), reference },
      });
      if (claim.count === 0) {
        const current = await tx.payment.findUnique({ where: { id: payment.id }, select: { status: true } });
        throw {
          status: 409,
          message: current?.status === "PAID" ? "Payment already completed" : "Payment is no longer payable",
        };
      }

      const paidRows = await tx.payment.findMany({
        where: { orderId: payment.orderId, status: "PAID" },
        select: { amount: true },
      });
      const paidSum = paidRows.reduce((s, p) => s + p.amount, 0);
      const timeline = (payment.order.timeline as unknown as { status: string; at: Date; note?: string }[]) ?? [];
      const fullyPaid = paidSum >= payment.order.totalAmount - 1e-9;
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paidAmount: fullyPaid ? payment.order.totalAmount : paidSum,
          status: fullyPaid ? "PAID" : "PAYMENT_PENDING",
          timeline: [
            ...timeline,
            { status: fullyPaid ? "PAID" : "PAYMENT_PENDING", at: new Date(), note: `Payment ${reference} (${payment.kind})` },
          ],
        },
      });
      return { paidSum, fullyPaid };
    });

    await notify({
      userId: payment.order.sellerId,
      type: "PAYMENT",
      title: "Payment received",
      body: `₹${payment.amount.toLocaleString("en-IN")} received for order ${payment.order.orderNo} (ref ${reference}).`,
      link: "/payments",
    });
    await logAudit(user.id, "PAYMENT_MARKED_PAID", "Payment", payment.id, {
      orderNo: payment.order.orderNo,
      amount: payment.amount,
      reference,
      mode: "demo-ledger",
    });
    return ok({ payment: { ...payment, status: "PAID", paidAt: new Date().toISOString(), reference }, orderPaid: settled.fullyPaid });
  } catch (e) {
    return fail(e);
  }
}

import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { logisticsPatchSchema } from "@/lib/schemas";
import { LOGISTICS_TRANSITIONS, ORDER_STATUS_AFTER_LOGISTICS } from "@/lib/state";
import { Role } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.TRANSPORTER, Role.ADMIN]);
    rateLimit({ scope: "logistics:update", key: user.id, ...Rate.action });

    const body = logisticsPatchSchema.parse(await readBody(req));
    const logistics = await prisma.logistics.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!logistics) throw { status: 404, message: "Logistics record not found" };
    if (logistics.status === "CANCELLED" || logistics.status === "DELIVERED") {
      throw { status: 400, message: `This job is already ${logistics.status.toLowerCase()}` };
    }

    // ── Accept / claim the job ────────────────────────────────────────────
    if (body.action === "accept") {
      if (logistics.transporterId && logistics.transporterId !== user.id) {
        throw { status: 409, message: "This job is already assigned to another transporter" };
      }
      if (!user.verified && user.role !== Role.ADMIN) {
        throw { status: 403, message: "Your transporter account must be verified to accept jobs" };
      }
      // Conditional claim: only one transporter can win a concurrent race.
      const claimed = await prisma.logistics.updateMany({
        where: { id: logistics.id, transporterId: null },
        data: { transporterId: user.id, status: "PICKUP_SCHEDULED", driverName: user.name },
      });
      if (claimed.count === 0) {
        throw { status: 409, message: "This job was just claimed by another transporter" };
      }
      const timeline = (logistics.order.timeline as unknown as object[]) ?? [];
      await prisma.order.update({
        where: { id: logistics.orderId },
        data: {
          status: "PICKUP_SCHEDULED",
          timeline: [...timeline, { status: "PICKUP_SCHEDULED", at: new Date(), note: `${user.name} assigned as transporter` }],
        },
      });
      await notify({ userId: logistics.order.sellerId, type: "LOGISTICS", title: "Transporter assigned", body: `${user.name} will pick up order ${logistics.order.orderNo}.`, link: "/orders" });
      await notify({ userId: logistics.order.buyerId, type: "LOGISTICS", title: "Pickup scheduled", body: `Transporter ${user.name} assigned for order ${logistics.order.orderNo}.`, link: "/orders" });
      await logAudit(user.id, "LOGISTICS_ACCEPTED", "Logistics", logistics.id, { orderNo: logistics.order.orderNo });
      const fresh = await prisma.logistics.findUnique({ where: { id: logistics.id } });
      return ok({ logistics: fresh });
    }

    // ── Status updates (PICKED_UP → IN_TRANSIT → DELIVERED) ──────────────
    if (!body.status) throw { status: 400, message: "status is required" };
    if (!logistics.transporterId && user.role !== Role.ADMIN) {
      throw { status: 400, message: "Accept this job first before updating its status" };
    }
    if (logistics.transporterId && logistics.transporterId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "This job belongs to another transporter" };
    }
    const status = body.status; // narrowed: validated + present
    const next = LOGISTICS_TRANSITIONS[logistics.status] ?? [];
    if (!next.includes(status)) {
      throw {
        status: 400,
        message: `Cannot move logistics from ${logistics.status} to ${status}`,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.logistics.update({
        where: { id: logistics.id },
        data: {
          status: status as never,
          transporterId: user.id,
          damageInfo: body.note ?? logistics.damageInfo,
        },
      });
      const orderStatus = ORDER_STATUS_AFTER_LOGISTICS[status] ?? logistics.order.status;
      const timeline = (logistics.order.timeline as unknown as { status: string; at: Date; note?: string }[]) ?? [];
      await tx.order.update({
        where: { id: logistics.orderId },
        data: {
          status: orderStatus as never,
          timeline: [...timeline, { status: orderStatus, at: new Date(), note: body.note ?? `${status.replaceAll("_", " ")} — transporter update` }],
        },
      });
      if (status === "DELIVERED") {
        const remaining = logistics.order.totalAmount - logistics.order.paidAmount;
        const existing = await tx.payment.findFirst({ where: { orderId: logistics.orderId, status: "PENDING" } });
        if (!existing && remaining > 0) {
          await tx.payment.create({
            data: {
              orderId: logistics.orderId,
              kind: "FINAL",
              amount: remaining,
              status: "PENDING",
              payerId: logistics.order.buyerId,
              payeeId: logistics.order.sellerId,
              dueDate: new Date(Date.now() + 2 * 86400000),
            },
          });
        }
      }
      return { updated, orderStatus };
    });

    await notify({ userId: logistics.order.sellerId, type: "LOGISTICS", title: `Delivery ${status.toLowerCase().replaceAll("_", " ")}`, body: `Order ${logistics.order.orderNo}: ${body.note ?? status.replaceAll("_", " ")}.`, link: "/orders" });
    await notify({ userId: logistics.order.buyerId, type: "LOGISTICS", title: `Order ${status.toLowerCase().replaceAll("_", " ")}`, body: `Order ${logistics.order.orderNo} is now ${status.replaceAll("_", " ").toLowerCase()}.`, link: "/orders" });
    await logAudit(user.id, "LOGISTICS_UPDATE", "Logistics", logistics.id, { orderNo: logistics.order.orderNo, status });
    return ok({ logistics: result.updated, orderStatus: result.orderStatus });
  } catch (e) {
    return fail(e);
  }
}

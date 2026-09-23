import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { pickupSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";

export async function POST(req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "orders:pickup", key: user.id, ...Rate.action });

    const body = pickupSchema.parse(await readBody(req));
    const order = await prisma.order.findUnique({
      where: { orderNo: orderNo.toUpperCase() },
      include: { logistics: true },
    });
    if (!order) throw { status: 404, message: "Order not found" };
    if (order.sellerId !== user.id && order.buyerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "You are not a party to this order" };
    }

    // State machine: transport can only be arranged for orders that are
    // accepted (or awaiting a transporter after a previous request).
    const logistics = order.logistics[0];
    const pendingJob = logistics && logistics.status === "PENDING" && !logistics.transporterId;
    if (order.status !== "ACCEPTED" && !(order.status === "PICKUP_SCHEDULED" && pendingJob)) {
      throw {
        status: 400,
        message:
          order.status === "PICKUP_SCHEDULED"
            ? "A transporter is already assigned to this order"
            : `Transport can only be requested for accepted orders (current: ${order.status})`,
      };
    }

    const pickupTime = body.pickupTime ? new Date(body.pickupTime) : null;
    if (pickupTime && Number.isNaN(pickupTime.getTime())) {
      throw { status: 400, message: "Invalid pickup time" };
    }

    let created = false;
    let logisticsRow = logistics;
    if (!logisticsRow) {
      logisticsRow = await prisma.logistics.create({
        data: {
          orderId: order.id,
          status: "PENDING",
          pickupLocation: order.pickupAddress || "Farm",
          deliveryLocation: order.deliveryAddress || "Bengaluru",
          pickupTime,
        },
      });
      created = true;
    } else if (pendingJob && body.pickupTime) {
      logisticsRow = await prisma.logistics.update({
        where: { id: logisticsRow.id },
        data: { pickupTime },
      });
    }

    const transporters = await prisma.user.findMany({ where: { role: Role.TRANSPORTER, verified: true } });
    for (const t of transporters) {
      await notify({
        userId: t.id,
        type: "LOGISTICS",
        title: "New pickup job",
        body: `Order ${order.orderNo}: ${order.quantityKg} kg ${order.cropName} from ${order.pickupAddress ?? "farm"}. Accept to claim.`,
        link: "/orders",
      });
    }
    const timeline = (order.timeline as unknown as { status: string; at: Date; note?: string }[]) ?? [];
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PICKUP_SCHEDULED",
        timeline: [...timeline, { status: "PICKUP_SCHEDULED", at: new Date(), note: "Transporter requested" }],
      },
    });
    await logAudit(user.id, "PICKUP_REQUESTED", "Logistics", logisticsRow.id, { orderNo: order.orderNo, created });
    return ok({ logistics: logisticsRow, requested: true });
  } catch (e) {
    return fail(e);
  }
}

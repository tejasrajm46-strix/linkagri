import { fail, ok } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

export async function GET(_req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  try {
    const user = await requireSession();
    const order = await prisma.order.findUnique({
      where: { orderNo: orderNo.toUpperCase() },
      include: {
        buyer: { select: { id: true, name: true, buyerProfile: true } },
        seller: { select: { id: true, name: true } },
        lot: { include: { crop: true } },
        logistics: true,
        payments: true,
        disputes: true,
      },
    });
    if (!order) throw { status: 404, message: "Order not found" };

    const isAdmin = user.role === Role.ADMIN;
    const isParty = order.sellerId === user.id || order.buyerId === user.id;
    const isAssignedTransporter =
      user.role === Role.TRANSPORTER &&
      order.logistics.some((l) => l.transporterId === user.id);

    if (!isAdmin && !isParty && !isAssignedTransporter) {
      throw { status: 404, message: "Order not found" };
    }
    return ok({ order });
  } catch (e) {
    return fail(e);
  }
}

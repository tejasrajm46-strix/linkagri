import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail } from "@/lib/apiHelpers";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const url = new URL(req.url);
    const include = {
      buyer: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
      logistics: true,
      payments: true,
    };

    let orders;
    if (user.role === Role.ADMIN) {
      orders = await prisma.order.findMany({ include, orderBy: { createdAt: "desc" }, take: 80 });
    } else if (user.role === Role.TRANSPORTER) {
      const ids = (await prisma.logistics.findMany({ where: { transporterId: user.id }, select: { orderId: true } })).map((l) => l.orderId);
      orders = await prisma.order.findMany({ where: { id: { in: ids } }, include, orderBy: { createdAt: "desc" }, take: 80 });
    } else {
      orders = await prisma.order.findMany({
        where: { OR: [{ sellerId: user.id }, { buyerId: user.id }] },
        include,
        orderBy: { createdAt: "desc" },
        take: 80,
      });
    }
    const scope = url.searchParams.get("scope");
    if (scope === "incoming") orders = orders.filter((o) => o.sellerId === user.id);
    if (scope === "outgoing") orders = orders.filter((o) => o.buyerId === user.id);
    return ok({ orders });
  } catch (e) {
    return fail(e);
  }
}
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail } from "@/lib/apiHelpers";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireSession();
    const include = { order: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } } };
    if (user.role === Role.TRANSPORTER) {
      const open = await prisma.logistics.findMany({
        where: { OR: [{ status: "PENDING" }, { status: "PICKUP_SCHEDULED", transporterId: null }] },
        include,
        orderBy: { createdAt: "asc" },
      });
      const mine = await prisma.logistics.findMany({
        where: { transporterId: user.id, status: { not: "DELIVERED" } },
        include,
        orderBy: { updatedAt: "desc" },
      });
      return ok({ open, mine });
    }
    if (user.role === Role.ADMIN) {
      const all = await prisma.logistics.findMany({ include, orderBy: { createdAt: "desc" }, take: 40 });
      return ok({ all });
    }
    throw { status: 403, message: "Only transporters see the job board" };
  } catch (e) {
    return fail(e);
  }
}
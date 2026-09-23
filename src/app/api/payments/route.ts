import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail } from "@/lib/apiHelpers";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireSession();
    let payments;
    if (user.role === Role.ADMIN) {
      payments = await prisma.payment.findMany({ include: { order: true, payer: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
    } else {
      payments = await prisma.payment.findMany({
        where: { OR: [{ payerId: user.id }, { payeeId: user.id }] },
        include: { order: true, payer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    }
    return ok({ payments });
  } catch (e) {
    return fail(e);
  }
}
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/apiHelpers";

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return ok({ user: null });
    const [unread, db] = await Promise.all([
      prisma.notification.count({ where: { userId: user.id, read: false } }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          verified: true,
          avatarColor: true,
          farmerProfile: true,
          buyerProfile: true,
          transporter: true,
        },
      }),
    ]);
    return ok({ user: { ...user, unread }, profile: db });
  } catch (e) {
    return fail(e);
  }
}

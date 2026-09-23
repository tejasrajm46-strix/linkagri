import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail } from "@/lib/apiHelpers";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";

export async function GET() {
  try {
    const user = await requireSession();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    const unread = notifications.filter((n) => !n.read).length;
    return ok({ notifications, unread });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "notifications:readall", key: user.id, ...Rate.general });
    await prisma.notification.updateMany({ where: { userId: user.id }, data: { read: true } });
    return ok({ readAll: true });
  } catch (e) {
    return fail(e);
  }
}
import { fail, ok } from "@/lib/apiHelpers";
import { clearSessionCookie, getSession, logAudit } from "@/lib/auth";
import { assertSameOrigin, clientIp } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { Rate, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    rateLimit({ scope: "auth:logout", key: clientIp(req), ...Rate.auth });

    const user = await getSession();
    if (user) {
      // Bump sessionVersion: every JWT issued before this moment is revoked,
      // even if an attacker replays the old cookie.
      await prisma.user.update({
        where: { id: user.id },
        data: { sessionVersion: { increment: 1 } },
      });
      await logAudit(user.id, "AUTH_LOGOUT", "User", user.id, { ip: clientIp(req) });
    }
    await clearSessionCookie();
    return ok({ loggedOut: true });
  } catch (e) {
    return fail(e);
  }
}

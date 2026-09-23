import { fail, ok, readBody } from "@/lib/apiHelpers";
import { getSession, logAudit, setSessionCookie, signSession } from "@/lib/auth";
import { assertSameOrigin, clientIp } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { enterSchema } from "@/lib/schemas";

/**
 * Passwordless role entry.
 *
 * This build has no password login: a visitor picks a profile (Farmer, FPO,
 * Buyer, Transporter, Admin) and gets a normal httpOnly session for the seeded
 * account behind that profile. The mapping lives here, on the server, so no
 * credential — and no account address list — is ever shipped to the client.
 *
 * Disabled when DEMO_MODE is off (production default), so it cannot survive as
 * a permanent backdoor once real accounts exist.
 */
const ROLE_EMAILS: Record<string, string> = {
  FARMER: "farmer@agrilink.in",
  FPO: "fpo@agrilink.in",
  BUYER: "buyer@agrilink.in",
  TRANSPORTER: "transporter@agrilink.in",
  ADMIN: "admin@agrilink.in",
};

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    rateLimit({ scope: "auth:enter", key: clientIp(req), ...Rate.auth });

    if (!isDemoMode()) {
      throw { status: 403, message: "Role entry is disabled on this deployment." };
    }

    // Whoever is currently signed in (if anyone) only matters for the audit log.
    const actor = await getSession();
    const { role } = enterSchema.parse(await readBody(req));

    const email = ROLE_EMAILS[role];
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw {
        status: 503,
        message: "Demo data has not been initialised yet. Please try again in a moment.",
      };
    }

    const token = signSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      verified: user.verified,
      sessionVersion: user.sessionVersion,
    });
    await setSessionCookie(token);
    await logAudit(actor?.id ?? null, "AUTH_ROLE_ENTER", "User", user.id, {
      from: actor?.role ?? null,
      to: role,
      ip: clientIp(req),
    });
    return ok({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, verified: user.verified },
    });
  } catch (e) {
    return fail(e);
  }
}

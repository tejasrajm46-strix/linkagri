import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { adminVerifySchema } from "@/lib/schemas";
import { Role } from "@prisma/client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const admin = await requireSession([Role.ADMIN]);
    rateLimit({ scope: "admin:users", key: admin.id, ...Rate.admin });
    // Only the verified flag can be changed — role/email/etc. are never
    // accepted here (strict schema rejects unknown keys).
    const body = adminVerifySchema.parse(await readBody(req));
    const user = await prisma.user.findUnique({
      where: { id },
      include: { buyerProfile: true, farmerProfile: true },
    });
    if (!user) throw { status: 404, message: "User not found" };
    if (user.role === Role.ADMIN) throw { status: 400, message: "Cannot modify an admin" };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { verified: body.verified } });
      if (user.role === Role.BUYER && user.buyerProfile) {
        await tx.buyerProfile.update({ where: { id: user.buyerProfile.id }, data: { documentsVerified: body.verified } });
      }
    });
    await notify({
      userId: user.id,
      type: "INFO",
      title: body.verified ? "Account verified ✓" : "Account verification note",
      body: body.verified
        ? "Your AgriLink account is now verified. You can transact on the platform."
        : "Your account is under review. Upload any missing documents for faster verification.",
    });
    await logAudit(admin.id, body.verified ? "USER_VERIFIED" : "USER_UNVERIFIED", "User", user.id, {
      verified: body.verified,
      name: user.name,
      role: user.role,
      targetId: user.id,
    });
    return ok({ verified: body.verified });
  } catch (e) {
    return fail(e);
  }
}
import { fail, ok, readBody } from "@/lib/apiHelpers";
import { logAudit, requireSession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/db";
import { Rate, rateLimit } from "@/lib/rateLimit";
import { cropHealthPatchSchema } from "@/lib/schemas";
import { Role } from "@prisma/client";

const include = {
  request: { select: { id: true, requestNo: true, crop: true, problemDescription: true, symptoms: true, status: true } },
  report: { select: { id: true, reportNo: true, testType: true, reportDate: true, status: true } },
  aiAnalysis: true,
  consultations: { orderBy: { createdAt: "desc" as const } },
} as const;

async function getScoped(id: string, userId: string, role: Role) {
  const c = await prisma.cropHealthCase.findUnique({ where: { id }, include });
  if (!c) throw { status: 404, message: "Crop health case not found" };
  if (c.farmerId !== userId && role !== Role.ADMIN) {
    throw { status: 403, message: "You can only access your own crop health cases" };
  }
  return c;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireSession();
    rateLimit({ scope: "crop-health:get", key: user.id, ...Rate.general });
    return ok({ case: await getScoped(id, user.id, user.role) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "crop-health:update", key: user.id, ...Rate.action });

    const body = cropHealthPatchSchema.parse(await readBody(req));
    const c = await getScoped(id, user.id, user.role);

    const updated = await prisma.cropHealthCase.update({
      where: { id: c.id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.actionTaken !== undefined ? { actionTaken: body.actionTaken ?? null } : {}),
        ...(body.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
      },
      include,
    });
    await logAudit(user.id, "CROP_HEALTH_UPDATED", "CropHealthCase", c.id, {
      status: body.status,
      caseNo: c.caseNo,
    });
    return ok({ case: updated });
  } catch (e) {
    return fail(e);
  }
}
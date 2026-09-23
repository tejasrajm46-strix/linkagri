import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { fail, ok, readBody } from "@/lib/apiHelpers";
import { plannerLogSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Append a field-log entry to a crop plan — a lifecycle stage tick, a plot
 * action ("Log" in the zoning table) or an optical scan capture.
 *
 * Ownership is enforced: a farmer can only log against their own plan.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "planner-log", key: user.id, ...Rate.action });

    const body = plannerLogSchema.parse(await readBody(req));

    const plan = await prisma.cropPlan.findUnique({ where: { id: body.planId } });
    if (!plan) throw { status: 404, message: "Crop plan not found" };
    if (plan.farmerId !== user.id && user.role !== Role.ADMIN) {
      throw { status: 403, message: "This crop plan belongs to another account" };
    }

    if (body.zoneId) {
      const zone = await prisma.cropPlanZone.findUnique({ where: { id: body.zoneId } });
      if (!zone || zone.planId !== plan.id) throw { status: 404, message: "Plot not found in this plan" };
      await prisma.cropPlanZone.update({
        where: { id: body.zoneId },
        data: { lastAction: body.label, loggedAt: new Date() },
      });
    }

    const activity = await prisma.plannerActivity.create({
      data: {
        planId: plan.id,
        actorId: user.id,
        kind: body.kind,
        label: body.label,
        detail: body.detail ?? null,
      },
    });

    await logAudit(user.id, `PLANNER_${body.kind}`, "CropPlan", plan.id, {
      label: body.label,
      zoneId: body.zoneId ?? null,
      stageIndex: body.stageIndex ?? null,
    });

    return ok({ activity: { ...activity, createdAt: activity.createdAt.toISOString() } });
  } catch (e) {
    return fail(e);
  }
}

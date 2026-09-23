import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { fail, ok, readBody } from "@/lib/apiHelpers";
import { plannerZoneSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { cropGuide } from "@/lib/cropGuide";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Add a plot to the signed-in farmer's active crop plan.
 *
 * The projected yield is computed from the crop's published per-acre yield and
 * the plot's health score — never taken from the request, so a client cannot
 * post a yield it likes. Acreage is re-totalled on the plan.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO, Role.ADMIN]);
    rateLimit({ scope: "planner-zone", key: user.id, ...Rate.action });

    const body = plannerZoneSchema.parse(await readBody(req));

    const plan = await prisma.cropPlan.findFirst({
      where: user.role === Role.ADMIN ? { isActive: true } : { farmerId: user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!plan) throw { status: 404, message: "No active crop plan — reload the planner to create one" };

    const guide = cropGuide(body.cropName);
    const healthScore = body.healthScore ?? 85;
    const projectedYieldTons = Math.round(body.acreage * guide.yieldTonsPerAcre * (0.85 + 0.15 * (healthScore / 100)) * 10) / 10;

    const zone = await prisma.cropPlanZone.create({
      data: {
        planId: plan.id,
        zoneName: body.zoneName,
        cropName: body.cropName,
        variety: body.variety ?? guide.varieties[0] ?? null,
        acreage: body.acreage,
        healthScore,
        projectedYieldTons,
      },
    });

    const zones = await prisma.cropPlanZone.findMany({ where: { planId: plan.id }, select: { acreage: true } });
    const allocatedAcres = Math.round(zones.reduce((s, z) => s + z.acreage, 0) * 100) / 100;
    await prisma.cropPlan.update({ where: { id: plan.id }, data: { allocatedAcres } });

    const activity = await prisma.plannerActivity.create({
      data: {
        planId: plan.id,
        actorId: user.id,
        kind: "ZONE_ADDED",
        label: `${zone.zoneName} added — ${body.acreage} acre ${body.cropName}`,
        detail: `Projected ${projectedYieldTons} t at ${healthScore}% plot health`,
      },
    });

    await logAudit(user.id, "PLANNER_ZONE_ADDED", "CropPlanZone", zone.id, {
      planId: plan.id,
      cropName: body.cropName,
      acreage: body.acreage,
      projectedYieldTons,
    });

    return ok({
      zone: { ...zone, loggedAt: zone.loggedAt ? zone.loggedAt.toISOString() : null },
      allocatedAcres,
      activity: { ...activity, createdAt: activity.createdAt.toISOString() },
    });
  } catch (e) {
    return fail(e);
  }
}

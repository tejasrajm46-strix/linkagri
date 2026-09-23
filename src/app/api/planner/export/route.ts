import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fail } from "@/lib/apiHelpers";
import { cropGuide, cropStages } from "@/lib/cropGuide";
import { cropIndices, daysBetween, planEconomics, startOfUtcDay } from "@/lib/planner";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

/** RFC 4180-ish escaping: quote anything that could contain a separator. */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Download the sowing plan as CSV: the season, the five lifecycle stages with
 * their labour/input requirements, the allocated plots and the net-realisation
 * forecast. A GET with no side effects, so it can be opened directly.
 */
export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const cropParam = new URL(req.url).searchParams.get("crop")?.trim();

    const plan = await prisma.cropPlan.findFirst({
      where: user.role === Role.FARMER || user.role === Role.FPO ? { farmerId: user.id, isActive: true } : { isActive: true },
      include: { zones: { orderBy: { zoneName: "asc" } }, farmer: true, lot: true },
      orderBy: { createdAt: "asc" },
    });
    if (!plan) throw { status: 404, message: "No active crop plan to export" };

    const cropName = cropParam || plan.cropLabel.split(" ")[0];
    const guide = cropGuide(cropName);
    const stages = cropStages(cropName);
    const dayNumber = Math.max(1, daysBetween(plan.sowingDate, new Date()) + 1);
    const indices = await cropIndices();
    const index = indices.find((i) => i.crop.toLowerCase() === cropName.toLowerCase());
    const economics = planEconomics(
      {
        id: plan.id,
        title: plan.title,
        lotNo: plan.lot?.lotNo ?? null,
        cropId: plan.cropId,
        cropLabel: plan.cropLabel,
        variety: plan.variety,
        season: plan.season as "Kharif" | "Rabi" | "Zaid",
        sowingDate: plan.sowingDate,
        harvestWindowStart: plan.harvestWindowStart,
        harvestWindowEnd: plan.harvestWindowEnd,
        farmHoldingAcres: plan.farmHoldingAcres,
        allocatedAcres: plan.allocatedAcres,
        dayNumber,
        cycleDays: guide.cycleDays,
        currentStageIndex: 1,
        stages: [],
        care: [],
        pests: [],
        zones: plan.zones.map((z) => ({
          id: z.id,
          zoneName: z.zoneName,
          cropName: z.cropName,
          variety: z.variety,
          acreage: z.acreage,
          healthScore: z.healthScore,
          projectedYieldTons: z.projectedYieldTons,
          lastAction: z.lastAction,
          loggedAt: z.loggedAt,
        })),
      },
      index?.index ?? null
    );

    const iso = (d: Date) => startOfUtcDay(d).toISOString().slice(0, 10);
    const lines: string[] = [];
    lines.push(["section", "field", "value"].join(","));
    lines.push(["plan", "plan", plan.title].map(cell).join(","));
    lines.push(["plan", "farmer", plan.farmer.name].map(cell).join(","));
    lines.push(["plan", "season", plan.season].map(cell).join(","));
    lines.push(["plan", "sowing date", iso(plan.sowingDate)].map(cell).join(","));
    lines.push(["plan", "day of cycle", dayNumber].map(cell).join(","));
    lines.push(["plan", "harvest window start", iso(plan.harvestWindowStart)].map(cell).join(","));
    lines.push(["plan", "harvest window end", iso(plan.harvestWindowEnd)].map(cell).join(","));
    lines.push(["plan", "farm holding (acres)", plan.farmHoldingAcres].map(cell).join(","));
    lines.push(["plan", "allocated (acres)", plan.allocatedAcres].map(cell).join(","));
    lines.push(["plan", "irrigation benchmark (mm)", guide.waterMm.join(" - ")].map(cell).join(","));
    lines.push(["plan", "spacing", guide.spacing].map(cell).join(","));
    lines.push("");

    lines.push(["stage", "name", "day from", "day to", "summary", "labour", "inputs"].map(cell).join(","));
    for (const s of stages) lines.push(["stage", s.name, s.from, s.to, s.summary, s.labor, s.inputs].map(cell).join(","));
    lines.push("");

    lines.push(["plot", "zone", "crop", "variety", "acreage", "health score", "projected yield (t)", "last action"].map(cell).join(","));
    for (const z of plan.zones) {
      lines.push(["plot", z.zoneName, z.cropName, z.variety ?? "", z.acreage, z.healthScore, z.projectedYieldTons, z.lastAction ?? ""].map(cell).join(","));
    }
    lines.push("");

    lines.push(["economics", "apmc index (rs/kg)", index?.index ?? "n/a"].map(cell).join(","));
    lines.push(["economics", "projected yield (t)", economics.projectedYieldTons].map(cell).join(","));
    lines.push(["economics", "gross revenue (rs)", Math.round(economics.gross)].map(cell).join(","));
    for (const d of economics.deductions) lines.push(["economics", `less ${d.label} (rs)`, d.amount].map(cell).join(","));
    lines.push(["economics", "net realisation (rs)", Math.round(economics.net)].map(cell).join(","));
    lines.push(["economics", "net per kg (rs)", economics.netPerKg.toFixed(2)].map(cell).join(","));
    lines.push("");
    lines.push(["note", "generated", new Date().toISOString()].map(cell).join(","));

    const filename = `${cropName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-sowing-plan.csv`;
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}

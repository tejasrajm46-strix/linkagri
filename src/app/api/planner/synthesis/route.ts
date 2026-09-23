import { requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/apiHelpers";
import { cropIndices } from "@/lib/planner";
import { cropGuide } from "@/lib/cropGuide";
import { synthesise } from "@/lib/planner";
import { rateLimit, Rate } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * AI synthesis for one crop, grounded in the live APMC index and buyer demand.
 *
 * This is deliberately separate from the page render: the page always paints
 * the deterministic offline synthesis immediately, and this endpoint upgrades
 * it once a free model answers (or returns the offline text when every free
 * model is busy).
 */
export async function GET(req: Request) {
  try {
    const user = await requireSession();
    // Free models are rate limited — never let a page refresh burn the quota.
    rateLimit({ scope: "planner-synthesis", key: user.id, limit: 20, windowMs: 60_000 });

    const crop = new URL(req.url).searchParams.get("crop")?.trim();
    if (!crop) return ok({ text: "", source: "offline" });

    const indices = await cropIndices();
    const index = indices.find((i) => i.crop.toLowerCase() === crop.toLowerCase());
    const guide = cropGuide(crop);

    const result = await synthesise(crop, {
      variety: guide.varieties[0] ?? crop,
      index: index?.index ?? null,
      changePct: index?.changePct ?? 0,
      buyers: 0,
      market: index?.market ?? null,
      distanceKm: index?.distanceKm ?? null,
      cycleDays: guide.cycleDays,
      waterMm: guide.waterMm,
      ph: guide.ph,
      soil: guide.soil,
    });

    return ok({ crop, text: result.text, source: result.source });
  } catch (e) {
    return fail(e);
  }
}

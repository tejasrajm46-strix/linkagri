import { requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/apiHelpers";
import { getPlannerView } from "@/lib/planner";

export const dynamic = "force-dynamic";

/**
 * Read-only planner view as JSON (plan, crop panels, market indices,
 * economics). The /planner page renders the same object server-side; this
 * endpoint exists so the data is consumable by other clients and by the
 * deployment smoke tests.
 */
export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const crop = new URL(req.url).searchParams.get("crop") ?? undefined;
    const view = await getPlannerView(user, crop);
    return ok({ ...view });
  } catch (e) {
    return fail(e);
  }
}

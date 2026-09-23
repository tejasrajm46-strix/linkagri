import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { marketSnapshots } from "@/lib/forecast";
import { ok, fail } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const cropQ = url.searchParams.get("crop");
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 3), 90);
    const crop = cropQ
      ? await prisma.crop.findFirst({ where: { name: { contains: cropQ, mode: "insensitive" } } })
      : await prisma.crop.findFirst();
    if (!crop) return ok({ series: [] });
    const snaps = await marketSnapshots(crop.id, days);
    return ok({
      crop,
      series: snaps.map((s) => ({ market: s.marketName, points: s.series })),
    });
  } catch (e) {
    return fail(e);
  }
}
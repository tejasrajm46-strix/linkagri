import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { marketSnapshots } from "@/lib/forecast";
import { ok, fail } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const cropQ = url.searchParams.get("crop");
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 90);

    let cropId: string | undefined;
    if (cropQ) {
      const crop = await prisma.crop.findFirst({
        where: { OR: [{ id: cropQ }, { name: { contains: cropQ, mode: "insensitive" } }] },
      });
      cropId = crop?.id;
    }
    const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
    const active = cropId ? crops.find((c) => c.id === cropId) ?? crops[0] : crops[0];
    if (!active) return ok({ snapshots: [], crops: [], crop: null });
    const snapshots = await marketSnapshots(active.id, days);
    return ok({ snapshots, crops, crop: active });
  } catch (e) {
    return fail(e);
  }
}
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { marketArrivals } from "@/lib/forecast";
import { ok, fail } from "@/lib/apiHelpers";

export async function GET(req: Request) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const cropQ = url.searchParams.get("crop");
    const crop = cropQ
      ? await prisma.crop.findFirst({ where: { name: { contains: cropQ, mode: "insensitive" } } })
      : await prisma.crop.findFirst();
    if (!crop) return ok({ arrivals: [] });
    const arrivals = await marketArrivals(crop.id, 7);
    return ok({ crop, arrivals });
  } catch (e) {
    return fail(e);
  }
}
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail } from "@/lib/apiHelpers";
import { rateLimit, Rate } from "@/lib/rateLimit";

const publicSelect = {
  id: true,
  name: true,
  description: true,
  location: true,
  address: true,
  distanceKm: true,
  services: true,
  supportedCrops: true,
  testTypes: true,
  phone: true,
  email: true,
  website: true,
  operatingHours: true,
  accreditation: true,
  isVerified: true,
  rating: true,
  approxPrice: true,
  turnaroundDays: true,
} as const;

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    rateLimit({ scope: "labs:list", key: user.id, ...Rate.general });

    const url = new URL(req.url);
    const testType = url.searchParams.get("testType")?.trim();
    const crop = url.searchParams.get("crop")?.trim();
    const maxDistRaw = url.searchParams.get("maxDistance")?.trim() ?? "";
    const maxPriceRaw = url.searchParams.get("maxPrice")?.trim() ?? "";
    const maxDistance = maxDistRaw === "" ? NaN : Number(maxDistRaw);
    const maxPrice = maxPriceRaw === "" ? NaN : Number(maxPriceRaw);

    let labs = await prisma.lab.findMany({
      select: publicSelect,
      orderBy: [{ isVerified: "desc" }, { distanceKm: "asc" }],
    });

    if (testType) {
      labs = labs.filter((l) =>
        [...l.services, ...l.testTypes].some((s) => s.toLowerCase().includes(testType.toLowerCase()))
      );
    }
    if (crop) {
      labs = labs.filter((l) =>
        l.supportedCrops.some((c) => c.toLowerCase().includes(crop.toLowerCase()) || c.toLowerCase() === "all crops")
      );
    }
    if (!Number.isNaN(maxDistance)) labs = labs.filter((l) => l.distanceKm <= maxDistance);
    if (!Number.isNaN(maxPrice)) labs = labs.filter((l) => (l.approxPrice ?? 0) <= maxPrice);

    return ok({ labs, count: labs.length });
  } catch (e) {
    return fail(e);
  }
}
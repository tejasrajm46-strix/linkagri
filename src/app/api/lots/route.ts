import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { nextLotNo } from "@/lib/ids";
import { readBody, ok, fail } from "@/lib/apiHelpers";
import { lotCreateSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { Role } from "@prisma/client";

const offerInclude = {
  offers: {
    include: { buyer: { select: { id: true, name: true, buyerProfile: true } } },
    orderBy: { createdAt: "desc" as const },
    take: 20,
  },
};

const publicInclude = {
  crop: true,
  farmer: { select: { id: true, name: true, verified: true, farmerProfile: true } },
  fpo: true,
  qualityReports: true,
} as const;

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const url = new URL(req.url);
    const cropQ = url.searchParams.get("crop");

    // Role-based scoping — never trust a URL/query parameter for ownership.
    const where: Record<string, unknown> = {};
    if (user.role === Role.ADMIN) {
      // admins see everything
    } else if (user.role === Role.BUYER) {
      // buyers see the open marketplace + lots they already bid on
      where.OR = [
        { status: "LISTED" },
        { offers: { some: { buyerId: user.id, status: { in: ["SUBMITTED", "COUNTERED"] } } } },
      ];
    } else if (user.role === Role.TRANSPORTER) {
      // transporters have no lots
      where.farmerId = "none";
    } else {
      // farmers / FPOs see only lots they own
      where.farmerId = user.id;
    }

    if (cropQ) {
      const crop = await prisma.crop.findFirst({ where: { name: { contains: cropQ, mode: "insensitive" } } });
      if (crop) where.cropId = crop.id;
    }

    const include =
      user.role === Role.BUYER || user.role === Role.TRANSPORTER
        ? publicInclude
        : { ...publicInclude, ...offerInclude };

    const lots = await prisma.lot.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return ok({ lots });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.FARMER, Role.FPO]);
    if (!user.verified) {
      throw { status: 403, message: "Your account must be verified before you can list produce" };
    }
    rateLimit({ scope: "lots:create", key: user.id, ...Rate.action });

    const body = lotCreateSchema.parse(await readBody(req));
    const crop = await prisma.crop.findUnique({ where: { id: body.cropId } });
    if (!crop) throw { status: 400, message: "Unknown crop" };

    const expectedPrice = body.expectedPrice;
    const minPrice = body.minPrice ?? Math.round(expectedPrice * 0.85);
    if (minPrice > expectedPrice) {
      throw { status: 400, message: "Minimum price cannot exceed the expected price" };
    }
    const lotNo = await nextLotNo();
    const lot = await prisma.lot.create({
      data: {
        lotNo,
        farmerId: user.id,
        cropId: body.cropId,
        variety: body.variety ?? null,
        quantityKg: body.quantityKg,
        grade: body.grade ?? "A",
        qualityScore: body.qualityScore ?? 85,
        location: body.location ?? "Ramanagara",
        expectedPrice,
        minPrice,
        harvestDate: body.harvestDate ? new Date(body.harvestDate) : null,
        availableDate: body.availableDate ? new Date(body.availableDate) : new Date(),
        packaging: body.packaging ?? null,
        storage: body.storage ?? null,
        notes: body.notes ?? null,
        photos: body.photos ?? [],
        status: "LISTED",
      },
      include: { crop: true },
    });
    await logAudit(user.id, "LOT_CREATED", "Lot", lot.id, { lotNo });
    return ok({ lot }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

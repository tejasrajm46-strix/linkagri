import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { forecastPrice, marketSnapshots } from "@/lib/forecast";
import { matchBuyersForLot } from "@/lib/matching";
import { realiseOffer } from "@/lib/netRealisation";
import { ok, fail } from "@/lib/apiHelpers";
import { isOpenLot } from "@/lib/state";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const user = await requireSession();
    const url = new URL(req.url);
    const lotNo = url.searchParams.get("lotNo")?.toUpperCase();

    let lot = null;
    if (lotNo) {
      lot = await prisma.lot.findUnique({
        where: { lotNo },
        include: { crop: true, farmer: true, fpo: true, offers: { include: { buyer: true } } },
      });
      if (!lot) throw { status: 404, message: `Lot ${lotNo} not found` };
      // Only the owner (or admins) may pull recommendations for a private/
      // historical lot; buyers may only use open marketplace lots.
      const isOwner = lot.farmerId === user.id;
      const canSeeOpen =
        isOpenLot(lot.status) &&
        (user.role === Role.FARMER || user.role === Role.FPO || user.role === Role.BUYER);
      if (!isOwner && user.role !== Role.ADMIN && !canSeeOpen) {
        throw { status: 404, message: `Lot ${lotNo} not found` };
      }
    }

    if (!lot) {
      const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
      return ok({ forecast: null, crops });
    }

    const forecast = await forecastPrice({ cropId: lot.cropId, days: 7 });
    const market = (await marketSnapshots(lot.cropId, 7)).find((m) => m.marketName.includes("Ramanagara")) ?? null;
    const matches = await matchBuyersForLot(lot);
    const topBuyers = matches.slice(0, 3).map((m) => {
      const defaultPrice = m.companyName.includes("ABC") ? 32 : m.companyName.includes("GreenMart") ? 30 : 28;
      const price = m.priceOffered ?? defaultPrice;
      const realise = realiseOffer(price, lot.quantityKg);
      return { ...m, netPerKg: realise.netPerKg, net: realise.net };
    });

    return ok({
      lot: {
        lotNo: lot.lotNo,
        crop: lot.crop.name,
        quantityKg: lot.quantityKg,
        grade: lot.grade,
        location: lot.location,
        expectedPrice: lot.expectedPrice,
        qualityScore: lot.qualityScore,
      },
      market,
      forecast,
      topBuyers,
    });
  } catch (e) {
    return fail(e);
  }
}
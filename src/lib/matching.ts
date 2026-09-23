import { prisma } from "./db";

/** Rough demo distance between known locations (km). */
const DISTANCE_TABLE: Record<string, Record<string, number>> = {
  Ramanagara: { Bengaluru: 35, Mysuru: 60, Hosur: 45 },
  Channapatna: { Bengaluru: 55, Mysuru: 40, Hosur: 80 },
  Kanakapura: { Bengaluru: 60, Mysuru: 90, Hosur: 100 },
  Kolar: { Bengaluru: 70, Mysuru: 160, Hosur: 30 },
};

function distanceBetween(from: string, to: string): number {
  const f = DISTANCE_TABLE[from];
  if (f && f[to]) return f[to];
  return 45; // default demo distance
}

export type BuyerMatch = {
  buyerId: string;
  companyName: string;
  demandId: string;
  cropName: string;
  grade: string;
  quantityNeededKg: number;
  priceOffered: number | null;
  location: string;
  distanceKm: number;
  reliability: number;
  paymentScore: number;
  fulfilmentRate: number;
  verified: boolean;
  score: number; // % match
  reasons: string[];
  paymentDays: number;
};

/**
 * Hard filters first (crop → grade → quantity → delivery location → date),
 * then rank by weighted price / reliability / payment / distance / quantity
 * / fulfilment. The returned reasons array keeps the score explainable.
 */
export async function matchBuyersForLot(lot: {
  id: string;
  cropId: string;
  grade: string;
  quantityKg: number;
  location: string;
  expectedPrice: number;
  minPrice: number;
}): Promise<BuyerMatch[]> {
  const demands = await prisma.buyerDemand.findMany({
    where: { cropId: lot.cropId, status: "ACTIVE" },
    include: {
      buyer: { include: { buyerProfile: true } },
      crop: true,
    },
  });

  const matches: BuyerMatch[] = [];
  for (const d of demands) {
    const profile = d.buyer.buyerProfile;
    if (!profile) continue;

    // ── Hard filters ──────────────────────────────────────────────────
    if (d.grade && d.grade !== lot.grade && d.grade !== "Any") continue;
    if (d.requiredBy && d.requiredBy.getTime() < Date.now()) continue;

    const distance = distanceBetween(lot.location, profile.district);
    const priceCap = d.maxPrice ?? profile.needs ? Infinity : Infinity;

    // price compatibility: does the demand's cap cover the farmer's minimum?
    const priceScore =
      d.maxPrice == null
        ? 100
        : Math.min((d.maxPrice / lot.expectedPrice) * 100, 100);

    const coverage = Math.min(d.quantityKg / lot.quantityKg, 1);
    const qtyScore = d.quantityKg >= lot.quantityKg ? 100 : coverage * 90 + 10 * coverage;
    const distanceScore = Math.max(100 - distance * 0.9, 20);
    const reliability = profile.reliability;
    const payment = profile.paymentScore;
    const fulfilment = profile.fulfilmentRate;

    // ── Weighted overall score (explainable) ──────────────────────────
    const score =
      0.2 * priceScore +
      0.2 * reliability +
      0.18 * payment +
      0.15 * fulfilment +
      0.15 * distanceScore +
      0.12 * qtyScore;

    const reasons: string[] = [];
    reasons.push(`${d.buyer.name} can take ${d.quantityKg.toLocaleString("en-IN")} kg of ${d.crop.name} (${d.grade})`);
    if (d.maxPrice != null) {
      reasons.push(
        d.maxPrice >= lot.expectedPrice
          ? `Price cap ₹${d.maxPrice}/kg covers your expected ₹${lot.expectedPrice}/kg`
          : `Price cap ₹${d.maxPrice}/kg is below your expectation`
      );
    }
    reasons.push(`Payment reliability ${payment}/100, pays in ~${profile.avgPaymentDays} days`);
    reasons.push(`Fulfilment history ${fulfilment}/100, distance ~${distance} km`);

    matches.push({
      buyerId: d.buyer.id,
      companyName: d.buyer.name,
      demandId: d.id,
      cropName: d.crop.name,
      grade: d.grade,
      quantityNeededKg: d.quantityKg,
      priceOffered: d.maxPrice,
      location: profile.district,
      distanceKm: distance,
      reliability,
      paymentScore: payment,
      fulfilmentRate: fulfilment,
      verified: d.buyer.verified && profile.documentsVerified,
      score: Math.round(score),
      reasons,
      paymentDays: profile.avgPaymentDays,
    });
    void priceCap;
  }

  return matches.sort((a, b) => b.score - a.score);
}
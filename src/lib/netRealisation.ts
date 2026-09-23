export type NetRealisationInput = {
  pricePerKg: number;
  quantityKg: number;
  transport?: number; // flat ₹
  handling?: number; // loading/unloading ₹
  commissionPct?: number; // % of gross
  storage?: number; // flat ₹
  lossPct?: number; // expected post-harvest loss % of gross
};

export type NetRealisationResult = {
  gross: number;
  transport: number;
  handling: number;
  commission: number;
  storage: number;
  loss: number;
  totalDeductions: number;
  net: number;
  netPerKg: number;
};

/**
 * "Don't compare only selling price."
 * Gross sale value → minus transport, handling, commission, storage and
 * expected post-harvest loss → final net realisation (₹/kg).
 */
export function computeNetRealisation(input: NetRealisationInput): NetRealisationResult {
  const gross = input.pricePerKg * input.quantityKg;
  const transport = input.transport ?? 0;
  const handling = input.handling ?? 0;
  const commission = ((input.commissionPct ?? 0) / 100) * gross;
  const storage = input.storage ?? 0;
  const loss = ((input.lossPct ?? 0) / 100) * gross;
  const totalDeductions = transport + handling + commission + storage + loss;
  const net = gross - totalDeductions;
  return {
    gross,
    transport,
    handling,
    commission,
    storage,
    loss,
    totalDeductions,
    net,
    netPerKg: input.quantityKg > 0 ? net / input.quantityKg : 0,
  };
}

/** Convenience: realise a specific offer / price for a farmer's produce. */
export function realiseOffer(pricePerKg: number, quantityKg: number) {
  return computeNetRealisation({
    pricePerKg,
    quantityKg,
    transport: quantityKg >= 1000 ? 1500 : 800,
    handling: 400,
    commissionPct: 2,
    storage: 0,
    lossPct: 2,
  });
}
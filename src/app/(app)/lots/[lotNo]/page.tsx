import { Icon } from "@/components/icons";
import { OfferActions, OfferModalForLot } from "@/components/lotActions";
import { Badge, Card, Delta, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forecastPrice, marketSnapshots } from "@/lib/forecast";
import { formatNum, fullDate, pricePerKgDisplay, rupees, shortDate } from "@/lib/format";
import { realiseOffer } from "@/lib/netRealisation";
import { Role } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LotPage({ params, searchParams }: { params: Promise<{ lotNo: string }>; searchParams: Promise<{ offer?: string }> }) {
  const [{ lotNo }, query] = await Promise.all([params, searchParams]);
  const user = await requireSession();
  const lot = await prisma.lot.findUnique({
    where: { lotNo: lotNo.toUpperCase() },
    include: {
      crop: true,
      farmer: { include: { farmerProfile: true } },
      fpo: true,
      qualityReports: true,
      offers: { include: { buyer: { include: { buyerProfile: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!lot) notFound();

  // Object-level authorization: owners/admins (and FPO members for their
  // FPO's aggregated lots) may view; buyers may only view open marketplace
  // lots or lots they have bid on. Anyone else gets a 404 — never a peek.
  const isAdmin = user.role === Role.ADMIN;
  const isOwner = lot.farmerId === user.id;
  const isFpoMember =
    !isOwner &&
    lot.fpoId !== null &&
    (await prisma.fpoMember.findFirst({ where: { fpoId: lot.fpoId, userId: user.id } })) !== null;
  const isBuyer = user.role === Role.BUYER;
  const canView =
    isAdmin ||
    isOwner ||
    isFpoMember ||
    (isBuyer &&
      (lot.status === "LISTED" ||
        lot.status === "OFFER_RECEIVED" ||
        lot.offers.some((o) => o.buyerId === user.id && ["SUBMITTED", "COUNTERED"].includes(o.status))));
  if (!canView) notFound();

  // Non-owners only ever see their own offers (bidding history stays private).
  if (!isAdmin && !isOwner && !isFpoMember) {
    lot.offers = lot.offers.filter((o) => o.buyerId === user.id);
  }

  const [snapshots, forecast] = await Promise.all([
    marketSnapshots(lot.cropId, 7),
    forecastPrice({ cropId: lot.cropId, days: 7 }),
  ]);
  const bestMarket = [...snapshots].sort((a, b) => a.distanceKm - b.distanceKm)[0];
  const marketAvg = bestMarket?.todayAvg ?? 0;

  const openOffers = lot.offers.filter((o) => ["SUBMITTED", "COUNTERED"].includes(o.status));
  const bestOffer = openOffers.sort((a, b) => b.pricePerKg - a.pricePerKg)[0] ?? null;
  const realiseAtBest = bestOffer ? realiseOffer(bestOffer.pricePerKg, lot.quantityKg) : null;
  const realiseAtMarket = realiseOffer(marketAvg, lot.quantityKg);

  return (
    <>
      <PageHeader
        title={`Lot ${lot.lotNo}`}
        subtitle={`${lot.crop.name} · ${lot.farmer.name} · created ${fullDate(lot.createdAt)}`}
        actions={<Badge status={lot.status}>{lot.status}</Badge>}
      />
      <OfferModalForLot lot={{ lotNo: lot.lotNo, crop: lot.crop.name, quantityKg: lot.quantityKg, grade: lot.grade, expectedPrice: lot.expectedPrice, farmerName: lot.farmer.name }} />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* left: produce card */}
        <Card className="card-pad">
          <div className="flex items-center gap-3">
            <span className="h-14 w-14 rounded-2xl bg-brand-50 text-3xl flex items-center justify-center">{lot.crop.icon || "🌿"}</span>
            <div>
              <p className="text-xl font-bold">{lot.crop.name}</p>
              <p className="text-sm text-ink-muted">{lot.variety || "—"}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Info k="Quantity" v={`${formatNum(lot.quantityKg)} kg`} />
            <Info k="Grade" v={lot.grade} />
            <Info k="Quality score" v={<span className="text-emerald-600 font-semibold">{lot.qualityScore}/100</span>} />
            <Info k="Location" v={lot.location} />
            <Info k="Harvest date" v={lot.harvestDate ? shortDate(lot.harvestDate) : "—"} />
            <Info k="Available" v={shortDate(lot.availableDate)} />
            <Info k="Expected price" v={<span className="font-bold text-brand-700">{pricePerKgDisplay(lot.expectedPrice)}</span>} />
            <Info k="Min price" v={pricePerKgDisplay(lot.minPrice)} />
            <Info k="Packaging" v={lot.packaging || "—"} />
            <Info k="Storage" v={lot.storage || "—"} />
          </div>

          {lot.photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lot.photos[0]} alt={`${lot.crop.name} produce`} className="mt-4 h-36 w-full object-cover rounded-xl" loading="lazy" />
          ) : null}
          {lot.notes ? <p className="text-sm text-ink-muted mt-3">{lot.notes}</p> : null}

          {lot.qualityReports[0] ? (
            <div className="mt-4 rounded-xl bg-emerald-50/60 p-3">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-1.5">Quality report</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-emerald-900/80">
                {Object.entries({
                  "Size": lot.qualityReports[0].size,
                  "Moisture": lot.qualityReports[0].moisture,
                  "Defects": lot.qualityReports[0].defects,
                  "Freshness": lot.qualityReports[0].freshness,
                })
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k} className="flex justify-between gap-2">
                      <span className="text-emerald-900/50">{k}</span>
                      <span className="font-medium text-right">{v}</span>
                    </p>
                  ))}
                <p className="col-span-2 text-emerald-900/50 pt-1 border-t border-emerald-900/10 mt-1">
                  by {lot.qualityReports[0].inspector} · {lot.qualityReports[0].inspectedAt.toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>
          ) : null}

          {isOwner ? (
            <div className="mt-4 flex gap-2">
              {lot.status === "LISTED" || lot.status === "OFFER_RECEIVED" ? (
                <Withdraw lotNo={lot.lotNo} />
              ) : null}
              <Link href="/chat" className="btn-secondary flex-1">
                <Icon name="cpu" className="w-4 h-4" /> Ask AI about this lot
              </Link>
            </div>
          ) : null}
          {isBuyer && !isOwner && !bestOffer && lot.status !== "BOOKED" && lot.status !== "SOLD" ? (
            <Link href={`/lots/${lot.lotNo}?offer=1`} className="btn-primary w-full mt-4">
              Make an offer
            </Link>
          ) : null}
        </Card>

        {/* middle/right: offers */}
        <Card className="card-pad lg:col-span-2">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Icon name="handshake" className="w-4 h-4 text-brand-600" /> Offers {lot.offers.length ? `(${lot.offers.length})` : ""}
          </h2>
          {lot.offers.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No offers yet. {isBuyer ? "Be the first to make an offer!" : "Buyers with matching demand are being notified."}
            </p>
          ) : (
            <div className="space-y-3">
              {lot.offers.map((o) => {
                const q = o.buyer.buyerProfile;
                const realise = realiseOffer(o.pricePerKg, lot.quantityKg);
                return (
                  <div key={o.id} className={`rounded-2xl border p-4 ${o.status === "ACCEPTED" ? "border-emerald-300 bg-emerald-50/40" : o.status === "REJECTED" ? "border-line/10 opacity-60" : "border-line/10"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold">{o.buyer.name}</p>
                        <p className="text-xs text-ink-muted">
                          {q ? `Reliability ${q.reliability}/100 · Payment ${q.paymentScore}/100 · pays in ~${q.avgPaymentDays} days` : ""} · {shortDate(o.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-brand-700">{pricePerKgDisplay(o.pricePerKg)}</p>
                        <p className="text-xs text-ink-muted">
                          {formatNum(o.quantityKg)} kg → {rupees(o.quantityKg * o.pricePerKg)}
                        </p>
                      </div>
                    </div>
                    {o.message ? <p className="text-sm text-ink-muted mt-2 bg-black/[0.02] rounded-lg px-3 py-2">“{o.message}”</p> : null}
                    <div className="flex flex-wrap items-center gap-3 mt-2.5">
                      <Badge status={o.status}>{o.status}</Badge>
                      <span className="text-xs text-ink-faint">Net after costs: <span className="font-bold text-ink-muted">₹{realise.netPerKg.toFixed(1)}/kg</span></span>
                      {isOwner ? (
                        <div className="ml-auto">
                          <OfferActions
                            isOwner
                            offer={{
                              id: o.id,
                              offerNo: o.offerNo,
                              quantityKg: o.quantityKg,
                              pricePerKg: o.pricePerKg,
                              status: o.status,
                              createdAt: o.createdAt.toISOString(),
                              buyerName: o.buyer.name,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* sell/hold guidance */}
          {forecast ? (
            <div className="mt-5 rounded-2xl bg-brand-50/60 p-4">
              <p className="font-bold flex items-center gap-1.5 text-sm">
                <Icon name="cpu" className="w-4 h-4 text-brand-700" /> AI guidance
              </p>
              <p className="text-sm mt-1.5 text-ink">
                {forecast.direction === "WAIT" ? "Hold" : "Sell"} — {forecast.crop} expected <strong>₹{forecast.expectedLow}–{forecast.expectedHigh}/kg</strong> (confidence {forecast.confidence}%) in the next {forecast.horizonDays} day(s) at {forecast.market}.
              </p>
              <p className="text-xs text-ink-faint mt-1.5">
                {forecast.factors.join("; ")}. Estimate — not a guarantee.
              </p>
            </div>
          ) : null}
        </Card>
      </div>

      {/* net realisation comparison */}
      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <Card className="card-pad">
          <h2 className="font-bold text-sm mb-3">Net realisation — best offer vs mandi</h2>
          <table className="tbl">
            <thead>
              <tr><th>Option</th><th className="text-right">Gross</th><th className="text-right">Costs</th><th className="text-right">Net/kg</th></tr>
            </thead>
            <tbody>
              {[
                { name: `Mandi (${bestMarket?.marketName.replace("APMC ", "") ?? "nearest"})`, r: realiseAtMarket },
                bestOffer ? { name: `Offer ₹${bestOffer.pricePerKg} (${bestOffer.buyer.name})`, r: realiseAtBest! } : null,
              ]
                .filter(Boolean)
                .map((row, i) => (
                  <tr key={i} className={i === 1 ? "bg-emerald-50/50" : ""}>
                    <td className="font-semibold">{row!.name}</td>
                    <td className="text-right">{rupees(row!.r.gross)}</td>
                    <td className="text-right text-red-500">−{rupees(row!.r.totalDeductions)}</td>
                    <td className="text-right font-bold text-brand-700">₹{row!.r.netPerKg.toFixed(1)}/kg</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
        <Card className="card-pad">
          <h2 className="font-bold text-sm mb-3">Market context ({lot.crop.name})</h2>
          <div className="space-y-2 text-sm">
            {snapshots.slice(0, 4).map((s) => (
              <div key={s.marketId} className="flex items-center justify-between">
                <span>{s.marketName.replace("APMC ", "")} <span className="text-ink-faint">({s.distanceKm} km)</span></span>
                <span className="flex items-center gap-2">
                  <span className="font-bold">{pricePerKgDisplay(s.todayAvg, 0)}</span>
                  <Delta pct={s.trendPct} />
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-faint">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}

function Withdraw({ lotNo }: { lotNo: string }) {
  return (
    <Link href={`/api/lots/${lotNo}`} onClick={(e) => {
      e.preventDefault();
      if (confirm("Withdraw this lot from the marketplace?")) {
        fetch(`/api/lots/${lotNo}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withdraw: true }) }).then(() => location.reload());
      }
    }} className="btn-soft-danger flex-1 text-center">
      Withdraw
    </Link>
  );
}
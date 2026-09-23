import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { farmerDashData } from "@/components/dash/helpers";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { OfferModalForQuery, DemandModalForQuery } from "@/components/ModalQuery";
import { formatNum, pricePerKgDisplay } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Role } from "@prisma/client";

export const metadata = { title: "Buyer Marketplace" };
export const dynamic = "force-dynamic";

export default async function BuyersPage() {
  const user = await requireSession();

  if (user.role === Role.BUYER) {
    const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
    const [lots, demands] = await Promise.all([
      prisma.lot.findMany({
        where: { status: { in: ["LISTED", "OFFER_RECEIVED"] } },
        include: { crop: true, farmer: { select: { name: true } }, offers: { where: { buyerId: user.id }, take: 1 } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.buyerDemand.findMany({ where: { buyerId: user.id, status: "ACTIVE" }, include: { crop: true }, orderBy: { createdAt: "desc" } }),
    ]);

    const lotsLite = lots.map((l) => ({
      lotNo: l.lotNo,
      crop: l.crop.name,
      quantityKg: l.quantityKg,
      grade: l.grade,
      expectedPrice: l.expectedPrice,
      farmerName: l.farmer.name,
    }));

    return (
      <>
        <PageHeader
          title="Produce Marketplace"
          subtitle="Verified farmer & FPO lots near you."
          actions={
            <Link href="/buyers?post=1" className="btn-primary">
              <Icon name="plus" className="w-4 h-4" /> Post requirement
            </Link>
          }
        />
        <OfferModalForQuery lots={lotsLite} />
        <DemandModalForQuery crops={crops.map((c) => ({ id: c.id, name: c.name, icon: c.icon, unit: c.unit }))} />

        {lots.length === 0 ? (
          <EmptyState icon="package" title="No lots listed yet" body="Farmers list lots after publishing; you'll be matched when they do." />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {lots.map((l) => {
              const mine = l.offers[0];
              return (
                <Card key={l.id} className="card-pad flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-11 w-11 rounded-xl bg-brand-50 text-2xl flex items-center justify-center shrink-0">{l.crop.icon || "🌿"}</span>
                      <div className="min-w-0">
                        <p className="font-bold leading-tight">{l.crop.name} · Grade {l.grade}</p>
                        <p className="text-xs text-ink-muted truncate">{l.farmer.name} · {l.location}</p>
                      </div>
                    </div>
                    <Badge status="LISTED">Listed</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-line/[0.06] py-2">
                      <p className="text-xs text-ink-faint">Qty</p>
                      <p className="font-semibold">{formatNum(l.quantityKg)} kg</p>
                    </div>
                    <div className="rounded-lg bg-line/[0.06] py-2">
                      <p className="text-xs text-ink-faint">Expected</p>
                      <p className="font-semibold">{pricePerKgDisplay(l.expectedPrice, 0)}</p>
                    </div>
                    <div className="rounded-lg bg-line/[0.06] py-2">
                      <p className="text-xs text-ink-faint">Quality</p>
                      <p className="font-semibold text-emerald-600">{l.qualityScore}/100</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 flex gap-2">
                    <Link href={`/lots/${l.lotNo}`} className="btn-ghost flex-1 border border-line/15">
                      View lot
                    </Link>
                    {mine ? (
                      <span className="btn-secondary flex-1 !cursor-default" title={`You offered ₹${mine.pricePerKg}/kg`}>
                        Offered ₹{mine.pricePerKg}/kg
                      </span>
                    ) : (
                      <Link href={`/buyers?offer=${l.lotNo}`} className="btn-primary flex-1">
                        Make Offer
                      </Link>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {demands.length > 0 ? (
          <Card className="card-pad mt-5">
            <h2 className="font-bold mb-2">Your active requirements</h2>
            <div className="flex flex-wrap gap-2">
              {demands.map((d) => (
                <span key={d.id} className="badge bg-brand-50 text-brand-800 !py-1.5 !px-3">
                  {d.crop.icon} {formatNum(d.quantityKg)} kg {d.crop.name}
                  {d.maxPrice ? ` · ≤ ${pricePerKgDisplay(d.maxPrice, 0)}` : ""}
                </span>
              ))}
            </div>
          </Card>
        ) : null}
      </>
    );
  }

  // ── Farmer / FPO side ──────────────────────────────────────────────
  const dash = await farmerDashData(user.id);
  const matched = dash.matches;
  const best = matched[0];

  return (
    <>
      <PageHeader title="Buyer Marketplace" subtitle="Verified buyers matched to your produce — ranked by an explainable score." />
      {!dash.primary ? (
        <EmptyState icon="package" title="List your produce first" body="Create a lot and verified buyers with matching demand will appear here ranked by score." />
      ) : (
        <>
          <Card className="card-pad mb-4 !bg-brand-100/40">
            <p className="text-sm">
              Matching buyers for your <strong>{formatNum(dash.primary.quantityKg)} kg {dash.primary.crop.name}</strong> (Grade {dash.primary.grade}, {dash.primary.location}) — expected ₹{dash.primary.expectedPrice}/kg. <Link href="/lots" className="text-brand-700 font-semibold hover:underline">Manage lots →</Link>
            </p>
          </Card>

          {matched.length === 0 ? (
            <EmptyState icon="bag" title="No buyer matches yet" body="Buyers post requirements when they need stock. Check back soon or ask the AI copilot." />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {matched.map((m) => (
                <Card key={m.buyerId} className={`card-pad flex flex-col ${best?.buyerId === m.buyerId ? "ring-2 ring-brand-500" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="h-10 w-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center text-lg shrink-0">🏭</span>
                      <div className="min-w-0">
                        <p className="font-bold leading-tight truncate">{m.companyName}</p>
                        <p className="text-xs text-ink-muted truncate">
                          {m.location} · {m.distanceKm} km away{m.verified ? <span className="text-brand-600 font-semibold"> · ✓ Verified</span> : null}
                        </p>
                      </div>
                    </div>
                    <Badge status="ACCEPTED">{m.score}% match</Badge>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-ink-muted">Needs</span><span className="font-semibold">{formatNum(m.quantityNeededKg)} kg {m.cropName}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Grade</span><span className="font-semibold">{m.grade}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Price cap</span><span className="font-semibold text-brand-700">{m.priceOffered ? pricePerKgDisplay(m.priceOffered, 0) : "Negotiable"}</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Reliability</span><span className="font-semibold">{m.reliability}/100</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Payment score</span><span className="font-semibold">{m.paymentScore}/100</span></div>
                    <div className="flex justify-between"><span className="text-ink-muted">Avg payment time</span><span className="font-semibold">~{m.paymentDays} days</span></div>
                  </div>

                  <div className="mt-4 flex gap-2 mt-auto pt-1">
                    <Link href="/chat" className="btn-secondary flex-1">Ask AI</Link>
                    <Link href={`/lots/${dash.primary.lotNo}`} className="btn-primary flex-1">See offers</Link>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {best && dash.realise ? (
            <Card className="card-pad mt-5">
              <h2 className="font-bold mb-3">
                Why {best.companyName} beats the mandi (net realisation)
              </h2>
              <div className="overflow-x-auto">
                <table className="tbl min-w-[560px]">
                  <thead>
                    <tr>
                      <th>Option</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Deductions</th>
                      <th className="text-right">Net / kg</th>
                      <th className="text-right">Net total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        name: dash.bestMarket?.marketName.replace("APMC ", "") ?? "Best mandi",
                        price: dash.bestMarket?.todayAvg ?? 0,
                        isBuyer: false,
                      },
                      { name: best.companyName, price: dash.bestBuyerPrice, isBuyer: true },
                    ].map((o) => {
                      const gross = o.price * dash.primary.quantityKg;
                      const ded = o.isBuyer ? dash.realise!.totalDeductions : gross * 0.1;
                      const net = gross - ded;
                      return (
                        <tr key={o.name}>
                          <td className="font-semibold">{o.name}</td>
                          <td className="text-right">{pricePerKgDisplay(o.price, 0)}</td>
                          <td className="text-right text-red-500">− {formatNum(ded)}</td>
                          <td className="text-right font-bold text-brand-700">₹{(net / dash.primary.quantityKg).toFixed(1)}/kg</td>
                          <td className="text-right">{formatNum(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}
import Link from "next/link";
import { farmerDashData } from "./helpers";
import { Card, PageHeader, KpiCard, Badge, Delta } from "@/components/ui";
import { BarChart } from "@/components/PriceChart";
import { Icon } from "@/components/icons";
import { rupees, perKg, shortDate, formatNum } from "@/lib/format";

export async function FarmerDashboard({ userId, name }: { userId: string; name: string }) {
  const d = await farmerDashData(userId);
  const first = name.split(" ")[0];

  return (
    <>
      <PageHeader title="Farmer Dashboard" subtitle="Make better selling decisions with real-time intelligence." />
      <div className="flex items-center gap-1 text-sm mb-4 text-ink-muted flex-wrap">
        <span className="badge bg-brand-100 text-brand-800">👨‍🌾 {name}</span>
        <span className="badge bg-line/[0.06] text-ink-muted">Ramanagara</span>
        <span className="badge bg-line/[0.06] text-ink-muted">Verified ✓</span>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon="chart"
          label="Today's Avg Price"
          value={<span className="text-brand-700">{perKg(d.crossToday)}</span>}
          sub={<Delta pct={d.todayTrendPct} />}
          accent
        />
        <KpiCard
          icon="users"
          label="Active Buyers"
          value={formatNum(d.verifiedBuyers)}
          sub={
            <>
              {d.matches.length} matched to your {d.primary?.crop.name ?? "crop"}
            </>
          }
        />
        <KpiCard
          icon="package"
          label="My Produce"
          value={`${formatNum(d.produceKg)} kg`}
          sub={d.primary ? `${d.primary.crop.name} • Grade ${d.primary.grade}` : "No active lot"}
        />
        <KpiCard
          icon="card"
          label="Pending Payment"
          value={rupees(d.pendingTotal)}
          sub={
            <>
              {d.pendingOrders} order{d.pendingOrders === 1 ? "" : "s"}{" "}
              <span className="badge bg-orange-50 text-orange-600 ml-1">due soon</span>
            </>
          }
        />
      </div>

      {/* ── Middle row: trend chart + AI recommendation ──────────────── */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card className="card-pad">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold flex items-center gap-2">
              <span className="text-lg">🍅</span> Tomato Price Trend
            </h2>
            <Link href="/prices" className="text-xs font-semibold text-brand-700 hover:underline">
              View all markets →
            </Link>
          </div>
          <p className="text-xs text-ink-muted mb-3">
            {d.chartMarket?.marketName} · last 7 days · {d.chartMarket?.source}
          </p>
          {d.chartMarket ? (
            <BarChart
              points={d.chartMarket.series.map((p) => ({
                label: shortDate(p.date),
                value: p.avg,
              }))}
            />
          ) : (
            <p className="text-sm text-ink-muted py-8 text-center">No price data yet</p>
          )}
        </Card>

        <Card className="card-pad flex flex-col">
          <h2 className="font-bold flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Icon name="cpu" className="w-4 h-4" />
            </span>
            AI Selling Recommendation
          </h2>
          {d.forecast ? (
            <>
              <p className="text-sm text-ink-muted mt-0.5">
                For {formatNum(d.primary?.quantityKg ?? 0)} kg {d.forecast.crop}
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <span className="relative inline-flex h-3.5 w-3.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${d.forecast.direction === "WAIT" ? "bg-amber-400" : "bg-emerald-400"}`} />
                  <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${d.forecast.direction === "WAIT" ? "bg-amber-500" : "bg-emerald-500"}`} />
                </span>
                <p className="text-lg font-bold tracking-tight">
                  {d.forecast.direction === "WAIT" ? "WAIT 2–3 DAYS" : "SELL TODAY"}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-brand-50 py-3">
                  <p className="text-xs text-ink-muted">Expected price</p>
                  <p className="font-bold text-brand-700 mt-0.5">
                    ₹{d.forecast.expectedLow}–{d.forecast.expectedHigh}/kg
                  </p>
                </div>
                <div className="rounded-xl bg-brand-50 py-3">
                  <p className="text-xs text-ink-muted">Potential gain</p>
                  <p className="font-bold text-emerald-600 mt-0.5">
                    +₹{Math.max(d.forecast.expectedLow - d.forecast.currentAvg, 0)}–{Math.max(d.forecast.expectedHigh - d.forecast.currentAvg, 0)}/kg
                  </p>
                </div>
                <div className="rounded-xl bg-brand-50 py-3">
                  <p className="text-xs text-ink-muted">Confidence</p>
                  <p className="font-bold text-ink mt-0.5">{d.forecast.confidence}%</p>
                </div>
              </div>
              <p className="text-xs text-ink-faint mt-3 leading-relaxed">
                {d.forecast.factors.slice(0, 2).join(". ")}. Estimate from {d.forecast.basedOn.days} days of {d.forecast.basedOn.source} ·{" "}
                {d.forecast.generatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Link href="/buyers" className="btn-primary flex-1 sm:flex-none">
                  <Icon name="bag" className="w-4 h-4" /> Find Best Buyer
                </Link>
                <Link href="/calculator" className="btn-secondary flex-1 sm:flex-none">
                  Net Realisation
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted mt-2">
              Create a lot first, then AgriLink will recommend when &amp; where to sell.
            </p>
          )}
        </Card>
      </div>

      {/* ── Bottom row: best market / buyer / net realisation ─────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        <Card className="card-pad">
          <p className="flex items-center gap-1.5 text-[13px] text-ink-muted font-medium">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-line/[0.06]">
              <Icon name="building" className="w-4 h-4" />
            </span>
            Best Market
          </p>
          <p className="text-xl font-bold mt-2">
            {d.bestMarket?.marketName.replace("APMC ", "") ?? "—"}
          </p>
          <p className="text-sm text-ink-muted mt-1">
            {d.bestMarket ? `${perKg(d.bestMarket.todayAvg)} • ${d.bestMarket.distanceKm} km` : "—"}
          </p>
        </Card>
        <Card className="card-pad">
          <p className="flex items-center gap-1.5 text-[13px] text-ink-muted font-medium">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-line/[0.06]">
              <Icon name="award" className="w-4 h-4" />
            </span>
            Best Buyer
          </p>
          <p className="text-xl font-bold mt-2">{d.bestBuyer?.companyName ?? "—"}</p>
          <p className="text-sm text-ink-muted mt-1">
            {d.bestBuyer ? `${perKg(d.bestBuyerPrice)} • Score ${d.bestBuyer.score}/100` : "Create a lot to see buyers"}
          </p>
        </Card>
        <Card className="card-pad">
          <p className="flex items-center gap-1.5 text-[13px] text-ink-muted font-medium">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-line/[0.06]">
              <Icon name="calc" className="w-4 h-4" />
            </span>
            Net Realisation
          </p>
          <p className="text-xl font-bold mt-2">{d.realise ? `₹${d.realise.netPerKg.toFixed(1)}/kg` : "—"}</p>
          <p className="text-sm text-ink-muted mt-1">After transport, fees &amp; loss</p>
        </Card>
      </div>
    </>
  );
}
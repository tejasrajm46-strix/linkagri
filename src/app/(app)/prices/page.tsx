import { Icon } from "@/components/icons";
import { BarChart, LineChart } from "@/components/PriceChart";
import { Badge, Card, Delta, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forecastPrice, marketArrivals, marketSnapshots } from "@/lib/forecast";
import { formatNum, perKg, shortDate, timeAgo } from "@/lib/format";
import Link from "next/link";

export const metadata = { title: "Market Prices" };
export const dynamic = "force-dynamic";

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ crop?: string; market?: string; days?: string }> }) {
  await requireSession();
  const query = await searchParams;
  const cropQ = (query.crop ?? "Tomato").toLowerCase();
  const days = Math.min(Math.max(Number(query.days) || 7, 1), 90);

  const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });
  const crop = crops.find((c) => c.name.toLowerCase() === cropQ) ?? crops[0];
  if (!crop) throw new Error("No crops seeded — run npm run db:seed");

  const [snapshots, arrivals, forecast, demandCount] = await Promise.all([
    marketSnapshots(crop.id, days),
    marketArrivals(crop.id, days),
    forecastPrice({ cropId: crop.id, days: Math.min(days, 7) }),
    prisma.buyerDemand.count({ where: { cropId: crop.id, status: "ACTIVE" } }),
  ]);

  const marketFilter = query.market;
  const rows = marketFilter ? snapshots.filter((s) => s.marketName.toLowerCase().includes(marketFilter.toLowerCase())) : snapshots;
  const chart = rows[0] ?? snapshots[0];

  return (
    <>
      <PageHeader title="Market Prices" subtitle="Compare nearby markets and price trends." />

      {/* crop tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        {crops.map((c) => (
          <Link
            key={c.id}
            href={`/prices?crop=${encodeURIComponent(c.name)}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              c.id === crop.id ? "bg-brand-600 text-white" : "bg-card text-ink-muted border border-line/10 hover:border-brand-400"
            }`}
          >
            {c.icon} {c.name}
          </Link>
        ))}
      </div>

      {/* search row */}
      <form className="flex gap-2 items-center mb-4" action="/prices" method="GET">
        <input name="crop" defaultValue={crop.name} className="input !min-h-[46px] max-w-xs" placeholder="Search crop (Tomato…)" />
        <button className="btn-primary !min-h-[46px]">
          <Icon name="search" className="w-4 h-4" /> Search
        </button>
        <div className="ml-auto hidden sm:flex items-center gap-1 text-sm">
          <span className="text-ink-faint text-xs mr-1">Range</span>
          {[1, 7, 30].map((d) => (
            <Link
              key={d}
              href={`/prices?crop=${encodeURIComponent(crop.name)}&days=${d}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-brand-600 text-white" : "bg-card border border-line/15 text-ink-muted"}`}
            >
              {d}D
            </Link>
          ))}
        </div>
      </form>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Current prices table */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-bold flex items-center gap-2">
              <Icon name="chart" className="w-4 h-4 text-brand-600" /> Current Market Prices — {crop.name}
            </h2>
            <Badge status="ACCEPTED">● Live feed</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl min-w-[640px]">
              <thead>
                <tr>
                  <th>Market</th>
                  <th className="text-right">Min</th>
                  <th className="text-right">Max</th>
                  <th className="text-right">Average</th>
                  <th className="text-right">Distance</th>
                  <th className="text-right">Trend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.marketId}>
                    <td>
                      <p className="font-semibold">{s.marketName.replace("APMC ", "")}</p>
                      <p className="text-[11px] text-ink-faint">
                        {timeAgo(s.lastUpdated)} · {s.source}
                      </p>
                    </td>
                    <td className="text-right">{perKg(s.todayMin, 0)}</td>
                    <td className="text-right">{perKg(s.todayMax, 0)}</td>
                    <td className="text-right font-bold text-brand-700">{perKg(s.todayAvg, 0)}</td>
                    <td className="text-right text-ink-muted">{s.distanceKm} km</td>
                    <td className="text-right">
                      <Delta pct={s.trendPct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 pb-4 text-[11px] text-ink-faint">
            Min/max/average are today's traded prices per kg. Trend = today vs yesterday. Every value carries its timestamp &amp; source.
          </p>
        </Card>

        {/* AI Forecast */}
        {forecast ? (
          <Card className="card-pad flex flex-col">
            <h2 className="font-bold flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <Icon name="cpu" className="w-4 h-4" />
              </span>
              AI Forecast — {forecast.crop}
            </h2>
            <p className="text-sm text-ink mt-3 leading-relaxed">
              {forecast.factors.join(". ")}. {forecast.direction === "WAIT" ? "Expect prices to hold or rise." : "Expect prices to ease."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="badge bg-brand-100 text-brand-800 text-[13px] !px-3 !py-1.5">
                Expected: ₹{forecast.expectedLow}–{forecast.expectedHigh}/kg
              </span>
              <span className="badge bg-indigo-50 text-indigo-700 text-[13px] !px-3 !py-1.5">Confidence: {forecast.confidence}%</span>
            </div>
            <p className="text-[11px] text-ink-faint mt-4 leading-relaxed">
              Based on {forecast.basedOn.days}-day history &amp; arrivals at {forecast.market}. Estimate generated {forecast.generatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} — not a guarantee.
            </p>
            <div className="mt-auto pt-4">
              <Link href="/chat" className="btn-secondary w-full">
                <Icon name="cpu" className="w-4 h-4" /> Ask the AI copilot
              </Link>
            </div>
          </Card>
        ) : null}
      </div>

      {/* trend chart + arrivals */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card className="card-pad">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold flex items-center gap-2">
              <Icon name="trend-up" className="w-4 h-4 text-brand-600" /> Price Trend
            </h2>
            <span className="text-xs text-ink-faint">{days}-day view</span>
          </div>
          <p className="text-xs text-ink-muted mb-3">{chart?.marketName} · {crop.name} · ₹/kg</p>
          {chart ? (
            <BarChart
              points={chart.series.map((p) => ({ label: shortDate(p.date), value: p.avg }))}
            />
          ) : null}
        </Card>

        <Card className="card-pad">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold flex items-center gap-2">
              <Icon name="package" className="w-4 h-4 text-brand-600" /> Market Arrivals
            </h2>
            <span className="text-xs text-ink-faint">7 days · kg</span>
          </div>
          <p className="text-xs text-ink-muted mb-3">Supply arriving in mandis — falling arrivals usually support prices</p>
          {arrivals.length ? (
            <LineChart
              points={arrivals[0]?.series.map((p) => ({ label: shortDate(p.date), value: p.kg })) ?? []}
            />
          ) : null}
          <div className="mt-3 space-y-1.5">
            {arrivals.map((a) => (
              <div key={a.marketId} className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">{a.marketName.replace("APMC ", "")}</span>
                <span className="font-semibold">
                  {formatNum(a.avgDailyKg)}/day
                  <span className={`ml-2 text-xs font-semibold ${a.trendPct < 0 ? "text-emerald-600" : a.trendPct > 0 ? "text-red-500" : "text-ink-faint"}`}>
                    {a.trendPct < 0 ? "▼" : a.trendPct > 0 ? "▲" : "—"} {Math.abs(a.trendPct).toFixed(1)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-faint">
            Buyer demand for {crop.name}: <span className="font-semibold text-ink-muted">{demandCount} active</span>
          </p>
        </Card>
      </div>
    </>
  );
}
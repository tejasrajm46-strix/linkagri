import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, PageHeader, KpiCard, Badge, EmptyState } from "@/components/ui";
import { rupees, formatNum, fullDate, pricePerKgDisplay } from "@/lib/format";

export async function BuyerDashboard({ userId, name }: { userId: string; name: string }) {
  const [demands, listedLots, ordersAsBuyer, paymentsOwed] = await Promise.all([
    prisma.buyerDemand.findMany({
      where: { buyerId: userId, status: "ACTIVE" },
      include: { crop: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lot.findMany({
      where: { status: { in: ["LISTED", "OFFER_RECEIVED"] } },
      include: { crop: true, farmer: { select: { name: true } }, qualityReports: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.order.findMany({
      where: { buyerId: userId, status: { notIn: ["PAID", "CLOSED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.payment.findMany({ where: { payerId: userId, status: { in: ["PENDING", "OVERDUE"] } } }),
  ]);

  const myCrops = new Set(demands.map((d) => d.cropId));
  const matchedLots = listedLots.filter((l) => myCrops.has(l.cropId));
  const owed = paymentsOwed.reduce((s, p) => s + p.amount, 0);
  const activeOrderValue = ordersAsBuyer.reduce((s, o) => s + o.totalAmount - o.paidAmount, 0);

  return (
    <>
      <PageHeader title="Buyer Dashboard" subtitle="Source verified produce with confidence." />
      <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
        <span className="badge bg-brand-100 text-brand-800">🏭 {name}</span>
        <span className="badge bg-line/[0.06] text-ink-muted">Verified ✓</span>
        <span className="badge bg-line/[0.06] text-ink-muted">Payment score {94}/100</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon="package" label="Matched Lots" value={formatNum(matchedLots.length)} sub={`${formatNum(listedLots.length)} lots currently listed`} accent />
        <KpiCard icon="file" label="Active Requirements" value={formatNum(demands.length)} sub="Posted sourcing demands" />
        <KpiCard icon="truck" label="Open Orders" value={formatNum(ordersAsBuyer.length)} sub={`${formatNum(activeOrderValue)} outstanding value`} />
        <KpiCard icon="card" label="Payments Owed" value={rupees(owed)} sub={`${formatNum(paymentsOwed.length)} payment${paymentsOwed.length === 1 ? "" : "s"} due`} />
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mt-4">
        <Card className="card-pad lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Fresh lots matching your demand</h2>
            <Link href="/lots" className="text-xs font-semibold text-brand-700 hover:underline">Browse all →</Link>
          </div>
          {matchedLots.length === 0 ? (
            <EmptyState icon="package" title="No matching lots right now" body="Post a requirement and farmers near you will be matched." />
          ) : (
            <div className="divide-y divide-line/10">
              {matchedLots.map((l) => (
                <Link key={l.id} href={`/lots/${l.lotNo}`} className="py-3 flex items-center gap-3 group">
                  <span className="h-10 w-10 rounded-xl bg-brand-50 text-xl flex items-center justify-center">{l.crop.icon || "🌿"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-brand-700">
                      {l.crop.name} · Grade {l.grade} <span className="font-normal text-ink-muted">· {l.farmer.name}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatNum(l.quantityKg)} kg · {l.location} · quality {l.qualityScore}/100
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-brand-700">{pricePerKgDisplay(l.expectedPrice, 0)}</p>
                    <p className="text-[11px] text-ink-faint">expected</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="card-pad lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Your requirements</h2>
            <Link href="/buyers?post=1" className="btn-secondary !py-1.5 !px-3 !min-h-0 text-xs">+ Post demand</Link>
          </div>
          {demands.length === 0 ? (
            <p className="text-sm text-ink-muted">No active requirements.</p>
          ) : (
            <div className="space-y-3">
              {demands.map((d) => (
                <div key={d.id} className="rounded-xl border border-line/10 p-3">
                  <div className="flex justify-between items-center gap-2">
                    <p className="font-semibold text-sm">
                      {d.crop.icon} {formatNum(d.quantityKg)} kg {d.crop.name}
                    </p>
                    <Badge status="ACTIVE">Active</Badge>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    Grade {d.grade}
                    {d.maxPrice ? ` · max ${pricePerKgDisplay(d.maxPrice, 0)}` : ""} · {d.location}
                    {d.requiredBy ? ` · needed by ${fullDate(d.requiredBy)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {ordersAsBuyer.length > 0 ? (
        <Card className="card-pad mt-4">
          <h2 className="font-bold mb-3">Active orders</h2>
          <div className="space-y-2.5">
            {ordersAsBuyer.map((o) => (
              <Link key={o.id} href="/orders" className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2.5 hover:border-brand-300">
                <div>
                  <p className="text-sm font-semibold">{o.orderNo} · {o.cropName}</p>
                  <p className="text-xs text-ink-muted">{formatNum(o.quantityKg)} kg @ {pricePerKgDisplay(o.pricePerKg)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink">{rupees(o.totalAmount - o.paidAmount)} due</p>
                  <Badge status={o.status}>{o.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
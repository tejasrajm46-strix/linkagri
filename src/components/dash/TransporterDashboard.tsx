import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, PageHeader, KpiCard, Badge } from "@/components/ui";
import { formatNum, shortDate } from "@/lib/format";
import { SessionUser } from "@/lib/auth";

export async function TransporterDashboard({ user }: { user: SessionUser }) {
  const [open, mine, completed] = await Promise.all([
    prisma.logistics.findMany({
      where: { OR: [{ status: "PENDING" }, { status: "PICKUP_SCHEDULED", transporterId: null }] },
      include: { order: { include: { seller: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.logistics.findMany({
      where: { transporterId: user.id, status: { notIn: ["DELIVERED", "CANCELLED"] } },
      include: { order: { include: { seller: { select: { name: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.logistics.count({ where: { transporterId: user.id, status: "DELIVERED" } }),
  ]);

  return (
    <>
      <PageHeader title="Transporter Dashboard" subtitle="Pick up farm produce and deliver it on time." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon="bag" label="Open Jobs" value={formatNum(open.length)} sub="Waiting for a transporter" accent />
        <KpiCard icon="truck" label="My Active Jobs" value={formatNum(mine.length)} sub="Pickup to delivery" />
        <KpiCard icon="check" label="Completed Deliveries" value={formatNum(completed)} sub="All time" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card className="card-pad">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold">Open pickup jobs</h2>
            <Link href="/orders" className="text-xs font-semibold text-brand-700 hover:underline">Job board →</Link>
          </div>
          {open.length === 0 ? (
            <p className="text-sm text-ink-muted">No open jobs. New jobs appear when an order is accepted and pickup is requested.</p>
          ) : (
            <div className="space-y-2">
              {open.slice(0, 5).map((l) => (
                <div key={l.id} className="rounded-xl border border-line/10 p-3">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold">{l.order.orderNo} · {l.order.cropName}</p>
                    <Badge status="PENDING">Open</Badge>
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    {formatNum(l.order.quantityKg)} kg · {l.pickupLocation ?? l.order.pickupAddress} → {l.deliveryLocation ?? "Bengaluru"}
                  </p>
                  <Link href={`/orders?accept=${l.id}`} className="btn-primary !py-1.5 !px-3 !min-h-0 text-xs mt-2">
                    View &amp; accept
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <h2 className="font-bold mb-3">My jobs in progress</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing in progress right now.</p>
          ) : (
            <div className="space-y-2">
              {mine.map((l) => (
                <div key={l.id} className="rounded-xl border border-line/10 p-3 flex justify-between gap-2 items-start">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{l.order.orderNo} · {l.order.cropName}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {l.pickupLocation ?? l.order.pickupAddress} → {l.deliveryLocation}
                      {l.pickupTime ? ` · pickup ${shortDate(l.pickupTime)}` : ""}
                    </p>
                  </div>
                  <Badge status={l.status}>{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
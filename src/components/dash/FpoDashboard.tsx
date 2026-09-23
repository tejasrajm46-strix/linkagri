import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, PageHeader, KpiCard, Badge } from "@/components/ui";
import { rupees, formatNum } from "@/lib/format";
import { SessionUser } from "@/lib/auth";

export async function FpoDashboard({ user }: { user: SessionUser }) {
  const fpo = await prisma.fpo.findFirst({ where: { adminId: user.id }, include: { members: { include: { user: { select: { name: true } } } }, lots: { include: { crop: true } } } });
  if (!fpo) {
    return <PageHeader title="FPO Dashboard" subtitle="No FPO record found for this account." />;
  }
  const memberIds = fpo.members.map((m) => m.userId);
  const [memberLots, buyerDemands, orders, paidPayments, pendingPayments] = await Promise.all([
    prisma.lot.findMany({ where: { farmerId: { in: memberIds }, status: { in: ["LISTED", "OFFER_RECEIVED", "NEGOTIATING", "BOOKED"] } }, include: { crop: true, farmer: true } }),
    prisma.buyerDemand.count({ where: { status: "ACTIVE" } }),
    prisma.order.findMany({ where: { sellerId: { in: [...memberIds, user.id] } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", payeeId: { in: memberIds } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: { in: ["PENDING", "OVERDUE"] }, payeeId: { in: memberIds } } }),
  ]);
  const produceKg = memberLots.reduce((s, l) => s + l.quantityKg, 0);
  const pending = orders.filter((o) => ["PAYMENT_PENDING", "DELIVERED", "IN_TRANSIT", "PICKUP_SCHEDULED", "ACCEPTED"].includes(o.status));

  return (
    <>
      <PageHeader title="FPO Dashboard" subtitle="Aggregate member produce and negotiate bulk deals." />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard icon="users" label="Member Farmers" value={formatNum(fpo.members.length)} sub="Active members" accent />
        <KpiCard icon="package" label="Aggregated Produce" value={`${formatNum(produceKg)} kg`} sub={`${memberLots.length} active member lots`} />
        <KpiCard icon="bag" label="Buyer Demand" value={formatNum(buyerDemands)} sub="Active across markets" />
        <KpiCard icon="truck" label="Pending Orders" value={formatNum(pending.length)} sub="Awaiting delivery/payment" />
        <KpiCard icon="card" label="Total Sales (paid)" value={rupees(paidPayments._sum.amount ?? 0)} sub="Across members" />
        <KpiCard icon="clock" label="Pending Payments" value={rupees(pendingPayments._sum.amount ?? 0)} sub="To be collected" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card className="card-pad">
          <h2 className="font-bold mb-3">{fpo.name}</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <Link href="/lots" className="btn-primary">
              Create Bulk Lot
            </Link>
            <Link href="/buyers" className="btn-secondary">
              Find Buyers
            </Link>
          </div>
          <div className="flex items-center justify-between text-sm border-b border-line/10 pb-2 mb-2">
            <span className="text-ink-muted">Members</span>
            <span className="font-semibold">{formatNum(fpo.members.length)}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-b border-line/10 pb-2 mb-2">
            <span className="text-ink-muted">Verified</span>
            <span>{fpo.verified ? "✓ Yes" : "No"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">FPO lots live</span>
            <span className="font-semibold">{fpo.lots.filter((l) => l.status !== "SOLD").length}</span>
          </div>
        </Card>

        <Card className="card-pad">
          <h2 className="font-bold mb-3">Recent member lots</h2>
          {memberLots.slice(0, 6).length === 0 ? (
            <p className="text-sm text-ink-muted">No active member lots.</p>
          ) : (
            <div className="space-y-2">
              {memberLots.slice(0, 6).map((l) => (
                <div key={l.id} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {l.crop.icon} {l.crop.name} <span className="text-ink-muted font-normal">· {l.farmer.name}</span>
                    </p>
                    <p className="text-xs text-ink-muted">{formatNum(l.quantityKg)} kg · Grade {l.grade}</p>
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
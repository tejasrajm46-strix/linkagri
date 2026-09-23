import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, Badge, KpiCard } from "@/components/ui";
import { VerifyButton } from "@/components/VerifyButton";
import { DisputeStatusSelect } from "@/components/DisputeStatusSelect";
import { rupees, formatNum, timeAgo, fullDate, shortDate } from "@/lib/format";
import { Role } from "@prisma/client";

export const metadata = { title: "Admin Panel" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Non-admins never see this link in the nav, but a direct visit used to
  // throw the auth error during render (a 500). Send them to their own
  // dashboard instead.
  const user = await requireSession();
  if (user.role !== Role.ADMIN) redirect("/dashboard");

  const [
    farmers, fpos, buyers, transporters,
    activeLots, activeDemands, orders, openDisputes,
    verificationQueue, freshRows, highValue, suspiciousPayments,
    totalPaid, totalPending, paidOrderCount, avgPrice,
  ] = await Promise.all([
    prisma.user.count({ where: { role: Role.FARMER } }),
    prisma.user.count({ where: { role: Role.FPO } }),
    prisma.user.count({ where: { role: Role.BUYER } }),
    prisma.user.count({ where: { role: Role.TRANSPORTER } }),
    prisma.lot.count({ where: { status: { in: ["LISTED", "OFFER_RECEIVED", "NEGOTIATING"] } } }),
    prisma.buyerDemand.count({ where: { status: "ACTIVE" } }),
    prisma.order.count(),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "EVIDENCE_REQUESTED", "ESCALATED"] } } }),
    prisma.user.findMany({
      where: { verified: false, role: { not: Role.ADMIN } },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.marketPrice.findMany({ distinct: ["marketId"], select: { marketId: true, fetchedAt: true, source: true, market: { select: { name: true } } }, orderBy: { fetchedAt: "desc" } }),
    prisma.order.findMany({ where: { totalAmount: { gte: 30000 } }, orderBy: { totalAmount: "desc" }, take: 6, select: { orderNo: true, cropName: true, totalAmount: true, status: true, createdAt: true, buyer: { select: { name: true } }, seller: { select: { name: true } } } }),
    prisma.payment.findMany({ where: { status: { in: ["FAILED", "DISPUTED"] } }, take: 6, select: { id: true, amount: true, status: true, reference: true, order: { select: { orderNo: true } } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: { in: ["PENDING", "OVERDUE"] } } }),
    prisma.order.count({ where: { status: { in: ["PAID", "CLOSED"] } } }),
    prisma.marketPrice.aggregate({ _avg: { avgPrice: true } }),
  ]);

  const stale = freshRows.filter((r) => Date.now() - new Date(r.fetchedAt).getTime() > 36 * 3600000);

  const openDisputesList = await prisma.dispute.findMany({
    where: { status: { in: ["OPEN", "UNDER_REVIEW", "EVIDENCE_REQUESTED", "ESCALATED"] } },
    include: {
      raisedBy: { select: { name: true } },
      order: { select: { orderNo: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Admin Panel" subtitle="Verification, monitoring, analytics and dispute resolution." />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon="users" label="Registered Farmers" value={formatNum(farmers)} sub={`${formatNum(fpos)} FPOs`} accent />
        <KpiCard icon="bag" label="Verified Buyers" value={formatNum(buyers)} sub={`${formatNum(transporters)} transporters`} />
        <KpiCard icon="package" label="Active Lots" value={formatNum(activeLots)} sub={`${formatNum(activeDemands)} live demands`} />
        <KpiCard icon="truck" label="Orders" value={formatNum(orders)} sub={`${formatNum(paidOrderCount)} settled`} />
        <KpiCard icon="card" label="Settled Volume" value={rupees(totalPaid._sum.amount ?? 0)} sub="All payments paid" />
        <KpiCard icon="clock" label="Pending Settlement" value={rupees(totalPending._sum.amount ?? 0)} sub="Due to farmers" />
        <KpiCard icon="shield" label="Open Disputes" value={formatNum(openDisputes)} sub="Need attention" />
        <KpiCard icon="chart" label="Avg Mandi Price" value={avgPrice._avg.avgPrice ? `₹${avgPrice._avg.avgPrice.toFixed(1)}/kg` : "—"} sub="Across feed" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* verification queue */}
        <Card className="card-pad">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Verification queue</h2>
            <Badge status="OPEN">{verificationQueue.length} pending</Badge>
          </div>
          {verificationQueue.length === 0 ? (
            <p className="text-sm text-ink-muted">All users verified ✓</p>
          ) : (
            <div className="divide-y divide-line/10">
              {verificationQueue.map((u) => (
                <div key={u.id} className="py-2.5 flex items-center gap-3">
                  <span className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                    {u.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.name}</p>
                    <p className="text-xs text-ink-muted">
                      {u.role.toLowerCase()} · joined {shortDate(u.createdAt)}
                    </p>
                  </div>
                  <VerifyButton userId={u.id} verified={false} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* market data freshness */}
        <Card className="card-pad">
          <h2 className="font-bold mb-1">Market data freshness</h2>
          <p className="text-xs text-ink-muted mb-3">Every live value must carry its timestamp + source.</p>
          {stale.length > 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-2">
              ⚠ {stale.length} market feed{stale.length > 1 ? "s" : ""} older than 36 hours
            </p>
          ) : null}
          <div className="divide-y divide-line/10">
            {freshRows.map((r) => (
              <div key={r.marketId} className="py-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.market.name}</span>
                <span className="text-xs text-ink-muted">
                  {timeAgo(r.fetchedAt)} · {r.source}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* open disputes */}
        <Card className="card-pad">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Open disputes</h2>
            <Badge status="OPEN">{openDisputesList.length}</Badge>
          </div>
          {openDisputesList.length === 0 ? (
            <p className="text-sm text-ink-muted">No open disputes 🎉</p>
          ) : (
            <div className="space-y-2.5">
              {openDisputesList.map((d) => (
                <div key={d.id} className="rounded-xl border border-line/10 p-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        {d.disputeNo}{" "}
                        <span className="badge bg-line/[0.06] text-ink-muted ml-1">{d.type.replaceAll("_", " ").toLowerCase()}</span>
                      </p>
                      <p className="text-xs text-ink-muted mt-1 line-clamp-2">{d.description}</p>
                      <p className="text-[11px] text-ink-faint mt-1">
                        {d.raisedBy.name} · {d.order ? `order ${d.order.orderNo}` : "no order"} · {fullDate(d.createdAt)}
                      </p>
                    </div>
                    <DisputeStatusSelect dispute={{ id: d.id, status: d.status }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* high value + suspicious */}
        <Card className="card-pad">
          <h2 className="font-bold mb-3">High-value orders &amp; risk flags</h2>
          {highValue.length ? (
            <div className="space-y-1.5 mb-4">
              {highValue.map((o) => (
                <div key={o.orderNo} className="flex items-center justify-between text-sm rounded-lg border border-line/10 px-3 py-2">
                  <span className="font-semibold">{o.orderNo} <span className="text-ink-muted font-normal">· {o.cropName}</span></span>
                  <span className="text-ink-muted text-xs">{rupees(o.totalAmount)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {suspiciousPayments.length ? (
            <div>
              <p className="text-xs font-bold uppercase text-red-500 tracking-wide mb-1.5">Suspicious payments</p>
              <div className="space-y-1.5">
                {suspiciousPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm rounded-lg bg-red-50/60 px-3 py-2">
                    <span>{p.order?.orderNo ?? "—"} · {rupees(p.amount)}</span>
                    <Badge status={p.status}>{p.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">No failed/disputed payment flags.</p>
          )}
        </Card>
      </div>
      <p className="text-xs text-ink-faint mt-5">
        Audit trail: every verification, offer, order and dispute action is written to the audit log (see <code>audit_logs</code>).
      </p>
    </>
  );
}
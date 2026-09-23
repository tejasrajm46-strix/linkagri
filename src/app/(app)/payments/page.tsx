import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, Badge, EmptyState, KpiCard } from "@/components/ui";
import { PayButton } from "@/components/lotActions";
import { rupees, formatNum, fullDate, pricePerKgDisplay } from "@/lib/format";
import { Icon } from "@/components/icons";
import { Role } from "@prisma/client";

export const metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await requireSession();
  const isAdmin = user.role === Role.ADMIN;

  const payments = await prisma.payment.findMany({
    where: isAdmin ? {} : { OR: [{ payerId: user.id }, { payeeId: user.id }] },
    include: { order: { include: { seller: { select: { name: true } }, buyer: { select: { name: true } } } }, payer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const paid = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
  const pending = payments.filter((p) => ["PENDING", "OVERDUE", "PROCESSING"].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const iOwe = payments.filter((p) => p.payerId === user.id && ["PENDING", "OVERDUE"].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const iReceive = payments.filter((p) => p.payeeId === user.id && ["PENDING", "OVERDUE"].includes(p.status)).reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Every rupee, tracked — from order value to final settlement." />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard icon="card" label="Received (paid)" value={rupees(isAdmin ? paid : paid)} sub="All time" accent />
        <KpiCard icon="clock" label="Pending" value={rupees(pending)} sub="Awaiting settlement" />
        {!isAdmin ? (
          <>
            <KpiCard icon="arrowUp" label="I owe" value={rupees(iOwe)} sub="As buyer / payer" />
            <KpiCard icon="arrowDown" label="I receive" value={rupees(iReceive)} sub="As seller" />
          </>
        ) : null}
      </div>

      {payments.length === 0 ? (
        <EmptyState icon="card" title="No payments yet" body="Payments appear automatically when orders are delivered." />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const o = p.order;
            const mineAsBuyer = o.buyerId === user.id;
            return (
              <Card key={p.id} className="card-pad">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">
                      {o.orderNo} · {o.cropName} <span className="text-ink-muted font-medium">· {p.kind === "ADVANCE" ? "Advance" : "Final"}</span>
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {p.payer?.name ?? "—"} → {o.seller.name} · {formatNum(o.quantityKg)} kg @ {pricePerKgDisplay(o.pricePerKg)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-lg">{rupees(p.amount)}</p>
                    <p className="text-[11px] text-ink-faint">
                      {p.status === "PAID" ? `Paid ${p.paidAt ? fullDate(p.paidAt) : ""}${p.reference ? ` · ${p.reference}` : ""}` : p.dueDate ? `Due ${fullDate(p.dueDate)}` : "Awaiting payment"}
                    </p>
                  </div>
                  <Badge status={p.status}>{p.status}</Badge>
                  {mineAsBuyer ? (
                    <PayButton payment={{ id: p.id, amount: p.amount, orderNo: o.orderNo, status: p.status }} />
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                  <Icon name="shield" className="w-3.5 h-3.5 text-brand-600" />
                  {p.status === "PAID" ? "Settled — recorded in the seller's ledger." : "Not settled yet? Raise a payment grievance from the Disputes page."}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="card-pad mt-5 bg-brand-50/50">
        <p className="text-sm text-ink-muted">
          <strong className="text-ink">Demo note:</strong> AgriLink tracks payments end-to-end. In Phase 2 the “Pay” button connects to a real gateway (Razorpay/UPI). Payment status is always read from the order ledger — never fabricated.
        </p>
        <Link href="/disputes?order=1" className="text-xs font-semibold text-brand-700 underline mt-1 inline-block">
          Payment not received? Raise a grievance →
        </Link>
      </Card>
    </>
  );
}
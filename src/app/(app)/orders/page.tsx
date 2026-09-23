import { Icon } from "@/components/icons";
import { JobActions, PayButton, PickupButton } from "@/components/lotActions";
import { TimelineView } from "@/components/OrderTimeline";
import { Badge, Card, EmptyState, KpiCard, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatNum, fullDate, pricePerKgDisplay, rupees, shortDate } from "@/lib/format";
import { Role } from "@prisma/client";
import Link from "next/link";

export const metadata = { title: "Orders & Logistics" };
export const dynamic = "force-dynamic";

const include = {
  buyer: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  logistics: true,
  payments: true,
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ accept?: string }> }) {
  const user = await requireSession();
  const query = await searchParams;

  if (user.role === Role.TRANSPORTER) {
    const [openJobs, myJobs, doneCount] = await Promise.all([
      prisma.logistics.findMany({
        where: { OR: [{ status: "PENDING" }, { status: "PICKUP_SCHEDULED", transporterId: null }] },
        include: { order: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.logistics.findMany({
        where: { transporterId: user.id },
        include: { order: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } } },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.logistics.count({ where: { transporterId: user.id, status: "DELIVERED" } }),
    ]);
    const highlight = query.accept;

    return (
      <>
        <PageHeader title="Job Board" subtitle="Pickup and delivery jobs from accepted orders." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <KpiCard icon="bag" label="Open jobs" value={openJobs.length} sub="Claim one to start earning" accent />
          <KpiCard icon="truck" label="In progress" value={myJobs.filter((j) => j.status !== "DELIVERED" && j.status !== "CANCELLED").length} sub="You are handling these" />
          <KpiCard icon="check" label="Delivered" value={doneCount} sub="Completed deliveries" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <h2 className="font-bold mb-3 flex items-center gap-2"><Icon name="clock" className="w-4 h-4 text-brand-600" /> Open jobs</h2>
            <div className="space-y-3">
              {openJobs.length === 0 ? (
                <Card className="card-pad text-sm text-ink-muted">No open jobs right now.</Card>
              ) : (
                openJobs.map((l) => (
                  <Card key={l.id} className={`card-pad ${highlight === l.id ? "ring-2 ring-brand-500" : ""}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-bold">{l.order.orderNo} · {l.order.cropName} · {formatNum(l.order.quantityKg)} kg</p>
                        <p className="text-sm text-ink-muted mt-0.5">
                          {l.pickupLocation ?? l.order.pickupAddress} → {l.deliveryLocation ?? "Bengaluru"}
                        </p>
                        <p className="text-xs text-ink-faint mt-0.5">
                          Seller: {l.order.seller.name} · Value {rupees(l.order.totalAmount)} · Posted {shortDate(l.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge status="PENDING">Available</Badge>
                        <JobActions logistics={{ id: l.id, status: l.status, orderNo: l.order.orderNo, transporterId: l.transporterId }} />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="font-bold mb-3 flex items-center gap-2"><Icon name="truck" className="w-4 h-4 text-brand-600" /> My jobs</h2>
            <div className="space-y-3">
              {myJobs.length === 0 ? (
                <Card className="card-pad text-sm text-ink-muted">Nothing yet — accept an open job to begin.</Card>
              ) : (
                myJobs.map((l) => (
                  <Card key={l.id} className="card-pad">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-bold">{l.order.orderNo} · {l.order.cropName} · {formatNum(l.order.quantityKg)} kg</p>
                        <p className="text-sm text-ink-muted mt-0.5">{l.pickupLocation ?? l.order.pickupAddress} → {l.deliveryLocation}</p>
                        {l.vehicleNumber ? <p className="text-xs text-ink-faint mt-0.5">Vehicle {l.vehicleNumber}</p> : null}
                        {l.damageInfo ? <p className="text-xs text-amber-600 mt-1">⚠ {l.damageInfo}</p> : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge status={l.status}>{l.status}</Badge>
                        <JobActions logistics={{ id: l.id, status: l.status, orderNo: l.order.orderNo, transporterId: l.transporterId }} />
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const isAdmin = user.role === Role.ADMIN;
  const orders = await prisma.order.findMany({
    where: isAdmin
      ? {}
      : {
          OR: [{ sellerId: user.id }, { buyerId: user.id }],
        },
    include,
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const activeOrders = orders.filter((o) => !["PAID", "CLOSED", "CANCELLED"].includes(o.status));
  const pendingValue = orders.reduce((s, o) => s + Math.max(o.totalAmount - o.paidAmount, 0), 0);

  return (
    <>
      <PageHeader
        title="Orders & Logistics"
        subtitle={isAdmin ? "Every order on the platform." : "Track orders from offer acceptance to delivery and payment."}
      />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard icon="truck" label="Active orders" value={formatNum(activeOrders.length)} accent />
        <KpiCard icon="package" label="Total orders" value={formatNum(orders.length)} />
        <KpiCard icon="card" label="Outstanding" value={rupees(pendingValue)} sub="Still to be paid" />
        <KpiCard icon="check" label="Completed" value={orders.filter((o) => ["PAID", "CLOSED"].includes(o.status)).length} />
      </div>

      {orders.length === 0 ? (
        <EmptyState icon="truck" title="No orders yet" body="Accept an offer on one of your lots and the order will appear here with its full timeline." />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const logi = o.logistics[0];
            const payments = o.payments;
            const timeline = (o.timeline as { status: string; at?: string; note?: string }[]) ?? [];
            const mineAsSeller = o.sellerId === user.id;
            const mineAsBuyer = o.buyerId === user.id;
            const canPickup = mineAsSeller && ["ACCEPTED", "PICKUP_SCHEDULED"].includes(o.status) && logi?.status === "PENDING";
            return (
              <Card key={o.id} className="card-pad">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
                      <Icon name={o.cropName.toLowerCase().includes("tomato") ? "chart" : "package"} className="w-5 h-5 text-brand-600" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold">{o.orderNo} <span className="font-medium text-ink-muted">· {o.cropName} · {formatNum(o.quantityKg)} kg</span></p>
                      <p className="text-xs text-ink-muted truncate">
                        {o.seller.name} → {o.buyer.name} · created {fullDate(o.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-ink">{pricePerKgDisplay(o.pricePerKg)}</p>
                    <p className="text-xs text-ink-muted">Total {rupees(o.totalAmount)}</p>
                  </div>
                  <Badge status={o.status}>{o.status}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {payments.length ? (
                    <span className={`text-xs font-semibold ${o.paidAmount >= o.totalAmount ? "text-emerald-600" : "text-orange-600"}`}>
                      {rupees(o.paidAmount)} paid · {rupees(o.totalAmount - o.paidAmount)} pending
                    </span>
                  ) : null}
                  {logi ? (
                    <span className="text-xs text-ink-muted">
                      🚚 {logi.status === "PENDING" ? "Transporter requested" : `${logi.status.replaceAll("_", " ").toLowerCase()}${logi.vehicleNumber ? ` · ${logi.vehicleNumber}` : ""}`}
                    </span>
                  ) : null}
                  <div className="ml-auto flex gap-2 flex-wrap">
                    {canPickup ? <PickupButton orderNo={o.orderNo} /> : null}
                    {mineAsBuyer && o.status === "PAYMENT_PENDING" ? (
                      payments.filter((p) => p.status === "PENDING").map((p) => (
                        <PayButton key={p.id} payment={{ id: p.id, amount: p.amount, orderNo: o.orderNo, status: p.status }} />
                      ))
                    ) : null}
                    {mineAsBuyer && (o.status === "DELIVERED" || o.status === "PAYMENT_PENDING") ? (
                      <Link href="/disputes?order=1" className="btn-soft-danger !py-1.5 !px-3 !min-h-0 text-xs">Raise issue</Link>
                    ) : null}
                  </div>
                </div>

                <details className="mt-3 group">
                  <summary className="cursor-pointer text-xs font-semibold text-brand-700 list-none flex items-center gap-1">
                    <Icon name="chevron" className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" /> Status timeline
                  </summary>
                  <div className="mt-3 grid sm:grid-cols-2 gap-6">
                    <TimelineView timeline={timeline} current={o.status} />
                    {payments.length ? (
                      <div>
                        <p className="font-bold text-sm mb-2">Payments</p>
                        <div className="space-y-2">
                          {payments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-sm rounded-lg border border-line/10 px-3 py-2">
                              <div>
                                <p className="font-semibold">{p.kind} · {rupees(p.amount)}</p>
                                <p className="text-xs text-ink-faint">{p.status === "PAID" ? `Paid ${p.paidAt ? shortDate(p.paidAt) : ""}${p.reference ? ` · ${p.reference}` : ""}` : p.dueDate ? `Due ${fullDate(p.dueDate)}` : ""}</p>
                              </div>
                              <Badge status={p.status}>{p.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
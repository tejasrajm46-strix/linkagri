import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { DisputeModalForQuery } from "@/components/DisputeBridge";
import { DisputeStatusSelect } from "@/components/DisputeStatusSelect";
import { fullDate } from "@/lib/format";
import { Role } from "@prisma/client";

export const metadata = { title: "Grievances" };
export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const user = await requireSession();
  const isAdmin = user.role === Role.ADMIN;

  const [disputes, myOrders] = await Promise.all([
    prisma.dispute.findMany({
      where: isAdmin ? {} : { raisedById: user.id },
      include: {
        raisedBy: { select: { name: true, role: true } },
        order: { select: { orderNo: true, totalAmount: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: isAdmin ? {} : { OR: [{ sellerId: user.id }, { buyerId: user.id }] },
      select: { id: true, orderNo: true },
      take: 30,
    }),
  ]);

  const open = disputes.filter((d) => ["OPEN", "UNDER_REVIEW", "EVIDENCE_REQUESTED", "ESCALATED"].includes(d.status)).length;

  return (
    <>
      <PageHeader
        title="Grievances & Disputes"
        subtitle="Raise an issue — payment, quality, quantity, delivery, damage — and track it to resolution."
        actions={
          isAdmin ? null : (
            <Link href="/disputes?new=1" className="btn-primary">+ Raise grievance</Link>
          )
        }
      />
      <DisputeModalForQuery orders={myOrders} />

      {isAdmin ? (
        <p className="text-sm text-ink-muted mb-4">
          <Badge status="OPEN"> {open} open</Badge> Admin view — all disputes on the platform.
        </p>
      ) : null}

      {disputes.length === 0 ? (
        <EmptyState icon="shield" title="No grievances" body="When something goes wrong — payment delayed, quality mismatch, damage in transit — raise a grievance here and AgriLink's team steps in." />
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <Card key={d.id} className="card-pad">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold">{d.disputeNo}</p>
                    <Badge status={d.status}>{d.status}</Badge>
                    <span className="badge bg-line/[0.06] text-ink-muted">{d.type.replaceAll("_", " ").toLowerCase()}</span>
                  </div>
                  <p className="text-sm mt-2 text-ink">{d.description}</p>
                  <p className="text-xs text-ink-faint mt-2">
                    Raised by {d.raisedBy.name} ({d.raisedBy.role.toLowerCase()})
                    {d.order ? ` · order ${d.order.orderNo}` : ""} · {fullDate(d.createdAt)}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="flex flex-col items-end gap-2">
                    <DisputeStatusSelect dispute={{ id: d.id, status: d.status }} />
                    {d.resolution ? (
                      <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 max-w-[260px]">✓ {d.resolution}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-right">
                    {d.resolution ? (
                      <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">Resolution: {d.resolution}</p>
                    ) : d.status === "OPEN" ? (
                      <p className="text-xs text-ink-faint">Under review by AgriLink team</p>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}


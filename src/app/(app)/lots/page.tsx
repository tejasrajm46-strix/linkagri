import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, Badge, EmptyState, KpiCard } from "@/components/ui";
import { CreateLotModalForQuery } from "@/components/lotActions";
import { formatNum, shortDate, fullDate, pricePerKgDisplay } from "@/lib/format";
import { Role } from "@prisma/client";

export const metadata = { title: "My Lots" };
export const dynamic = "force-dynamic";

export default async function LotsPage() {
  const user = await requireSession();

  if (user.role === Role.TRANSPORTER) redirect("/orders");

  const crops = await prisma.crop.findMany({ orderBy: { name: "asc" } });

  if (user.role === Role.BUYER) {
    const lots = await prisma.lot.findMany({
      where: { status: { in: ["LISTED", "OFFER_RECEIVED"] } },
      include: { crop: true, farmer: { select: { name: true } }, offers: { where: { buyerId: user.id }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    return (
      <>
        <PageHeader title="Marketplace Lots" subtitle="Verified lots you can bid on." />
        {lots.length === 0 ? (
          <EmptyState icon="package" title="No lots available" />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {lots.map((l) => (
              <Card key={l.id} className="card-pad">
                <div className="flex justify-between items-start gap-2">
                  <p className="font-bold">
                    {l.crop.icon} {l.crop.name} · Grade {l.grade}
                  </p>
                  <Badge status="LISTED">Listed</Badge>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {l.farmer.name} · {l.location} · avail {shortDate(l.availableDate)}
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-sm mt-3">
                  <div className="rounded-lg bg-line/[0.06] py-2"><p className="text-xs text-ink-faint">Qty</p><p className="font-semibold">{formatNum(l.quantityKg)} kg</p></div>
                  <div className="rounded-lg bg-line/[0.06] py-2"><p className="text-xs text-ink-faint">Expected</p><p className="font-semibold">{pricePerKgDisplay(l.expectedPrice, 0)}</p></div>
                  <div className="rounded-lg bg-line/[0.06] py-2"><p className="text-xs text-ink-faint">Quality</p><p className="font-semibold text-emerald-600">{l.qualityScore}/100</p></div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link href={`/lots/${l.lotNo}`} className="btn-ghost flex-1 border border-line/15">Details</Link>
                  <Link href={`/lots/${l.lotNo}?offer=1`} className="btn-primary flex-1">Make offer</Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </>
    );
  }

  // seller / FPO / admin
  const isAdmin = user.role === Role.ADMIN;
  const lots = await prisma.lot.findMany({
    where: isAdmin ? {} : { farmerId: user.id },
    include: {
      crop: true,
      farmer: { select: { name: true } },
      offers: { orderBy: { createdAt: "desc" }, take: 3 },
      qualityReports: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const active = lots.filter((l) => ["LISTED", "OFFER_RECEIVED", "NEGOTIATING"].includes(l.status));
  const soldKg = lots.filter((l) => l.status === "SOLD").reduce((s, l) => s + l.quantityKg, 0);
  const liveKg = lots.filter((l) => l.status === "LISTED").reduce((s, l) => s + l.quantityKg, 0);
  const openOffers = lots.reduce((s, l) => s + l.offers.filter((o) => ["SUBMITTED", "COUNTERED"].includes(o.status)).length, 0);

  return (
    <>
      <PageHeader
        title={isAdmin ? "All Lots" : "My Lots"}
        subtitle="Publish produce, receive offers and negotiate."
        actions={
          isAdmin ? null : (
            <Link href="/lots?new=1" className="btn-primary">
              + Create Lot
            </Link>
          )
        }
      />
      <CreateLotModalForQuery crops={crops.map((c) => ({ id: c.id, name: c.name, icon: c.icon, unit: c.unit }))} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard icon="package" label="Active lots" value={active.length} sub={`${formatNum(liveKg)} kg live`} accent />
        <KpiCard icon="handshake" label="Open offers" value={openOffers} sub="Awaiting your decision" />
        <KpiCard icon="check" label="Sold lots" value={lots.filter((l) => l.status === "SOLD").length} sub={`${formatNum(soldKg)} kg sold`} />
      </div>

      {lots.length === 0 ? (
        <EmptyState icon="package" title="No lots yet" body="Create your first lot to start receiving offers from verified buyers." />
      ) : (
        <div className="space-y-3">
          {lots.map((l) => {
            const topOffer = l.offers.find((o) => ["SUBMITTED", "COUNTERED"].includes(o.status));
            return (
              <Card key={l.id} className="card-pad">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="h-11 w-11 rounded-xl bg-brand-50 text-2xl flex items-center justify-center shrink-0">{l.crop.icon || "🌿"}</span>
                    <div className="min-w-0">
                      <p className="font-bold flex items-center gap-2 flex-wrap">
                        <Link href={`/lots/${l.lotNo}`} className="hover:text-brand-700">{l.lotNo}</Link>
                        <span className="text-sm font-medium text-ink-muted">{l.crop.name} · Grade {l.grade}</span>
                      </p>
                      <p className="text-xs text-ink-muted truncate">
                        {formatNum(l.quantityKg)} kg · {l.location} · harvested {l.harvestDate ? shortDate(l.harvestDate) : "—"} · quality {l.qualityScore}/100
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm text-ink-faint">Expected</p>
                      <p className="font-bold text-brand-700">{pricePerKgDisplay(l.expectedPrice, 0)}</p>
                    </div>
                    <Badge status={l.status}>{l.status}</Badge>
                    {topOffer ? (
                      <span className="badge bg-blue-50 text-blue-700 hidden sm:inline-flex">Top offer ₹{topOffer.pricePerKg}/kg</span>
                    ) : null}
                    <Link href={`/lots/${l.lotNo}`} className="btn-secondary !py-1.5 !px-3 !min-h-0 text-xs">
                      View
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
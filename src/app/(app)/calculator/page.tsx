"use client";

import React, { useMemo, useState } from "react";
import { PageHeader, Card } from "@/components/ui";
import { computeNetRealisation } from "@/lib/netRealisation";
import { rupees } from "@/lib/format";

const DEFAULT_MARKET_PRICES: { label: string; avg: number }[] = [
  { label: "APMC Ramanagara (today)", avg: 30 },
  { label: "APMC Bengaluru (today)", avg: 27 },
  { label: "APMC Mysuru (today)", avg: 26 },
];

export default function CalculatorPage() {
  const [price, setPrice] = useState("32");
  const [qty, setQty] = useState("1200");
  const [transport, setTransport] = useState("1500");
  const [handling, setHandling] = useState("400");
  const [commission, setCommission] = useState("2");
  const [storage, setStorage] = useState("0");
  const [loss, setLoss] = useState("2");

  const r = useMemo(
    () =>
      computeNetRealisation({
        pricePerKg: Number(price) || 0,
        quantityKg: Number(qty) || 0,
        transport: Number(transport) || 0,
        handling: Number(handling) || 0,
        commissionPct: Number(commission) || 0,
        storage: Number(storage) || 0,
        lossPct: Number(loss) || 0,
      }),
    [price, qty, transport, handling, commission, storage, loss]
  );

  const compare = useMemo(
    () =>
      DEFAULT_MARKET_PRICES.map((m) => ({
        ...m,
        ...computeNetRealisation({
          pricePerKg: m.avg,
          quantityKg: Number(qty) || 0,
          transport: Number(transport) || 0,
          handling: Number(handling) || 0,
          commissionPct: Number(commission) || 0,
          storage: Number(storage) || 0,
          lossPct: Number(loss) || 0,
        }),
      })),
    [qty, transport, handling, commission, storage, loss]
  );

  const row = (k: string, v: React.ReactNode, cls = "") => (
    <div className={`flex items-center justify-between py-2 ${cls}`}>
      <span className="text-sm text-ink-muted">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Net Realisation Calculator"
        subtitle="Never compare only the selling price — see the true price after transport, fees and loss."
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="card-pad">
          <h2 className="font-bold mb-4">Sale details</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="label">Selling price (₹/kg)</span>
              <input className="input" type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Quantity (kg)</span>
              <input className="input" type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Transport cost (₹)</span>
              <input className="input" type="number" min={0} value={transport} onChange={(e) => setTransport(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Loading / unloading (₹)</span>
              <input className="input" type="number" min={0} value={handling} onChange={(e) => setHandling(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Commission (% of gross)</span>
              <input className="input" type="number" min={0} step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Storage (₹)</span>
              <input className="input" type="number" min={0} value={storage} onChange={(e) => setStorage(e.target.value)} />
            </label>
            <label className="block col-span-2">
              <span className="label">Expected post-harvest loss (% of gross)</span>
              <input className="input" type="number" min={0} step="0.5" value={loss} onChange={(e) => setLoss(e.target.value)} />
            </label>
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint mb-2">Try a market price</p>
            {compare.map((c) => (
              <button key={c.label} onClick={() => setPrice(String(c.avg))} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-brand-50 border border-line/10">
                <span>{c.label}</span>
                <span className="font-bold text-brand-700">₹{c.avg}/kg → net ₹{c.netPerKg.toFixed(1)}/kg</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="card-pad">
          <h2 className="font-bold mb-1">Net realisation breakdown</h2>
          <p className="text-xs text-ink-muted mb-3">Gross sale value → deductions → final net</p>
          <div className="divide-y divide-line/10">
            {row("Gross sale value", rupees(r.gross))}
            {row("Transport cost", `− ${rupees(r.transport)}`, "text-red-500")}
            {row("Loading / unloading", `− ${rupees(r.handling)}`, "text-red-500")}
            {r.commission > 0 ? row("Commission", `− ${rupees(r.commission)}`, "text-red-500") : null}
            {r.storage > 0 ? row("Storage", `− ${rupees(r.storage)}`, "text-red-500") : null}
            {r.loss > 0 ? row("Expected loss", `− ${rupees(r.loss)}`, "text-red-500") : null}
          </div>
          <div className="mt-4 rounded-2xl bg-brand-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Final net realisation</p>
                <p className="text-3xl font-extrabold mt-0.5">{rupees(r.net)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/70">Net price</p>
                <p className="text-3xl font-extrabold mt-0.5">₹{r.netPerKg.toFixed(2)}/kg</p>
              </div>
            </div>
          </div>

          <h2 className="font-bold mt-5 mb-2">Compare options (same quantity & costs)</h2>
          <div className="space-y-2">
            {compare.map((c) => (
              <div key={c.label} className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2.5 text-sm">
                <span className="text-ink-muted">{c.label} <span className="text-ink-faint">(₹{c.avg}/kg)</span></span>
                <span className="font-bold text-brand-700">₹{c.netPerKg.toFixed(1)}/kg · {rupees(c.net)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-ink-faint">
            This is the AgriLink differentiator: mandis quote ₹/kg, AgriLink shows what actually reaches your pocket.
          </p>
        </Card>
      </div>
    </>
  );
}
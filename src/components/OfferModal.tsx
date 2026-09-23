"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui";

export function OfferModal({
  lot,
  onClose,
}: {
  lot: { lotNo: string; crop: string; quantityKg: number; grade: string; expectedPrice: number; farmerName: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(String(lot.expectedPrice));
  const [qty, setQty] = useState(String(lot.quantityKg));
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/lots/${lot.lotNo}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePerKg: Number(price), quantityKg: Number(qty), message }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.message || "Could not send offer");
        setBusy(false);
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Make offer — ${lot.lotNo}`} footer={
      done ? (
        <button onClick={onClose} className="btn-primary">Done</button>
      ) : (
        <>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button form="offer-form" type="submit" disabled={busy} className="btn-primary">{busy ? "Sending…" : "Send Offer"}</button>
        </>
      )
    }>
      {done ? (
        <div className="text-center py-6">
          <p className="text-4xl">🤝</p>
          <p className="font-bold mt-2 text-ink">Offer sent to {lot.farmerName}</p>
          <p className="text-sm text-ink-muted mt-1">The farmer will review it and can accept, counter or reject.</p>
        </div>
      ) : (
        <form id="offer-form" onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-brand-50 p-3 text-sm">
            {lot.crop} · {lot.quantityKg.toLocaleString("en-IN")} kg · Grade {lot.grade} · {lot.farmerName}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Offer price (₹/kg)">
              <input className="input" type="number" min={1} step="0.5" required value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Quantity (kg)">
              <input className="input" type="number" min={1} required max={lot.quantityKg} value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
          </div>
          <Field label="Message (optional)">
            <textarea className="input" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Can take full lot, pickup tomorrow, payment in 2 days." />
          </Field>
          {error ? <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
          <p className="text-xs text-ink-faint">Sent offers appear to the farmer instantly and expire in 48 hours.</p>
        </form>
      )}
    </Modal>
  );
}
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui";

const TYPES = [
  { v: "PAYMENT_ISSUE", l: "Payment issue" },
  { v: "QUANTITY_MISMATCH", l: "Quantity mismatch" },
  { v: "QUALITY_DISPUTE", l: "Quality dispute" },
  { v: "DELIVERY_PROBLEM", l: "Delivery problem" },
  { v: "PRICE_OFFER_DISPUTE", l: "Price / offer dispute" },
  { v: "DAMAGE_LOSS", l: "Damage / loss" },
  { v: "MISCONDUCT", l: "Buyer / seller misconduct" },
];

export function DisputeModal({ orders, onClose }: { orders: { id: string; orderNo: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState("PAYMENT_ISSUE");
  const [orderId, setOrderId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/disputes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, orderId: orderId || undefined, description }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.message || "Could not raise grievance");
      setBusy(false);
      return;
    }
    setDone(true);
    router.refresh();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Raise a grievance"
      footer={
        done ? (
          <button onClick={onClose} className="btn-primary">Done</button>
        ) : (
          <>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button form="dispute-form" type="submit" disabled={busy} className="btn-primary">{busy ? "Submitting…" : "Submit grievance"}</button>
          </>
        )
      }
    >
      {done ? (
        <div className="text-center py-6">
          <p className="text-4xl">🛡️</p>
          <p className="font-bold mt-2 text-ink">Grievance registered</p>
          <p className="text-sm text-ink-muted mt-1">Status is OPEN. Our team will review it and may request evidence.</p>
        </div>
      ) : (
        <form id="dispute-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue type">
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>{t.l}</option>
                ))}
              </select>
            </Field>
            <Field label="Related order (optional)">
              <select className="select" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                <option value="">— select order —</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.orderNo}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Describe the issue">
            <textarea className="input" rows={4} required minLength={10} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened? Include dates, quantities and amounts." />
          </Field>
          <p className="text-xs text-ink-faint">You can attach photos/documents later — uploads are stored securely and reviewed by the admin team.</p>
          {error ? <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
        </form>
      )}
    </Modal>
  );
}
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui";

type Crop = { id: string; name: string; icon: string; unit: string };

export function DemandModal({ crops, onClose }: { crops: Crop[]; onClose: () => void }) {
  const router = useRouter();
  const [cropId, setCropId] = useState(crops[0]?.id ?? "");
  const [qty, setQty] = useState("2000");
  const [grade, setGrade] = useState("A");
  const [maxPrice, setMaxPrice] = useState("32");
  const [location, setLocation] = useState("Bengaluru");
  const [requiredBy, setRequiredBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch("/api/buyers/demand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropId, quantityKg: Number(qty), grade, maxPrice: Number(maxPrice) || null, location, requiredBy: requiredBy || null }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.message || "Could not post requirement");
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
      title="Post a sourcing requirement"
      footer={
        done ? (
          <button onClick={onClose} className="btn-primary">Done</button>
        ) : (
          <>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button form="demand-form" type="submit" disabled={busy} className="btn-primary">{busy ? "Posting…" : "Post requirement"}</button>
          </>
        )
      }
    >
      {done ? (
        <div className="text-center py-6">
          <p className="text-4xl">📢</p>
          <p className="font-bold mt-2 text-ink">Requirement is live</p>
          <p className="text-sm text-ink-muted mt-1">Farmers with matching produce are notified and can send you offers.</p>
        </div>
      ) : (
        <form id="demand-form" onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Crop">
              <select className="select" value={cropId} onChange={(e) => setCropId(e.target.value)}>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Quantity (kg)">
              <input className="input" type="number" min={1} required value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Grade">
              <select className="select" value={grade} onChange={(e) => setGrade(e.target.value)}>
                {["A", "B", "C", "Any"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Max price (₹/kg)">
              <input className="input" type="number" min={1} step="0.5" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </Field>
            <Field label="Delivery location">
              <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
            <Field label="Required by">
              <input className="input" type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
            </Field>
          </div>
          {error ? <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
          <p className="text-xs text-ink-faint">Posting is free and instantly visible to matching farmers/FPOs.</p>
        </form>
      )}
    </Modal>
  );
}
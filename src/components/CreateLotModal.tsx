"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Field } from "./ui";

type Crop = { id: string; name: string; icon: string; unit: string };

export function CreateLotModal({ crops, onClose, defaultCropId }: { crops: Crop[]; onClose: () => void; defaultCropId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    cropId: defaultCropId ?? crops[0]?.id ?? "",
    variety: "",
    quantityKg: "1200",
    grade: "A",
    qualityScore: "85",
    location: "Ramanagara",
    expectedPrice: "32",
    minPrice: "28",
    harvestDate: "",
    availableDate: "",
    packaging: "Plastic crates (20 kg)",
    notes: "",
    photoUrl: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const today = new Date();
    setForm((f) => ({
      ...f,
      harvestDate: f.harvestDate || today.toISOString().slice(0, 10),
      availableDate: f.availableDate || today.toISOString().slice(0, 10),
    }));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropId: form.cropId,
          variety: form.variety,
          quantityKg: Number(form.quantityKg),
          grade: form.grade,
          qualityScore: Number(form.qualityScore),
          location: form.location,
          expectedPrice: Number(form.expectedPrice),
          minPrice: Number(form.minPrice),
          harvestDate: form.harvestDate,
          availableDate: form.availableDate,
          packaging: form.packaging,
          notes: form.notes,
          photos: form.photoUrl ? [form.photoUrl] : [],
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.message || "Could not create lot");
        setBusy(false);
        return;
      }
      router.push(`/lots/${j.lot.lotNo}`);
      router.refresh();
    } catch {
      setError("Network error");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Create produce lot"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button form="lot-form" type="submit" disabled={busy} className="btn-primary">{busy ? "Publishing…" : "Publish Lot"}</button>
        </>
      }
    >
      <form id="lot-form" onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Crop">
            <select className="select" value={form.cropId} onChange={set("cropId")}>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Variety">
            <input className="input" value={form.variety} onChange={set("variety")} placeholder="e.g. Rashmi (Hybrid)" />
          </Field>
          <Field label={`Quantity (kg)`}>
            <input className="input" type="number" min={1} required value={form.quantityKg} onChange={set("quantityKg")} />
          </Field>
          <Field label="Grade">
            <select className="select" value={form.grade} onChange={set("grade")}>
              {["A", "B", "C"].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Quality score (self-declared)">
            <input className="input" type="number" min={0} max={100} value={form.qualityScore} onChange={set("qualityScore")} />
          </Field>
          <Field label="Location">
            <input className="input" value={form.location} onChange={set("location")} placeholder="Village / town" />
          </Field>
          <Field label="Expected price (₹/kg)">
            <input className="input" type="number" min={1} step="0.5" required value={form.expectedPrice} onChange={set("expectedPrice")} />
          </Field>
          <Field label="Minimum price (₹/kg)">
            <input className="input" type="number" min={1} step="0.5" required value={form.minPrice} onChange={set("minPrice")} />
          </Field>
          <Field label="Harvest date">
            <input className="input" type="date" value={form.harvestDate} onChange={set("harvestDate")} />
          </Field>
          <Field label="Available date">
            <input className="input" type="date" value={form.availableDate} onChange={set("availableDate")} />
          </Field>
          <Field label="Packaging">
            <input className="input" value={form.packaging} onChange={set("packaging")} />
          </Field>
          <Field label="Photo URL (optional)">
            <input className="input" value={form.photoUrl} onChange={set("photoUrl")} placeholder="https://…" />
          </Field>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} placeholder="Freshness, storage advice, buyer notes…" />
        </Field>
        {error ? <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
        <p className="text-xs text-ink-faint">
          A unique lot ID is generated on publish. Listed lots are immediately visible to matched verified buyers.
        </p>
      </form>
    </Modal>
  );
}
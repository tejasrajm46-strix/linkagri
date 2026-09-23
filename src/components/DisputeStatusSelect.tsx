"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["OPEN", "UNDER_REVIEW", "EVIDENCE_REQUESTED", "RESOLVED", "ESCALATED", "CLOSED"];

export function DisputeStatusSelect({ dispute }: { dispute: { id: string; status: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (status: string) => {
    setBusy(true);
    setError(null);
    let resolution: string | undefined;
    if (status === "RESOLVED" || status === "CLOSED") {
      resolution = window.prompt("Resolution note (shown to the user):") ?? undefined;
    }
    const r = await fetch(`/api/disputes/${dispute.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(j.message || "Update failed");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        className="select !min-h-0 !py-1.5 text-xs w-40"
        value={dispute.status}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ").toLowerCase()}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
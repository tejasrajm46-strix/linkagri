"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function VerifyButton({ userId, verified }: { userId: string; verified: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !verified }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(j.message || "Failed");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button onClick={go} disabled={busy} className={`${verified ? "btn-soft-danger" : "btn-primary"} !py-1.5 !px-3 !min-h-0 text-xs`}>
        {busy ? "…" : verified ? "Unverify" : "✓ Verify"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
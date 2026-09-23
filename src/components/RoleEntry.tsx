"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_ENTRIES } from "@/lib/nav";

/**
 * Passwordless role entry. Picking a profile signs you in as the seeded account
 * for that role — there is nothing to type and no credential in this component.
 */
export function RoleEntry() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enter = async (role: string) => {
    setBusy(role);
    setError(null);
    try {
      const r = await fetch("/api/auth/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.message || "Could not open that profile. Please try again.");
        setBusy(null);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Is the server running?");
      setBusy(null);
    }
  };

  return (
    <div className="mt-5">
      <div className="grid gap-2">
        {ROLE_ENTRIES.map((r) => (
          <button
            key={r.role}
            onClick={() => enter(r.role)}
            disabled={busy !== null}
            className="flex items-center gap-3 rounded-xl border border-line/10 px-3 py-2.5 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60"
          >
            <span className="h-9 w-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center text-base shrink-0">
              {r.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{r.label}</span>
              <span className="block text-xs text-ink-faint truncate">{r.blurb}</span>
            </span>
            <span className="text-xs font-semibold text-brand-700 shrink-0">
              {busy === r.role ? "Opening…" : "Enter →"}
            </span>
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p> : null}
      <p className="mt-3 text-[11px] text-ink-faint">
        No password needed for this build — each profile opens the app with that role&apos;s own data.
      </p>
    </div>
  );
}

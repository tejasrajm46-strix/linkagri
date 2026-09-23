"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications", { method: "POST" });
        router.refresh();
      }}
      className="btn-secondary !py-1.5 !px-3 !min-h-0 text-xs"
    >
      Mark all read
    </button>
  );
}

export function MarkRead({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/notifications/${id}`, { method: "PATCH" });
        router.refresh();
      }}
      className="text-[11px] font-semibold text-ink-faint hover:text-brand-700"
    >
      Mark read
    </button>
  );
}
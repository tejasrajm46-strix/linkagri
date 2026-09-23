"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreateLotModal } from "./CreateLotModal";
import { OfferModal } from "./OfferModal";
import { Modal, Field } from "./ui";

type Crop = { id: string; name: string; icon: string; unit: string };

export function CreateLotModalForQuery({ crops }: { crops: Crop[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  if (sp.get("new") !== "1") return null;
  return (
    <CreateLotModal
      crops={crops}
      onClose={() => {
        router.replace("/lots");
        router.refresh();
      }}
    />
  );
}

export function OfferModalForLot({
  lot,
}: {
  lot: { lotNo: string; crop: string; quantityKg: number; grade: string; expectedPrice: number; farmerName: string };
}) {
  const sp = useSearchParams();
  const router = useRouter();
  if (sp.get("offer") !== "1") return null;
  return (
    <OfferModal
      lot={lot}
      onClose={() => {
        router.replace(`/lots/${lot.lotNo}`);
        router.refresh();
      }}
    />
  );
}

type OfferLite = {
  id: string;
  offerNo: string;
  quantityKg: number;
  pricePerKg: number;
  status: string;
  createdAt: string;
  buyerName: string;
  isCounter?: boolean;
};

export function OfferActions({ offer, isOwner }: { offer: OfferLite; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [countering, setCountering] = useState(false);
  const [price, setPrice] = useState(String(offer.pricePerKg));
  const [error, setError] = useState<string | null>(null);

  if (offer.status !== "SUBMITTED" && offer.status !== "COUNTERED") return null;
  const open = offer.status === "SUBMITTED" || offer.status === "COUNTERED";

  const act = async (action: "accept" | "reject" | "counter") => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/offers/${offer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, pricePerKg: action === "counter" ? Number(price) : undefined }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.message || "Action failed");
      setBusy(false);
      return;
    }
    setCountering(false);
    setBusy(false);
    router.refresh();
  };

  return (
    <div>
      {countering ? (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            step="0.5"
            className="input !w-32 !min-h-0 !py-1.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            autoFocus
          />
          <button onClick={() => act("counter")} disabled={busy} className="btn-secondary !py-1.5 !px-3 !min-h-0 text-xs">
            Send counter
          </button>
          <button onClick={() => setCountering(false)} className="btn-ghost !py-1.5 !px-3 !min-h-0 text-xs">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {isOwner && open ? (
            <>
              <button onClick={() => act("accept")} disabled={busy} className="btn-primary !py-1.5 !px-3 !min-h-0 text-xs">
                ✓ Accept
              </button>
              <button onClick={() => setCountering(true)} disabled={busy} className="btn-secondary !py-1.5 !px-3 !min-h-0 text-xs">
                ↺ Counter
              </button>
              <button onClick={() => act("reject")} disabled={busy} className="btn-soft-danger !py-1.5 !px-3 !min-h-0 text-xs">
                ✕ Reject
              </button>
            </>
          ) : null}
        </div>
      )}
      {error ? <p className="text-xs text-red-600 mt-1.5">{error}</p> : null}
    </div>
  );
}

/** Quick "arrange pickup" action on accepted orders (seller side). */
export function PickupButton({ orderNo, disabled }: { orderNo: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "requested" | "error">("idle");
  const go = async () => {
    setBusy(true);
    const r = await fetch(`/api/orders/${orderNo}/pickup`, { method: "POST" });
    const j = await r.json();
    setBusy(false);
    if (r.ok) {
      setState("requested");
      router.refresh();
    } else {
      setState("error");
    }
  };
  if (state === "requested") return <span className="badge bg-emerald-50 text-emerald-700">✓ Transporter requested</span>;
  return (
    <button onClick={go} disabled={busy || disabled} className="btn-secondary !py-1.5 !px-3 !min-h-0 text-xs">
      {busy ? "Requesting…" : "🚚 Arrange pickup"}
    </button>
  );
}

/** Transporter job actions: accept / status update. */
export function JobActions({
  logistics,
}: {
  logistics: { id: string; status: string; orderNo: string; transporterId: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (action: "accept" | "status", status?: string, note?: string) => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/logistics/${logistics.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, status, note }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) setError(j.message || "Failed");
    router.refresh();
  };

  const claimable = logistics.status === "PENDING" || (logistics.status === "PICKUP_SCHEDULED" && !logistics.transporterId);

  return (
    <div>
      {claimable ? (
        <button onClick={() => go("accept")} disabled={busy} className="btn-primary !py-1.5 !px-3 !min-h-0 text-xs">
          ✓ Accept job
        </button>
      ) : logistics.status === "PICKUP_SCHEDULED" ? (
        <button onClick={() => go("status", "PICKED_UP")} disabled={busy} className="btn-primary !py-1.5 !px-3 !min-h-0 text-xs">
          📦 Mark picked up
        </button>
      ) : logistics.status === "PICKED_UP" ? (
        <button onClick={() => go("status", "IN_TRANSIT")} disabled={busy} className="btn-primary !py-1.5 !px-3 !min-h-0 text-xs">
          🚚 Start transit
        </button>
      ) : logistics.status === "IN_TRANSIT" ? (
        <button
          onClick={() => {
            const note = window.prompt("Any damage / loss notes?") ?? undefined;
            go("status", "DELIVERED", note);
          }}
          disabled={busy}
          className="btn-primary !py-1.5 !px-3 !min-h-0 text-xs"
        >
          🏁 Mark delivered
        </button>
      ) : null}
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}

/** Pay a pending payment (buyer). */
export function PayButton({ payment }: { payment: { id: string; amount: number; orderNo: string; status: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (payment.status === "PAID") return null;
  const go = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/payments/${payment.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: `UPI-${Date.now().toString().slice(-5)}` }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setError(j.message || "Payment failed");
      return;
    }
    router.refresh();
  };
  return (
    <div>
      <button onClick={go} disabled={busy} className="btn-primary !py-1.5 !px-3 !min-h-0 text-xs">
        {busy ? "Processing…" : `Pay ${payment.amount.toLocaleString("en-IN")}`}
      </button>
      {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
    </div>
  );
}
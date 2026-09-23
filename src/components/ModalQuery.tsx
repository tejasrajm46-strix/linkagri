"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { OfferModal } from "./OfferModal";
import { DemandModal } from "./DemandModal";

type Crop = { id: string; name: string; icon: string; unit: string };
type LotLite = { lotNo: string; crop: string; quantityKg: number; grade: string; expectedPrice: number; farmerName: string };

/** Renders the offer modal when ?offer=<lotNo> is present. */
export function OfferModalForQuery({ lots }: { lots: LotLite[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const lotNo = sp.get("offer");
  const lot = lots.find((l) => l.lotNo === lotNo);
  if (!lot) return null;
  return (
    <OfferModal
      lot={lot}
      onClose={() => {
        router.replace("/buyers");
        router.refresh();
      }}
    />
  );
}

/** Renders the post-demand modal when ?post=1 is present. */
export function DemandModalForQuery({ crops }: { crops: Crop[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  if (sp.get("post") !== "1") return null;
  return (
    <DemandModal
      crops={crops}
      onClose={() => {
        router.replace("/buyers");
        router.refresh();
      }}
    />
  );
}
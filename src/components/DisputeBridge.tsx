"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DisputeModal } from "./DisputeModal";

export function DisputeModalForQuery({ orders }: { orders: { id: string; orderNo: string }[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  if (sp.get("new") !== "1") return null;
  return (
    <DisputeModal
      orders={orders}
      onClose={() => {
        router.replace("/disputes");
        router.refresh();
      }}
    />
  );
}
import { requireSession } from "@/lib/auth";
import { getPlannerView } from "@/lib/planner";
import { PlannerClient } from "@/components/planner/PlannerClient";
import { Role } from "@prisma/client";

export const metadata = { title: "Crop Planner" };
export const dynamic = "force-dynamic";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ crop?: string }> }) {
  const user = await requireSession();
  const query = await searchParams;
  const view = await getPlannerView(user, query.crop);
  const canEdit = user.role === Role.FARMER || user.role === Role.FPO || user.role === Role.ADMIN;

  // Keyed on the selected crop so switching a crop remounts the console with a
  // clean synthesis/selection state instead of merging two crops' details.
  return <PlannerClient key={view.panel.crop} view={view} canEdit={canEdit} />;
}

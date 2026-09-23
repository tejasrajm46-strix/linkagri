import { requireSession } from "@/lib/auth";
import { Role } from "@prisma/client";
import { FarmerDashboard } from "@/components/dash/FarmerDashboard";
import { BuyerDashboard } from "@/components/dash/BuyerDashboard";
import { FpoDashboard } from "@/components/dash/FpoDashboard";
import { TransporterDashboard } from "@/components/dash/TransporterDashboard";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireSession();
  if (user.role === Role.ADMIN) redirect("/admin");

  switch (user.role) {
    case Role.FARMER:
      return <FarmerDashboard userId={user.id} name={user.name} />;
    case Role.FPO:
      return <FpoDashboard user={user} />;
    case Role.BUYER:
      return <BuyerDashboard userId={user.id} name={user.name} />;
    case Role.TRANSPORTER:
      return <TransporterDashboard user={user} />;
    default:
      return <FarmerDashboard userId={user.id} name={user.name} />;
  }
}
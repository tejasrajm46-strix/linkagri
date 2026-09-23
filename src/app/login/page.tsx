import { Icon, Sprout } from "@/components/icons";
import { RoleEntry } from "@/components/RoleEntry";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Choose a role" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-10 items-center">
        {/* Brand / pitch side */}
        <div className="hidden md:block">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Sprout className="w-6 h-6" />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-brand-800 tracking-tight">AgriLink</p>
              <p className="text-sm text-ink-muted">Smart Farmer Market Intelligence</p>
            </div>
          </div>
          <h1 className="text-3xl font-bold leading-snug text-ink">
            Decide <span className="text-brand-600">where, when &amp; to whom</span> to sell — from farm gate to payment.
          </h1>
          <ul className="mt-6 space-y-3 text-sm text-ink-muted">
            {[
              "Live mandi prices, trends & market arrivals",
              "AI sell/hold advice with expected price range + confidence",
              "Net realisation — true price after transport, fees & loss",
              "Verified buyers, digital offers, tracked orders & payments",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 items-start">
                <span className="mt-0.5 text-brand-600">
                  <Icon name="check" className="w-4 h-4" />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-ink-faint">
            Demo build for SIH Problem Statement 26132 · Karnataka
          </p>
        </div>

        {/* Role entry card */}
        <div className="card card-pad !p-6 sm:!p-8">
          <div className="md:hidden flex items-center gap-2 mb-5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Sprout className="w-5 h-5" />
            </span>
            <p className="text-xl font-extrabold text-brand-800">AgriLink</p>
          </div>
          <h2 className="text-xl font-bold">Choose a role</h2>
          <p className="text-sm text-ink-muted mt-1">
            Open AgriLink as a farmer, buyer, transporter or admin.
          </p>

          <RoleEntry />
        </div>
      </div>
    </div>
  );
}

import { Icon, Sprout } from "@/components/icons";
import Link from "next/link";

export const metadata = {
  title: "From harvest to better decisions",
  description:
    "AgriLink gives farmers the market signal, buyer confidence and transaction trail to sell smarter.",
};

export default function Home() {
  return (
    <main className="landing-shell min-h-dvh overflow-hidden">
      <nav className="landing-nav mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="AgriLink home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
            <Sprout className="h-5 w-5" />
          </span>
          <span className="text-xl font-black tracking-tight text-ink">AgriLink</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted sm:inline">Built for better farm-gate decisions</span>
          <Link href="/login" className="landing-nav-link">Open demo</Link>
        </div>
      </nav>

      <section className="landing-hero mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20 lg:pb-28 lg:pt-20">
        <div className="relative z-10">
          <p className="landing-kicker">Market intelligence for the people who grow it</p>
          <h1 className="mt-5 max-w-xl text-5xl font-black leading-[0.98] tracking-[-0.045em] text-ink sm:text-6xl lg:text-[78px]">
            Sell with a clearer view of the field.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-ink-muted sm:text-xl">
            AgriLink connects live mandi signals, grounded AI advice and trusted trade workflows so every harvest can move with more confidence.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/login" className="landing-primary-btn">
              Explore the demo <Icon name="arrow-up-right" className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="landing-text-link">See how it works</a>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 border-t border-line/10 pt-5 text-sm text-ink-muted">
            <span><strong className="text-ink">5</strong> role-based workspaces</span>
            <span><strong className="text-ink">1</strong> connected trade loop</span>
            <span><strong className="text-ink">0</strong> credentials in the demo</span>
          </div>
        </div>

        <div className="landing-console" aria-label="AgriLink market intelligence preview">
          <div className="landing-console-top flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-muted">Market pulse</p>
              <p className="mt-1 text-lg font-bold text-ink">Tomato · Ramanagara</p>
            </div>
            <span className="landing-live-dot"><i /> Live index</span>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-ink-muted">Today&apos;s range</p>
              <p className="mt-1 text-4xl font-black tracking-tight text-ink">₹26–31</p>
              <p className="mt-2 text-sm font-semibold text-brand-700">↑ 8.4% this week</p>
            </div>
            <div className="landing-signal-card">
              <p className="text-xs text-ink-muted">Sell signal</p>
              <p className="mt-2 text-lg font-bold text-ink">Hold 2–3 days</p>
              <p className="mt-1 text-xs text-ink-muted">78% confidence</p>
            </div>
          </div>
          <div className="landing-chart mt-8" aria-hidden="true">
            <div className="landing-chart-grid" />
            <svg viewBox="0 0 560 170" role="presentation" preserveAspectRatio="none">
              <path d="M0 142 C38 134 46 120 82 124 S125 96 164 112 S205 84 243 91 S289 63 328 75 S375 48 414 58 S460 26 505 39 S536 18 560 20" />
              <path className="landing-chart-fill" d="M0 142 C38 134 46 120 82 124 S125 96 164 112 S205 84 243 91 S289 63 328 75 S375 48 414 58 S460 26 505 39 S536 18 560 20 V170 H0 Z" />
            </svg>
            <span className="landing-chart-label landing-chart-label-one">₹28.40</span>
            <span className="landing-chart-label landing-chart-label-two">₹22.10</span>
          </div>
          <div className="mt-7 flex items-center justify-between border-t border-line/10 pt-4 text-xs text-ink-muted">
            <span>APMC arrivals · 42.8 t</span>
            <span>Updated 9:42 AM</span>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-proof border-y border-line/10 bg-card/55">
        <div className="mx-auto grid max-w-6xl gap-0 px-5 sm:px-8 md:grid-cols-3">
          {[
            ["01", "Read the market", "See local prices, arrivals and buyer demand in one grounded view."],
            ["02", "Choose your move", "Compare the real net realisation after transport, fees and expected loss."],
            ["03", "Trade with trust", "Carry the decision through lots, offers, logistics, payments and support."],
          ].map(([number, title, copy]) => (
            <div key={number} className="landing-proof-item">
              <span className="landing-number">{number}</span>
              <h2 className="mt-5 text-xl font-bold text-ink">{title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-ink-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>AgriLink · Smart farmer market intelligence</span>
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">Open the role-based demo <Icon name="arrow-up-right" className="ml-1 inline h-3.5 w-3.5" /></Link>
      </footer>
    </main>
  );
}
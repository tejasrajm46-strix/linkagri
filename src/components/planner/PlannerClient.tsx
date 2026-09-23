"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CropPanel, PlannerView, PlannerZone } from "@/lib/planner";
import { Icon } from "@/components/icons";
import { Delta, Modal } from "@/components/ui";
import { BioScanner } from "./BioScanner";
import { formatNum, fullDate, rupees, shortDate } from "@/lib/format";

type FeedItem = { id: string; kind: string; label: string; detail: string | null; createdAt: string | Date };
type ZoneRow = Omit<PlannerZone, "loggedAt"> & { loggedAt: string | Date | null };

const LEVEL_STYLE: Record<string, string> = {
  high: "border-red-400/40 bg-red-400/10 text-red-300",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  watch: "border-indigo-400/40 bg-indigo-400/10 text-indigo-300",
  clear: "border-line/20 bg-line/[0.06] text-ink-muted",
};

export function PlannerClient({ view, canEdit }: { view: PlannerView; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const plan = view.plan;

  const [synthesis, setSynthesis] = useState({ text: view.panel.synthesis, source: view.panel.synthesisSource });
  const [refining, setRefining] = useState(false);
  const [zones, setZones] = useState<ZoneRow[]>(plan?.zones ?? []);
  const [activities, setActivities] = useState<FeedItem[]>(view.activities);
  const [allocated, setAllocated] = useState(plan?.allocatedAcres ?? 0);
  const [selectedStage, setSelectedStage] = useState(plan?.currentStageIndex ?? 1);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Upgrade the instant offline synthesis with the AI one when a free model
  // answers. Never blocks the paint, and silently keeps the offline text if
  // every model is busy.
  useEffect(() => {
    let alive = true;
    setRefining(true);
    fetch(`/api/planner/synthesis?crop=${encodeURIComponent(view.panel.crop)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.ok && j.text && j.source === "ai") setSynthesis({ text: j.text, source: "ai" });
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setRefining(false);
      });
    return () => {
      alive = false;
    };
  }, [view.panel.crop]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const season = view.season;
  const asOf = view.crops[0]?.asOf;
  const activeStage = plan?.stages[selectedStage - 1];

  const categories = useMemo(() => ["All", ...Array.from(new Set(view.crops.map((c) => c.category)))], [view.crops]);
  const [category, setCategory] = useState("All");
  const visibleCrops = category === "All" ? view.crops : view.crops.filter((c) => c.category === category);

  const selectCrop = (name: string) => {
    startTransition(() => router.replace(`/planner?crop=${encodeURIComponent(name)}`, { scroll: false }));
  };

  async function post(url: string, body: unknown, label: string) {
    setBusy(label);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message ?? "Action failed");
      return j as Record<string, unknown>;
    } finally {
      setBusy(null);
    }
  }

  const logActivity = async (kind: string, label: string, detail: string, extra: Record<string, unknown> = {}) => {
    if (!plan) {
      setToast("No active plan yet");
      return;
    }
    try {
      const j = await post("/api/planner/log", { planId: plan.id, kind, label, detail, ...extra }, label);
      setActivities((a) => [j.activity as unknown as FeedItem, ...a].slice(0, 6));
      setToast(`${label} logged`);
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const logZone = async (zone: ZoneRow) => {
    const stamp = new Date().toISOString();
    await logActivity("ZONE_LOGGED", `${zone.zoneName} ${zone.cropName} inspected`, `Plot health ${zone.healthScore}% · yield ${zone.projectedYieldTons} t`, {
      zoneId: zone.id,
    });
    setZones((zs) => zs.map((z) => (z.id === zone.id ? { ...z, lastAction: `${zone.zoneName} ${zone.cropName} inspected`, loggedAt: stamp } : z)));
  };

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="planner-chamber mb-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="planner-mono text-[10px] font-semibold text-emerald-400/90">REAL-TIME SOIL &amp; MARKET SYNTHESIS</p>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Crop Planner</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">
              Plan the whole season — lifecycle stages, irrigation and foliar protocol, plot allocation, and the net realisation each
              plot is really heading for.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:shrink-0">
            <HeroStat label="Active plan" value={plan ? plan.cropLabel.split(" ")[0] : "—"} sub={plan?.lotNo ? `Lot ${plan.lotNo}` : plan?.title} />
            <HeroStat label="Day of cycle" value={plan ? `Day ${plan.dayNumber}` : "—"} sub={plan ? `of ~${plan.cycleDays} days` : undefined} />
            <HeroStat
              label="Current stage"
              value={plan ? `${plan.currentStageIndex} of ${plan.stages.length}` : "—"}
              sub={plan?.stages[plan.currentStageIndex - 1]?.name}
            />
            <HeroStat
              label="APMC index"
              value={view.panel.index ? `₹${view.panel.index.index}/kg` : "—"}
              sub={view.panel.index ? `${view.panel.index.changePct >= 0 ? "+" : ""}${view.panel.index.changePct}% this week` : "feed pending"}
              accent
            />
          </div>
        </div>
        {asOf ? (
          <p className="mt-4 text-[11px] text-ink-faint">
            Market feed as of {fullDate(asOf)} · live buyer demand and plot health are read from this deployment&apos;s database.
          </p>
        ) : null}
      </section>

      {/* ── Crop selectors ───────────────────────────────────────────────── */}
      <section className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">Popular Crop Selectors</h2>
          <p className="planner-mono text-[10px] text-ink-faint">REAL-TIME MANDI APMC INDEX</p>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`planner-chip ${category === c ? "planner-chip-active" : ""}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="mt-2.5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {visibleCrops.map((c) => {
            const on = c.crop.toLowerCase() === view.panel.crop.toLowerCase();
            return (
              <button
                key={c.cropId}
                onClick={() => selectCrop(c.crop)}
                className={`flex min-w-[190px] shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  on ? "border-emerald-400/50 bg-emerald-400/10" : "border-line/12 bg-card hover:border-line/25"
                }`}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{c.crop}</span>
                  <span className="block text-[11px] text-ink-faint">
                    {c.index > 0 ? (
                      <>
                        ₹{c.index}/kg <Delta pct={c.changePct} />
                      </>
                    ) : (
                      "feed pending"
                    )}
                  </span>
                </span>
                {on ? <Icon name="check" className="w-4 h-4 shrink-0 text-emerald-300" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Dossier + AI synthesis ───────────────────────────────────────── */}
      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Dossier panel={view.panel} allocated={allocated} holding={plan?.farmHoldingAcres ?? 1.5} className="xl:col-span-2" />

        <section className="planner-chamber flex flex-col p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="planner-mono text-[10px] font-semibold text-emerald-400/90">AGRILINK AI SYNTHESIS</p>
            <span className="flex items-center gap-1.5">
              <span className="planner-mono rounded-full border border-line/15 px-2 py-0.5 text-[9px] text-ink-faint">
                {synthesis.source === "ai" ? "OPENROUTER · FREE MODEL" : "OFFLINE ENGINE"}
              </span>
              <span className="planner-mono rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] text-emerald-300">
                V4.2 PRO
              </span>
            </span>
          </div>

          <blockquote className="mt-3 flex-1 rounded-2xl border border-line/10 bg-line/[0.03] p-3.5 text-[13px] italic leading-relaxed text-ink">
            {synthesis.text}
            {refining ? <span className="ml-1 inline-block h-3 w-10 animate-shimmer rounded bg-line/30 align-middle" /> : null}
          </blockquote>
          <p className="mt-2 text-[10px] text-ink-faint">
            {refining
              ? "Asking a free OpenRouter model to refine this from the figures above…"
              : synthesis.source === "ai"
                ? "Generated from the live index, buyer demand and plot health above."
                : "Deterministic synthesis from the figures above — every free model is busy or unconfigured."}
          </p>

          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line/10 p-3.5">
            <Gauge value={view.panel.suitability} />
            <div className="min-w-0">
              <p className="text-3xl font-extrabold leading-none text-ink">{view.panel.suitability}%</p>
              <p className="mt-1 text-[12px] font-semibold text-emerald-300">{view.panel.suitabilityLabel}</p>
              <ul className="mt-2 space-y-0.5">
                {view.panel.breakdown.map((b) => (
                  <li key={b.label} className="flex items-center gap-2 text-[11px] text-ink-muted">
                    <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
                    {b.label}: <span className="font-semibold text-ink">{b.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Link href="/chat" className="btn btn-primary mt-3 w-full">
            <Icon name="cpu" className="w-4 h-4" />
            Consult AgriLink Copilot
          </Link>
        </section>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <CareProtocols panel={view.panel} />
        <PestScan panel={view.panel} />
        <MarketOutlook panel={view.panel} buyersLabel={`${view.panel.buyers} active bidders`} />
      </div>

      {/* ── Bio-scanner ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <BioScanner
          panel={view.panel}
          capturing={busy === "Optical scan captured"}
          onCapture={() =>
            logActivity("SCAN_CAPTURED", "Optical scan captured", `${view.panel.crop} · ${view.panel.variety} at 3.5x cellular depth`)
          }
        />
      </div>

      {/* ── Module 2 ─────────────────────────────────────────────────────── */}
      <section className="planner-chamber mb-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="planner-mono inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              MODULE 2: INTEGRATED CROP PLANNER
            </p>
            <h2 className="mt-2.5 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
              Seasonal Crop Rotation &amp; Acreage Allocation
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">
              Simulate sowing schedules, track Kharif / Rabi timelines, allocate field zones, and preview real-time net realisation
              revenues.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:shrink-0">
            <a href={`/api/planner/export?crop=${encodeURIComponent(view.panel.crop)}`} download className="btn btn-ghost !border !border-line/15">
              <Icon name="download" className="w-4 h-4" />
              Export Sowing Plan
            </a>
            {canEdit ? (
              <button onClick={() => setAddOpen(true)} className="btn btn-primary">
                <Icon name="plus" className="w-4 h-4" />
                Add New Crop Zone
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mb-4">
        <SeasonCalendar view={view} />
      </div>

      <div className="mb-4">
        <LifecyclePipeline
          plan={plan}
          selected={selectedStage}
          onSelect={setSelectedStage}
          onLog={() =>
            activeStage
              ? logActivity("STAGE_LOGGED", `Stage ${selectedStage} · ${activeStage.name}`, `${activeStage.labor} · ${activeStage.inputs}`, {
                  stageIndex: selectedStage,
                })
              : undefined
          }
          busy={busy !== null}
        />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <FieldZoning zones={zones} onLog={logZone} busy={busy !== null} className="xl:col-span-2" />
        <div className="grid gap-4">
          <NetRealisation view={view} />
          <ActivityFeed items={activities} />
        </div>
      </div>

      {addOpen && plan ? (
        <AddZoneModal
          planId={plan.id}
          crops={view.crops.map((c) => c.crop)}
          onClose={() => setAddOpen(false)}
          onAdd={async (payload) => {
            const j = await post("/api/planner/zones", payload, "Zone added");
            setZones((zs) => [...zs, j.zone as unknown as ZoneRow].sort((a, b) => a.zoneName.localeCompare(b.zoneName)));
            setAllocated(Number(j.allocatedAcres) || allocated);
            setActivities((a) => [j.activity as unknown as FeedItem, ...a].slice(0, 6));
            setAddOpen(false);
            setToast(`${payload.zoneName} added to the plan`);
          }}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 right-4 z-[70] rounded-xl border border-emerald-400/30 bg-[rgb(6_18_13/0.95)] px-4 py-3 text-sm font-medium text-ink shadow-xl md:bottom-6">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function HeroStat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="min-w-[120px] rounded-2xl border border-line/10 bg-line/[0.03] px-3 py-2.5">
      <p className="planner-mono text-[9px] font-semibold uppercase text-ink-faint">{label}</p>
      <p className={`mt-1 text-[15px] font-bold ${accent ? "text-emerald-300" : "text-ink"}`}>{value}</p>
      {sub ? <p className="truncate text-[10px] text-ink-faint">{sub}</p> : null}
    </div>
  );
}

function Dossier({ panel, allocated, holding, className = "" }: { panel: CropPanel; allocated: number; holding: number; className?: string }) {
  const used = holding > 0 ? Math.min(100, Math.round((allocated / holding) * 100)) : 0;
  return (
    <section className={`planner-chamber p-4 sm:p-5 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 text-3xl">
            {panel.emoji}
          </span>
          <div className="min-w-0">
            <p className="planner-mono flex items-center gap-2 text-[10px] font-semibold text-ink-faint">
              <span className="text-emerald-300">{panel.category.toUpperCase()} CROP</span> · APMC INDEX
            </p>
            <h2 className="mt-1 truncate text-xl font-extrabold uppercase tracking-tight text-ink sm:text-2xl">{panel.label}</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {panel.guide.family} family · {panel.guide.cycleDays}-day cycle · click any crop above to switch.
            </p>
          </div>
        </div>
        <div className="shrink-0 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 text-right">
          <p className="planner-mono text-[9px] font-semibold uppercase text-emerald-300">Current market phase</p>
          <p className="planner-mono mt-1 text-[11px] text-ink-muted">Peak Selling Window</p>
          <p className="text-lg font-extrabold text-ink">
            {panel.index ? `avg ₹${panel.index.index}/kg` : "feed pending"}
          </p>
          {panel.index ? (
            <p className="text-[11px] text-ink-muted">
              ₹{panel.index.min} – ₹{panel.index.max}/kg in {panel.index.market.replace("APMC ", "")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DossierCell icon="calendar" title="Best Season" value={panel.guide.bestSeason} sub={panel.guide.targetHarvest} />
        <DossierCell icon="leaf" title="Soil & pH" value={panel.guide.soil} sub={`pH ${panel.guide.ph} · Organic matter ${panel.guide.organicMatter}`} />
        <DossierCell
          icon="droplet"
          title={`Planting Guide · ${panel.guide.planting}`}
          value={`Spacing: ${panel.guide.spacing}`}
          sub={`Seed depth: ${panel.guide.seedDepth} · Water ${panel.guide.waterMm[0]}–${panel.guide.waterMm[1]} mm`}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-line/10 p-3.5">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="font-semibold text-ink">Field allocation</span>
          <span className="planner-mono text-[11px] text-emerald-300">
            {allocated} acres · {used}% utilised
          </span>
        </div>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line/12">
          <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${used}%` }} />
        </span>
        <p className="mt-1.5 text-[11px] text-ink-faint">Total farm holding {holding} acres · projected yield {formatNum(panel.guide.yieldTonsPerAcre, 1)} t/acre</p>
      </div>
    </section>
  );
}

function DossierCell({ icon, title, value, sub }: { icon: string; title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        <Icon name={icon as never} className="w-3.5 h-3.5 text-emerald-300" />
        {title}
      </p>
      <p className="mt-1.5 text-[15px] font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-muted">{sub}</p>
    </div>
  );
}

function CareProtocols({ panel }: { panel: CropPanel }) {
  return (
    <section className="planner-chamber p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <Icon name="droplet" className="w-4 h-4 text-emerald-300" />
          Water &amp; Care Protocols
        </h3>
        <span className="planner-mono rounded-full border border-line/15 px-2 py-0.5 text-[9px] text-ink-muted">{panel.guide.irrigation}</span>
      </div>
      <p className="planner-mono mt-3 flex items-center justify-between text-[10px] uppercase text-ink-faint">
        <span>Water consumption benchmark</span>
        <span className="text-ink-muted">
          {panel.guide.waterMm[0]}–{panel.guide.waterMm[1]} mm
        </span>
      </p>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line/12">
        <span className="block h-full rounded-full bg-emerald-400" style={{ width: "62%" }} />
      </span>
      <ul className="mt-3 space-y-2">
        {panel.guide.care.map((c) => (
          <li key={c.label} className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
            <p className="flex items-start gap-2 text-[12px] font-semibold text-ink">
              <Icon name="check" className="mt-0.5 w-3.5 h-3.5 shrink-0 text-emerald-300" />
              {c.label}
            </p>
            <p className="mt-0.5 pl-5 text-[11px] text-ink-muted">{c.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PestScan({ panel }: { panel: CropPanel }) {
  const alerts = panel.guide.pests.filter((p) => p.level === "high" || p.level === "medium").length;
  return (
    <section className="planner-chamber flex flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <Icon name="microscope" className="w-4 h-4 text-emerald-300" />
          Pest &amp; Disease Scan
        </h3>
        <span className="planner-mono rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] text-amber-300">
          {alerts} ACTIVE ALERTS
        </span>
      </div>
      <ul className="mt-3 grid flex-1 grid-cols-2 gap-2">
        {panel.guide.pests.map((p) => (
          <li key={p.name} className={`rounded-xl border px-3 py-2 ${LEVEL_STYLE[p.level]}`}>
            <p className="text-[12px] font-bold">{p.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] opacity-90">
              {p.level === "clear" ? <Icon name="check" className="w-3 h-3" /> : p.level === "watch" ? <Icon name="eye" className="w-3 h-3" /> : <Icon name="alert" className="w-3 h-3" />}
              {p.detail}
            </p>
          </li>
        ))}
      </ul>
      <Link href="/lab-testing" className="btn btn-primary mt-3 w-full !bg-emerald-500/90 hover:!bg-emerald-500">
        <Icon name="upload" className="w-4 h-4" />
        Upload Plant Leaf for AI Diagnosis
      </Link>
    </section>
  );
}

function MarketOutlook({ panel, buyersLabel }: { panel: CropPanel; buyersLabel: string }) {
  const idx = panel.index;
  const rows: [string, React.ReactNode][] = [
    ["Nearest Primary Mandi", idx ? `${idx.market} (${idx.distanceKm} km)` : "—"],
    ["7-Day Price Trajectory", idx ? <Delta pct={idx.changePct} /> : "—"],
    ["Verified Direct Buyers", buyersLabel],
    [
      "Live Buyer Demand",
      panel.demandKg > 0 ? `${formatNum(panel.demandKg)} kg posted` : "no demand posted",
    ],
  ];
  return (
    <section className="planner-chamber p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <Icon name="chart" className="w-4 h-4 text-emerald-300" />
          Market APMC Outlook
        </h3>
        <span className="planner-mono rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] text-emerald-300">
          {idx && idx.changePct >= 0 ? "HIGH DEMAND" : "STABLE FEED"}
        </span>
      </div>
      <dl className="mt-3 space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 border-b border-line/10 pb-2 last:border-0 last:pb-0">
            <dt className="text-[12px] text-ink-muted">{label}</dt>
            <dd className="text-right text-[12px] font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <Link href="/prices" className="btn btn-ghost mt-3 w-full !border !border-line/15">
        <Icon name="chart" className="w-4 h-4" />
        Open full market prices
      </Link>
    </section>
  );
}

function SeasonCalendar({ view }: { view: PlannerView }) {
  const plan = view.plan;
  const seasons: { key: string; name: string; window: string }[] = [
    { key: "Kharif", name: "01. KHARIF SEASON", window: "June – October (Monsoon Crops)" },
    { key: "Rabi", name: "02. RABI ROTATION", window: "November – March (Winter Harvest)" },
    { key: "Zaid", name: "03. ZAID INTER-CROP", window: "April – May (Short Summer)" },
  ];
  return (
    <section className="planner-chamber p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <Icon name="calendar" className="w-4 h-4 text-emerald-300" />
          Seasonal Agricultural Calendar (Kharif · Rabi · Zaid)
        </h3>
        <span className="planner-mono rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300">
          CURRENT CYCLE: {view.season.name.toUpperCase()} ({view.season.progress}% COMPLETED)
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">{view.season.windowLabel}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {seasons.map((s) => (
          <div key={s.name}>
            <p className={`planner-mono text-[10px] font-semibold ${view.season.name === s.key ? "text-emerald-300" : "text-ink-faint"}`}>
              {s.name}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-muted">{s.window}</p>
          </div>
        ))}
      </div>

      <div className="relative mt-4 h-2 rounded-full bg-line/12">
        <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${view.season.progress}%` }} />
        <span className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-emerald-300 bg-[rgb(6_18_13)]" style={{ left: `${view.season.progress}%` }} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-ink-muted">
          {plan ? `${shortDate(plan.sowingDate)} · Sowing Started` : "Set a sowing date to start the season clock"}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-emerald-300">
          <Icon name="pin" className="w-3 h-3" />
          Today: {plan ? `Day ${plan.dayNumber} (${plan.stages[plan.currentStageIndex - 1]?.name})` : "—"}
        </span>
        <span className="text-ink-muted">{plan ? `${shortDate(plan.harvestWindowEnd)} · Harvest window closes` : ""}</span>
      </div>
    </section>
  );
}

function LifecyclePipeline({
  plan,
  selected,
  onSelect,
  onLog,
  busy,
}: {
  plan: PlannerView["plan"];
  selected: number;
  onSelect: (i: number) => void;
  onLog: () => void;
  busy: boolean;
}) {
  if (!plan) {
    return (
      <section className="planner-chamber p-4 sm:p-5">
        <h3 className="text-[13px] font-bold text-ink">Lifecycle Pipeline &amp; Action Protocol</h3>
        <p className="mt-2 text-[12px] text-ink-muted">No active plan yet — add a crop zone to start a lifecycle pipeline.</p>
      </section>
    );
  }
  const stage = plan.stages[selected - 1] ?? plan.stages[0];
  const statusStyle: Record<string, string> = {
    COMPLETED: "border-line/15 opacity-70",
    IN_PROGRESS: "border-emerald-400/50 bg-emerald-400/[0.07]",
    UPCOMING: "border-line/10 opacity-60",
  };
  return (
    <section className="planner-chamber p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <Icon name="layers" className="w-4 h-4 text-emerald-300" />
            Lifecycle Pipeline &amp; Action Protocol ({plan.cropLabel} {plan.lotNo ? `#${plan.lotNo}` : ""})
          </h3>
          <p className="mt-0.5 text-[11px] text-ink-faint">Tap a stage to inspect the agronomy protocol, labour allocation and required inputs.</p>
        </div>
        <span className="planner-mono text-[11px] text-ink-muted">
          STAGE {plan.currentStageIndex} OF {plan.stages.length}
        </span>
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {plan.stages.map((s, i) => {
          const on = selected === i + 1;
          return (
            <button
              key={s.name}
              onClick={() => onSelect(i + 1)}
              className={`w-[196px] shrink-0 rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                on ? "border-emerald-400/60 bg-emerald-400/10" : statusStyle[s.status]
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${s.status === "COMPLETED" ? "bg-emerald-500 text-white" : s.status === "IN_PROGRESS" ? "border border-emerald-400 text-emerald-300" : "border border-line/25 text-ink-faint"}`}>
                  {s.status === "COMPLETED" ? "✓" : i + 1}
                </span>
                <span className={`planner-mono text-[9px] font-semibold ${s.status === "IN_PROGRESS" ? "text-emerald-300" : "text-ink-faint"}`}>{s.status.replace("_", " ")}</span>
              </div>
              <p className="mt-2 text-[13px] font-bold text-ink">
                {i + 1}. {s.name}
              </p>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-ink-muted">{s.summary}</p>
              <p className="planner-mono mt-2 text-[9px] text-ink-faint">
                Day {s.from} – {s.to}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[12px] font-bold text-ink">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400 text-[10px] text-emerald-300">{selected}</span>
            {stage.name}
          </p>
          <span className="planner-mono text-[11px] text-emerald-300">
            Day {stage.from} – {stage.to}
            {plan.dayNumber >= stage.from && plan.dayNumber <= stage.to ? ` (NOW · DAY ${plan.dayNumber})` : ""}
          </span>
        </div>
        <p className="mt-2 text-[12px] text-ink-muted">{stage.summary}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-line/10 bg-line/[0.04] px-3 py-2">
            <p className="planner-mono text-[9px] uppercase text-ink-faint">Labour allocation</p>
            <p className="mt-0.5 text-[12px] font-semibold text-ink">{stage.labor}</p>
          </div>
          <div className="rounded-xl border border-line/10 bg-line/[0.04] px-3 py-2">
            <p className="planner-mono text-[9px] uppercase text-ink-faint">Required inputs</p>
            <p className="mt-0.5 text-[12px] font-semibold text-ink">{stage.inputs}</p>
          </div>
        </div>
        <button onClick={onLog} disabled={busy} className="btn btn-primary mt-3 !py-2 !min-h-[40px] text-xs">
          <Icon name="check" className="w-4 h-4" />
          Log stage activity
        </button>
      </div>
    </section>
  );
}

function FieldZoning({
  zones,
  onLog,
  busy,
  className = "",
}: {
  zones: ZoneRow[];
  onLog: (z: ZoneRow) => void;
  busy: boolean;
  className?: string;
}) {
  const totalAcres = zones.reduce((s, z) => s + z.acreage, 0);
  const totalYield = zones.reduce((s, z) => s + z.projectedYieldTons, 0);
  return (
    <section className={`planner-chamber p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
            <Icon name="layers" className="w-4 h-4 text-emerald-300" />
            Field Zoning &amp; Acreage Allocation
          </h3>
          <p className="mt-0.5 text-[11px] text-ink-faint">
            {formatNum(totalAcres, 2)} acres allocated · {formatNum(totalYield, 1)} t projected yield across {zones.length} plots
          </p>
        </div>
        <span className="planner-mono rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300">
          AUTOMATED RISK DISTRIBUTION
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="tbl min-w-[640px]">
          <thead>
            <tr>
              <th>Plot Zone</th>
              <th>Assigned Crop</th>
              <th className="text-right">Acreage</th>
              <th className="text-right">Health Score</th>
              <th className="text-right">Projected Yield</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {zones.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-ink-muted">
                  No plots allocated yet.
                </td>
              </tr>
            ) : (
              zones.map((z) => (
                <tr key={z.id}>
                  <td className="font-semibold text-ink">{z.zoneName}</td>
                  <td>
                    <span className="text-ink">{z.cropName}</span>
                    {z.variety ? <span className="block text-[11px] text-ink-faint">{z.variety}</span> : null}
                  </td>
                  <td className="text-right planner-mono text-[12px] text-ink-muted">{formatNum(z.acreage, 2)} acre</td>
                  <td className="text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-line/12 sm:block">
                        <span
                          className={`block h-full rounded-full ${z.healthScore >= 90 ? "bg-emerald-400" : z.healthScore >= 80 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${z.healthScore}%` }}
                        />
                      </span>
                      <span className={`planner-mono text-[12px] font-semibold ${z.healthScore >= 90 ? "text-emerald-300" : z.healthScore >= 80 ? "text-amber-300" : "text-red-300"}`}>
                        {z.healthScore}%
                      </span>
                    </span>
                    <span className="block text-[10px] text-ink-faint">
                      {z.healthScore >= 90 ? "Excellent" : z.healthScore >= 80 ? "Good" : "Needs attention"}
                    </span>
                  </td>
                  <td className="text-right planner-mono text-[12px] text-ink">{formatNum(z.projectedYieldTons, 1)} t</td>
                  <td className="text-right">
                    <button onClick={() => onLog(z)} disabled={busy} className="btn btn-ghost !min-h-[34px] !px-2.5 !py-1 text-xs !border !border-line/15">
                      <Icon name="check" className="w-3.5 h-3.5" />
                      Log
                    </button>
                    {z.loggedAt ? <span className="mt-1 block text-[10px] text-ink-faint">{shortDate(z.loggedAt)}</span> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NetRealisation({ view }: { view: PlannerView }) {
  const e = view.economics;
  return (
    <section className="planner-chamber p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <Icon name="calc" className="w-4 h-4 text-emerald-300" />
          Net Realisation Calculator
        </h3>
        <Link href="/calculator" className="planner-mono rounded-full border border-line/15 px-2 py-0.5 text-[9px] text-ink-muted hover:text-ink">
          LINKED MODULE
        </Link>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">
        Live forecast on {formatNum(e.acreage, 2)} acres at ₹{e.pricePerKg}/kg and {formatNum(e.projectedYieldTons, 1)} t projected yield.
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-line/10 px-3 py-2">
          <span className="flex items-center gap-2 text-[12px] text-ink-muted">
            <Icon name="zap" className="w-3.5 h-3.5 text-emerald-300" />
            Expected gross revenue
          </span>
          <span className="text-[13px] font-bold text-emerald-300">{rupees(e.gross)}</span>
        </div>
        {e.deductions.map((d) => (
          <div key={d.label} className="flex items-center justify-between px-3">
            <span className="text-[12px] text-ink-muted">− {d.label}</span>
            <span className="text-[12px] font-semibold text-red-300">{rupees(d.amount)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.09] p-3.5">
        <p className="planner-mono text-[10px] font-semibold uppercase text-emerald-300">Forecast net margin</p>
        <p className="mt-1 text-2xl font-extrabold text-ink">{rupees(e.net)}</p>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          ₹{e.netPerKg.toFixed(2)}/kg net after transport, commission and post-harvest loss · {formatNum(e.quantityKg)} kg
        </p>
      </div>
    </section>
  );
}

function ActivityFeed({ items }: { items: FeedItem[] }) {
  return (
    <section className="planner-chamber p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink">
        <Icon name="clock" className="w-4 h-4 text-emerald-300" />
        Field Activity Log
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-ink-muted">Nothing logged yet — tick a lifecycle stage to start the log.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((a) => (
            <li key={a.id} className="border-l border-emerald-400/30 pl-3">
              <p className="text-[12px] font-semibold text-ink">{a.label}</p>
              {a.detail ? <p className="text-[11px] text-ink-muted">{a.detail}</p> : null}
              <p className="planner-mono mt-0.5 text-[10px] text-ink-faint">
                {shortDate(a.createdAt)} · {a.kind.replace("_", " ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Gauge({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(74 222 128 / 0.16)" strokeWidth="5" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="#4ade80"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
      />
    </svg>
  );
}

function AddZoneModal({
  planId,
  crops,
  onClose,
  onAdd,
}: {
  planId: string;
  crops: string[];
  onClose: () => void;
  onAdd: (payload: { zoneName: string; cropName: string; variety?: string; acreage: number; healthScore: number }) => Promise<void>;
}) {
  const [zoneName, setZoneName] = useState("Zone Delta");
  const [cropName, setCropName] = useState(crops[0] ?? "Tomato");
  const [variety, setVariety] = useState("");
  const [acreage, setAcreage] = useState("0.5");
  const [healthScore, setHealthScore] = useState("88");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        zoneName: zoneName.trim(),
        cropName,
        variety: variety.trim() || undefined,
        acreage: Number(acreage),
        healthScore: Number(healthScore),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add New Crop Zone"
      footer={
        <>
          <button onClick={onClose} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={save} disabled={saving || !zoneName.trim() || !(Number(acreage) > 0)} className="btn btn-primary">
            {saving ? "Adding…" : "Add zone"}
          </button>
        </>
      }
    >
      <p className="text-[12px] text-ink-muted">
        Plan {planId.slice(0, 6)}… · projected yield is computed from the crop&apos;s published per-acre yield and the plot health you
        enter.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Plot zone name</span>
          <input className="input" value={zoneName} maxLength={40} onChange={(e) => setZoneName(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Crop</span>
          <select className="select" value={cropName} onChange={(e) => setCropName(e.target.value)}>
            {crops.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Variety (optional)</span>
          <input className="input" value={variety} maxLength={60} placeholder="e.g. Arka Rakshak" onChange={(e) => setVariety(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Acreage</span>
          <input className="input" type="number" min="0.01" step="0.05" value={acreage} onChange={(e) => setAcreage(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Plot health score ({healthScore}%)</span>
          <input type="range" min={40} max={100} value={healthScore} onChange={(e) => setHealthScore(e.target.value)} className="w-full accent-emerald-500" />
        </label>
      </div>
      {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p> : null}
    </Modal>
  );
}


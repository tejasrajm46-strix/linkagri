"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CropPanel } from "@/lib/planner";
import { Icon } from "@/components/icons";

const STAGE_META = [
  { chip: "1.8x Macro", depth: "DEPTH: MACROSCOPIC" },
  { chip: "2.1x Tissue", depth: "DEPTH: EPIDERMAL TISSUE" },
  { chip: "3.5x Core", depth: "DEPTH: CELLULAR CORE & BRIX" },
];

/**
 * Optical bio-scanner.
 *
 * Scrolling scrubs the optical depth from 1.8x to 3.5x and fades in the three
 * telemetry cards. The figures come from the crop's published quality profile
 * (src/lib/cropGuide.ts) — this is a reference view, not a live sensor, and the
 * footer says so and points at the lab module for measured values.
 */
export function BioScanner({
  panel,
  onCapture,
  capturing,
}: {
  panel: CropPanel;
  onCapture: () => void;
  capturing: boolean;
}) {
  const chamber = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = chamber.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the chamber is entering from the bottom, 1 once it has passed
      // the middle of the viewport.
      const p = (vh * 0.7 - r.top) / Math.max(1, r.height * 0.85);
      setProgress(Math.max(0, Math.min(1, p)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const zoom = 1.8 + progress * 1.7;
  const active = progress < 0.34 ? 0 : progress < 0.7 ? 1 : 2;
  const stages = panel.stages;
  const pct = Math.round(progress * 100);

  return (
    <section className="planner-chamber" ref={chamber}>
      {/* header rail */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 px-4 py-3 sm:px-6">
        <p className="planner-mono text-[11px] font-semibold text-ink sm:text-xs">
          OPTICAL BIO-SCANNER 3.5X · SPECIMEN: <span className="text-ink-muted">{panel.crop.toUpperCase()} {panel.variety.toUpperCase()}</span>
        </p>
        <div className="flex items-center gap-3">
          <span className="planner-mono badge border border-emerald-400/30 bg-emerald-400/10 text-[10px] text-emerald-300">
            {STAGE_META[active].depth}
          </span>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="planner-mono text-[10px] text-ink-faint">ZOOM</span>
            <span className="h-1 w-24 overflow-hidden rounded-full bg-line/15">
              <span className="block h-full rounded-full bg-emerald-400 transition-[width] duration-150" style={{ width: `${Math.max(4, pct)}%` }} />
            </span>
            <span className="planner-mono w-12 text-right text-[11px] font-semibold text-emerald-300">{zoom.toFixed(2)}x</span>
          </div>
        </div>
      </div>

      {/* stage */}
      <div className="relative h-[340px] sm:h-[440px] overflow-hidden">
        <div className="planner-grid-floor absolute inset-0 opacity-60" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(80% 60% at 50% 45%, rgba(52,211,153,0.10), transparent 70%)" }} />
        <div className="planner-scan" />

        {/* corner brackets */}
        <span className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-emerald-400/40" />
        <span className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-emerald-400/40" />
        <span className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-emerald-400/40" />
        <span className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-emerald-400/40" />

        {/* specimen */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative transition-transform duration-200 ease-out" style={{ transform: `scale(${0.9 + progress * 0.3})` }}>
            <div className="absolute -inset-20 rounded-full" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.18), transparent 62%)" }} />
            <div
              className="relative flex h-[210px] w-[210px] items-center justify-center rounded-full border border-emerald-400/25 sm:h-[280px] sm:w-[280px]"
              style={{ background: "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.10), rgba(4,14,10,0.94) 68%)" }}
            >
              <div className="absolute inset-4 rounded-full border border-emerald-400/10" />
              <div className="absolute inset-10 rounded-full border border-dashed border-emerald-400/15" />
              <span className="select-none text-[110px] leading-none sm:text-[148px]" style={{ filter: "drop-shadow(0 10px 34px rgba(0,0,0,0.65))" }}>
                {panel.emoji}
              </span>
              {/* reticle */}
              <span className="absolute h-20 w-20 rounded-full border border-emerald-300/50 sm:h-24 sm:w-24">
                <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-emerald-300/60" />
                <span className="absolute left-1/2 bottom-0 h-3 w-px -translate-x-1/2 bg-emerald-300/60" />
                <span className="absolute top-1/2 left-0 w-3 h-px -translate-y-1/2 bg-emerald-300/60" />
                <span className="absolute top-1/2 right-0 w-3 h-px -translate-y-1/2 bg-emerald-300/60" />
              </span>
              <span className="absolute -right-1 top-1/3 h-4 w-4 rounded-full bg-emerald-400/90 shadow-[0_0_18px_rgba(74,222,128,0.9)]" />
              <span className="absolute left-0 top-2/3 h-2.5 w-2.5 rounded-full bg-emerald-300/70" />
            </div>
          </div>
        </div>

        {/* telemetry cards — the active depth is sharp, the others recede */}
        <Telemetry stage={stages[0]} active={active === 0} className="left-3 top-6 sm:left-6 sm:top-10 max-w-[300px]" />
        <Telemetry stage={stages[1]} active={active === 1} className="right-3 top-1/2 -translate-y-1/2 sm:right-6 max-w-[280px]" />
        <Telemetry stage={stages[2]} active={active === 2} className="bottom-6 left-3 sm:left-6 max-w-[340px]" />
      </div>

      {/* footer rail */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 px-4 py-3 sm:px-6">
        <p className="flex items-center gap-2 text-[11px] text-ink-faint">
          <span className="inline-flex h-4 w-3 items-center justify-center rounded-sm border border-line/25">
            <span className="h-1.5 w-px bg-emerald-300" />
          </span>
          Scroll this page to scrub through optical depths (1.8x → 3.5x)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {STAGE_META.map((s, i) => (
            <span
              key={s.chip}
              className={`planner-mono rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                active === i ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" : "border-line/15 text-ink-faint"
              }`}
            >
              {s.chip}
            </span>
          ))}
          <button onClick={onCapture} disabled={capturing} className="btn btn-primary !py-2 !min-h-[38px] !px-3 text-xs">
            <Icon name="scan" className="w-4 h-4" />
            {capturing ? "Capturing…" : "Capture Snapshot"}
          </button>
        </div>
      </div>
      <p className="border-t border-line/10 px-4 py-2.5 text-[11px] leading-relaxed text-ink-faint sm:px-6">
        Telemetry shows the published quality profile for {panel.crop} — a reference spec, not a live sensor reading. Send a sample to a
        lab from <span className="text-ink-muted">Lab &amp; Crop Health</span> to replace it with measured values.
      </p>
    </section>
  );
}

function Telemetry({ stage, active, className }: { stage?: CropPanel["stages"][number]; active: boolean; className: string }) {
  if (!stage) return null;
  return (
    <div
      className={`pointer-events-none absolute rounded-2xl border px-4 py-3 backdrop-blur-[2px] transition-all duration-300 ${className} ${
        active ? "border-emerald-400/40 bg-[rgb(6_18_13/0.92)] opacity-100" : "border-line/10 bg-[rgb(6_18_13/0.55)] opacity-40 blur-[1px]"
      }`}
      style={active ? { boxShadow: "0 0 0 1px rgba(74,222,128,0.12), 0 24px 48px -24px rgba(0,0,0,0.9)" } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="planner-mono text-[10px] font-semibold text-emerald-300">{stage.eyebrow.toUpperCase()}</span>
        {active ? null : <span className="planner-mono text-[10px] text-ink-faint">{stage.metrics[0]?.value}</span>}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Icon name="target" className="w-3.5 h-3.5 text-emerald-300" />
        {stage.title}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{stage.body}</p>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-line/10 pt-2.5">
        {stage.metrics.map((m) => (
          <div key={m.label}>
            <p className="planner-mono text-[9px] uppercase text-ink-faint">{m.label}</p>
            <p className="text-[12px] font-bold text-emerald-300">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

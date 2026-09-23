"use client";

import React, { useEffect } from "react";
import { Icon } from "./icons";
import { statusColor, statusLabel } from "@/lib/nav";
import { initials } from "@/lib/format";

export function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

export function Badge({ status, children }: { status: string; children?: React.ReactNode }) {
  return <span className={`badge ${statusColor(status)}`}>{children ?? statusLabel(status)}</span>;
}

export function Avatar({ name, color = "#2f7d33", size = 38 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  sub,
  subClass = "text-ink-muted",
  accent,
}: {
  icon?: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  subClass?: string;
  accent?: boolean;
}) {
  return (
    <Card className="card-pad">
      <div className="flex items-start justify-between gap-2">
        <p className="stat-label">{label}</p>
        {icon ? (
          <span className={`rounded-lg p-1.5 ${accent ? "bg-brand-100 text-brand-700" : "bg-line/[0.06] text-ink-muted"}`}>
            <Icon name={icon as never} className="w-4 h-4" />
          </span>
        ) : null}
      </div>
      <p className={`stat-value mt-1 ${accent ? "text-brand-700" : ""}`}>{value}</p>
      {sub ? <p className={`mt-1 text-[13px] ${subClass}`}>{sub}</p> : null}
    </Card>
  );
}

export function EmptyState({ icon = "file", title, body }: { icon?: string; title: string; body?: string }) {
  return (
    <Card className="card-pad py-10 text-center">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-line/[0.06] text-ink-faint">
        <Icon name={icon as never} className="w-6 h-6" />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 text-sm text-ink-muted max-w-sm mx-auto">{body}</p> : null}
    </Card>
  );
}

/** Modal that renders as a bottom sheet / full screen on phones (per spec). */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === "lg" ? "max-w-2xl" : size === "xl" ? "max-w-4xl" : "max-w-md";
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${width} bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line/10 sticky top-0 bg-card rounded-t-2xl z-10">
          <h3 className="font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="btn-ghost !p-2 !min-h-0 h-9 w-9" aria-label="Close">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-line/10 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "md" | "sm";
}) {
  return (
    <div className={`inline-flex rounded-full bg-brand-50 border border-brand-100 p-1 gap-1 ${size === "sm" ? "" : ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 font-semibold transition-colors ${
            size === "sm" ? "text-xs px-3 py-1.5" : "text-sm py-1.5"
          } ${value === o.value ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatPill({ children, className = "bg-brand-100 text-brand-800" }: { children: React.ReactNode; className?: string }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function Delta({ pct }: { pct: number }) {
  if (Math.abs(pct) < 0.05) return <span className="text-ink-faint">—</span>;
  const up = pct > 0;
  return (
    <span className={`font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}
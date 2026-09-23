import { ORDER_FLOW, statusColor, statusLabel } from "@/lib/nav";

type TimelineStep = { status: string; at?: string | Date | null; note?: string | null };

export function TimelineView({ timeline, current }: { timeline: TimelineStep[]; current: string }) {
  const reached = new Set<string>();
  for (const s of timeline) reached.add(s.status);

  const currentIdx = ORDER_FLOW.indexOf(current);
  const shown = ORDER_FLOW.filter(
    (s, i) =>
      reached.has(s) ||
      i <= Math.max(currentIdx, 0) ||
      s === "DRAFT" ||
      s === current ||
      (i <= currentIdx + 1)
  );

  return (
    <ol className="space-y-0">
      {shown.map((step, i) => {
        const entry = timeline.find((t) => t.status === step);
        const done = entry != null;
        const isCurrent = step === current;
        return (
          <li key={step} className="relative pl-8 pb-4 last:pb-0">
            {i < shown.length - 1 ? <span className={`absolute left-[9px] top-5 bottom-0 w-0.5 ${done ? "bg-brand-500" : "bg-black/10"}`} /> : null}
            <span
              className={`absolute left-0 top-1 h-[18px] w-[18px] rounded-full border-2 ${
                done ? "bg-brand-500 border-brand-500" : isCurrent ? "bg-card border-brand-500" : "bg-card border-black/15"
              } ${isCurrent ? "ring-4 ring-brand-500/20" : ""}`}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${done ? "text-ink" : isCurrent ? "text-brand-700" : "text-ink-faint"}`}>
                  {statusLabel(step)}
                </span>
                {done ? (
                  <span className={`badge ${statusColor(step)}`}>{entry?.at ? new Date(entry.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</span>
                ) : isCurrent ? (
                  <span className="badge bg-brand-100 text-brand-800">In progress</span>
                ) : null}
              </div>
              {entry?.note ? <p className="text-xs text-ink-muted mt-0.5">{entry.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
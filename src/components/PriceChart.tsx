import { formatNum } from "@/lib/format";

/**
 * Lightweight SVG price chart — no chart library needed (works offline,
 * small bundle, matches the reference UI's simple green bars).
 */
export function BarChart({
  points,
  height = 180,
  color = "#388e3c",
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const w = 600;
  const pad = { top: 26, right: 8, bottom: 26, left: 8 };
  const innerH = height - pad.top - pad.bottom;
  const innerW = w - pad.left - pad.right;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);
  const n = points.length;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.52, 56);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full min-w-[420px] h-auto" role="img" aria-label="Price trend chart">
        {points.map((p, i) => {
          const x = pad.left + slot * i + slot / 2;
          const h = Math.max((p.value - min) / range * innerH, 2);
          const y = pad.top + innerH - h;
          return (
            <g key={i}>
              <text x={x} y={pad.top - 8} textAnchor="middle" className="fill-brand-700" fontSize="12" fontWeight="700">
                ₹{formatNum(p.value)}
              </text>
              <rect x={x - barW / 2} y={y} width={barW} height={h} rx={5} fill={color} opacity={0.85} />
              <text x={x} y={pad.top + innerH + 18} textAnchor="middle" className="fill-ink-faint" fontSize="10.5">
                {p.label}
              </text>
            </g>
          );
        })}
        <line x1={pad.left} y1={pad.top + innerH} x2={w - pad.right} y2={pad.top + innerH} stroke="#00000014" strokeWidth={1} />
      </svg>
    </div>
  );
}

export function LineChart({
  points,
  height = 180,
  color = "#388e3c",
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const w = 600;
  const pad = { top: 20, right: 8, bottom: 26, left: 8 };
  const innerH = height - pad.top - pad.bottom;
  const innerW = w - pad.left - pad.right;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const n = Math.max(points.length - 1, 1);
  const step = innerW / n;
  const pt = (i: number) => {
    const x = pad.left + step * i;
    const y = pad.top + innerH - ((points[i].value - min) / range) * innerH;
    return [x, y] as const;
  };
  const path = points.map((_, i) => pt(i).join(",")).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full min-w-[420px] h-auto" role="img" aria-label="Arrival trend chart">
        <polyline points={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const [x, y] = pt(i);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill="#fff" stroke={color} strokeWidth={2} />
              <text x={x} y={y - 10} textAnchor="middle" fontSize="10.5" className="fill-ink-muted" fontWeight="600">
                {formatNum(p.value)}
              </text>
              <text x={x} y={pad.top + innerH + 18} textAnchor="middle" fontSize="10.5" className="fill-ink-faint">
                {p.label}
              </text>
            </g>
          );
        })}
        <line x1={pad.left} y1={pad.top + innerH} x2={w - pad.right} y2={pad.top + innerH} stroke="#00000014" />
      </svg>
    </div>
  );
}
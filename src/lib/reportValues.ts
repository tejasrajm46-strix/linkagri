/**
 * Report-value parser.
 *
 * Scans extracted report text for lines shaped like:
 *
 *     Soil pH              5.2      6.5 - 8.5
 *     Available Nitrogen (kg/ha)  98  120 - 180
 *
 * i.e. `label  value  min - max` (dash range). ONLY ranges present in the
 * file are used — the engine never invents reference ranges, so every
 * "abnormal" finding cites the report's own numbers. Lines without a
 * value + range are ignored (headers, remarks, IDs, dates).
 */

export type ReportValue = {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
};

export type AbnormalValue = ReportValue & { direction: "below" | "above" };

export type ParsedReportValues = {
  /** Every measurable value that had an in-file reference range. */
  values: ReportValue[];
  /** Values outside their in-file reference range. */
  abnormal: AbnormalValue[];
};

const NUMBER = String.raw`\d+(?:\.\d+)?`;
const UNIT = String.raw`(?:[a-zA-Z]{1,6}|%|ppm|ppb|mg/kg|kg/ha|µS/cm|meq|dS/m)?`;

// label  value  min - max   (optional units on either number; dash range)
const VALUE_RANGE_RE = new RegExp(
  String.raw`^(.+?)[\s:]+(${NUMBER})\s*${UNIT}\s+(${NUMBER})\s*[-–—~to]+\s*(${NUMBER})\s*${UNIT}\s*$`,
  "i"
);

function parseNumber(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Sanity bounds — absurd magnitudes are data artifacts, not findings. */
function plausible(v: number, min: number, max: number): boolean {
  return v > 0 && v < 1_000_000 && min >= 0 && min < max && max < 1_000_000;
}

export function parseReportValues(text: string): ParsedReportValues {
  const values: ReportValue[] = [];
  const abnormal: AbnormalValue[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const m = VALUE_RANGE_RE.exec(line);
    if (!m) continue;

    const value = parseNumber(m[2]);
    const min = parseNumber(m[3]);
    const max = parseNumber(m[4]);
    if (![value, min, max].every(Number.isFinite) || !plausible(value, min, max)) continue;

    const label = m[1].trim().replace(/\s{2,}/g, " ").replace(/[:\s]+$/, "");
    if (!label || label.length > 80) continue;

    const unit = m[5]?.trim() || undefined;
    const rv: ReportValue = { label, value, unit, min, max };
    values.push(rv);
    if (value < min) abnormal.push({ ...rv, direction: "below" });
    else if (value > max) abnormal.push({ ...rv, direction: "above" });
  }

  return { values, abnormal };
}

/** Human sentence for one abnormal finding, e.g. "Soil pH 5.2 (below 6.5 – 8.5)". */
export function describeAbnormal(v: AbnormalValue): string {
  const unit = v.unit ? ` ${v.unit}` : "";
  return `${v.label} ${v.value}${unit} is ${v.direction} the report's reference range (${v.min} – ${v.max}${v.unit ?? ""}).`;
}
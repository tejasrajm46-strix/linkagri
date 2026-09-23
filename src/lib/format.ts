const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function inr2(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function rupees(n: number): string {
  return inr.format(n);
}

export function perKg(n: number, digits = 0): string {
  return `₹${formatNum(n, digits)}/kg`;
}

export function formatNum(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function shortDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function fullDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${Math.round(n * 10) / 10}%`;
}

/** ₹ per kg with optional decimals — used everywhere prices are shown. */
export function pricePerKgDisplay(n: number, digits = 2): string {
  return `₹${n.toFixed(digits)}/kg`;
}
import { Role } from "@prisma/client";

export type NavItem = { href: string; label: string; icon: string; match?: string };

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/prices", label: "Market Prices", icon: "chart" },
  { href: "/buyers", label: "Buyer Marketplace", icon: "bag" },
  { href: "/lots", label: "My Lots", icon: "package" },
  { href: "/orders", label: "Orders & Logistics", icon: "truck" },
  { href: "/payments", label: "Payments", icon: "card" },
  { href: "/calculator", label: "Net Calculator", icon: "calc" },
  { href: "/planner", label: "Crop Planner", icon: "leaf", match: "/planner" },
  { href: "/lab-testing", label: "Lab & Crop Health", icon: "lab", match: "/lab-testing" },
  { href: "/disputes", label: "Grievances", icon: "shield" },
];

export const EXTRA_NAV: Record<Role, NavItem[]> = {
  FARMER: [{ href: "/notifications", label: "Notifications", icon: "bell", match: "/notifications" }],
  FPO: [{ href: "/notifications", label: "Notifications", icon: "bell" }],
  BUYER: [{ href: "/notifications", label: "Notifications", icon: "bell" }],
  TRANSPORTER: [{ href: "/notifications", label: "Notifications", icon: "bell" }],
  ADMIN: [
    { href: "/admin", label: "Admin Panel", icon: "shield", match: "/admin" },
    { href: "/notifications", label: "Notifications", icon: "bell" },
  ],
};

/**
 * Roles a visitor can enter as. Deliberately contains NO credentials: entry is
 * passwordless (see /api/auth/enter) and the seeded account for each role is
 * resolved server-side.
 */
export const ROLE_ENTRIES: { role: Role; label: string; blurb: string; emoji: string }[] = [
  { role: Role.FARMER, label: "Farmer", blurb: "Ravi Kumar · Ramanagara", emoji: "🌾" },
  { role: Role.FPO, label: "FPO", blurb: "Ramanagara Fresh FPO", emoji: "🏢" },
  { role: Role.BUYER, label: "Buyer", blurb: "ABC Foods Pvt Ltd", emoji: "🛒" },
  { role: Role.TRANSPORTER, label: "Transporter", blurb: "Veeresh Kumar", emoji: "🚚" },
  { role: Role.ADMIN, label: "Admin", blurb: "Platform admin", emoji: "🛡️" },
];

export function navFor(role: Role): NavItem[] {
  return [...MAIN_NAV, ...EXTRA_NAV[role]];
}

/** Tailwind badge colour for a status enum value. */
export const STATUS_COLORS: Record<string, string> = {
  // offers / orders
  SUBMITTED: "bg-blue-50 text-blue-700",
  COUNTERED: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  EXPIRED: "bg-gray-100 text-gray-500",
  WITHDRAWN: "bg-gray-100 text-gray-500",
  DRAFT: "bg-gray-100 text-gray-600",
  LISTED: "bg-emerald-50 text-emerald-700",
  OFFER_RECEIVED: "bg-blue-50 text-blue-700",
  NEGOTIATING: "bg-amber-50 text-amber-700",
  BOOKED: "bg-indigo-50 text-indigo-700",
  SOLD: "bg-gray-100 text-gray-600",
  PICKUP_SCHEDULED: "bg-blue-50 text-blue-700",
  IN_TRANSIT: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-teal-50 text-teal-700",
  PAYMENT_PENDING: "bg-orange-50 text-orange-600",
  PAID: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-600",
  // logistics
  PENDING: "bg-blue-50 text-blue-700",
  PICKED_UP: "bg-indigo-50 text-indigo-700",
  // payments
  PROCESSING: "bg-blue-50 text-blue-700",
  FAILED: "bg-red-50 text-red-600",
  DISPUTED: "bg-purple-50 text-purple-700",
  OVERDUE: "bg-red-50 text-red-600",
  // disputes
  OPEN: "bg-red-50 text-red-600",
  UNDER_REVIEW: "bg-amber-50 text-amber-700",
  EVIDENCE_REQUESTED: "bg-purple-50 text-purple-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  ESCALATED: "bg-red-50 text-red-600",
  // lab testing & crop health
  REQUESTED: "bg-blue-50 text-blue-700",
  LAB_ACCEPTED: "bg-teal-50 text-teal-700",
  SAMPLE_SUBMITTED: "bg-indigo-50 text-indigo-700",
  TESTING: "bg-purple-50 text-purple-700",
  REPORT_READY: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  UPLOADED: "bg-blue-50 text-blue-700",
  ANALYZED: "bg-emerald-50 text-emerald-700",
  SHARED: "bg-teal-50 text-teal-700",
  SENT: "bg-blue-50 text-blue-700",
  ANSWERED: "bg-emerald-50 text-emerald-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
};

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
}

export function statusLabel(status: string): string {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ORDER_FLOW = [
  "DRAFT",
  "LISTED",
  "OFFER_RECEIVED",
  "NEGOTIATING",
  "ACCEPTED",
  "PICKUP_SCHEDULED",
  "IN_TRANSIT",
  "DELIVERED",
  "PAYMENT_PENDING",
  "PAID",
  "CLOSED",
];
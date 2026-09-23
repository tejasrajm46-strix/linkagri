/**
 * Server-side state machines.
 *
 * Status values are never trusted from the frontend or the LLM — every state
 * change must pass one of these transition checks, and the transition itself
 * is applied with a conditional database update so concurrent requests cannot
 * double-accept / double-pay / double-assign.
 */

export const OFFER_OPEN = ["SUBMITTED", "COUNTERED"] as const;
export const LOT_OPEN = ["LISTED", "OFFER_RECEIVED", "NEGOTIATING"] as const;

/** States a lot owner may move their lot into directly. */
export const LOT_MANUAL_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  LISTED: ["DRAFT"],
  WITHDRAWN: [...LOT_OPEN],
};

/** Manual offer responses: which source states each response is valid from. */
export const OFFER_MANUAL_TRANSITIONS: Record<
  "accept" | "reject" | "counter",
  ReadonlyArray<"SUBMITTED" | "COUNTERED">
> = {
  accept: ["SUBMITTED", "COUNTERED"],
  reject: ["SUBMITTED", "COUNTERED"],
  counter: ["SUBMITTED", "COUNTERED"],
};

/**
 * Logistics status updates performed by a transporter. The job must first be
 * accepted (transporterId assigned, status PICKUP_SCHEDULED), then progress
 * strictly in order.
 */
export const LOGISTICS_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  PICKUP_SCHEDULED: ["PICKED_UP"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED"],
};

/** Orders that may still request a transporter. */
export const ORDER_PICKUP_OK = ["ACCEPTED", "PICKUP_SCHEDULED"] as const;

/** Order status → timeline suffix applied by logistics milestones. */
export const ORDER_STATUS_AFTER_LOGISTICS: Record<string, string> = {
  PICKED_UP: "PICKUP_SCHEDULED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "PAYMENT_PENDING",
};

/** Lab test request lifecycle (spec §7). */
export const LAB_REQUEST_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  DRAFT: ["REQUESTED", "CANCELLED"],
  REQUESTED: ["LAB_ACCEPTED", "REJECTED", "CANCELLED"],
  LAB_ACCEPTED: ["SAMPLE_SUBMITTED", "CANCELLED"],
  SAMPLE_SUBMITTED: ["TESTING", "CANCELLED"],
  TESTING: ["REPORT_READY"],
  REPORT_READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export const LAB_REQUEST_FLOW: ReadonlyArray<string> = [
  "DRAFT",
  "REQUESTED",
  "LAB_ACCEPTED",
  "SAMPLE_SUBMITTED",
  "TESTING",
  "REPORT_READY",
  "COMPLETED",
];

export const DISPUTE_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  OPEN: ["UNDER_REVIEW", "EVIDENCE_REQUESTED", "RESOLVED", "ESCALATED", "CLOSED"],
  UNDER_REVIEW: ["OPEN", "EVIDENCE_REQUESTED", "RESOLVED", "ESCALATED", "CLOSED"],
  EVIDENCE_REQUESTED: ["OPEN", "UNDER_REVIEW", "RESOLVED", "ESCALATED", "CLOSED"],
  ESCALATED: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(
  map: Record<string, ReadonlyArray<string>>,
  from: string,
  to: string
): boolean {
  return (map[from] ?? []).includes(to);
}

export function isOpenOffer(s: string): boolean {
  return (OFFER_OPEN as readonly string[]).includes(s);
}
export function isOpenLot(s: string): boolean {
  return (LOT_OPEN as readonly string[]).includes(s);
}

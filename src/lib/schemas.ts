import { z } from "zod";

/**
 * Strict, whitelist-only request schemas.
 *
 * Every mutating endpoint parses its body with one of these (or its own
 * `.strict()` schema). Unknown keys are rejected; protected fields
 * (userId/role/status/paidAt/...) have no schema here and therefore can never
 * be set by a client. All numeric fields are bounded so impossible values
 * (negative qty, absurd prices) never reach the database.
 */

export const MAX_REQUEST_BODY = 64 * 1024; // 64 KB ceiling for any API body

export const gradeEnum = z.enum(["A", "B", "C"]);
export const quantityKg = z.number().positive().max(10_000_000).finite();
export const pricePerKg = z.number().positive().max(1_000_000).finite();
export const qualityScore = z.number().int().min(0).max(100);
export const amount = z.number().positive().max(1_000_000_000).finite();

/** ISO-ish date string — parsed to a valid Date by the route. */
export const dateString = z.string().trim().min(1).max(40);
export const idString = z.string().trim().min(1).max(64);

/**
 * Media references stored by clients (photos / dispute evidence).
 * Only public https URLs or plain relative filenames with image/document
 * extensions are allowed — never file://, javascript:, data:, http://
 * internal URLs, or path traversal.
 */
export const mediaRef = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (v) =>
      /^https:\/\/[^\s]+$/i.test(v) ||
      /^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|gif|heic|avif|pdf)$/i.test(v),
    "Media reference must be an https URL or a plain image/document filename"
  );

export const mediaList = z.array(mediaRef).max(6).optional();

export const strOpt = (max: number) => z.string().trim().max(max).optional();
export const strNull = (max: number) => z.string().trim().max(max).nullish();

// ── Route bodies ─────────────────────────────────────────────────────────────

/**
 * Role entry is passwordless by design for this demo build: the client picks a
 * profile and the server resolves the seeded account. No credential is ever
 * accepted (or stored) by the API.
 */
export const enterSchema = z
  .object({
    role: z.enum(["FARMER", "FPO", "BUYER", "TRANSPORTER", "ADMIN"]),
  })
  .strict();

export const lotCreateSchema = z
  .object({
    cropId: idString,
    variety: strNull(100),
    quantityKg,
    grade: gradeEnum.optional(),
    qualityScore: qualityScore.optional(),
    location: strOpt(120),
    expectedPrice: pricePerKg,
    minPrice: pricePerKg.optional(),
    harvestDate: dateString.optional(),
    availableDate: dateString.optional(),
    packaging: strNull(200),
    storage: strNull(200),
    notes: strNull(1000),
    photos: mediaList,
  })
  .strict();

/** Statuses a lot owner may set directly (everything else is system-driven). */
export const lotOwnerStatusEnum = z.enum(["WITHDRAWN", "LISTED"]);
export const lotPatchSchema = z
  .object({
    status: lotOwnerStatusEnum.optional(),
    qualityScore: qualityScore.optional(),
    withdraw: z.boolean().optional(),
  })
  .strict();

export const offerCreateSchema = z
  .object({
    pricePerKg,
    quantityKg: quantityKg.optional(),
    message: strNull(600),
  })
  .strict();

export const offerActionEnum = z.enum(["accept", "reject", "counter"]);
export const offerPatchSchema = z
  .object({
    action: offerActionEnum,
    pricePerKg: pricePerKg.optional(),
    message: strNull(600),
  })
  .strict();

export const pickupSchema = z.object({ pickupTime: dateString.optional() }).strict();

export const logisticsActionEnum = z.enum(["accept", "status"]);
export const logisticsStatusEnum = z.enum(["PICKED_UP", "IN_TRANSIT", "DELIVERED"]);
export const logisticsPatchSchema = z
  .object({
    action: logisticsActionEnum,
    status: logisticsStatusEnum.optional(),
    note: strNull(600),
  })
  .strict();

export const paySchema = z
  .object({
    reference: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const disputeTypes = [
  "PAYMENT_ISSUE",
  "QUANTITY_MISMATCH",
  "QUALITY_DISPUTE",
  "DELIVERY_PROBLEM",
  "PRICE_OFFER_DISPUTE",
  "DAMAGE_LOSS",
  "MISCONDUCT",
] as const;
export const disputeTypeEnum = z.enum(disputeTypes);
export const disputeCreateSchema = z
  .object({
    type: disputeTypeEnum,
    description: z.string().trim().min(10).max(2000),
    orderId: idString.nullish(),
    evidence: mediaList,
  })
  .strict();

export const disputeStatuses = [
  "OPEN",
  "UNDER_REVIEW",
  "EVIDENCE_REQUESTED",
  "RESOLVED",
  "ESCALATED",
  "CLOSED",
] as const;
export const disputeStatusEnum = z.enum(disputeStatuses);
export const disputePatchSchema = z
  .object({
    status: disputeStatusEnum.optional(),
    resolution: strNull(1000),
    evidence: mediaList,
  })
  .strict();

export const demandCreateSchema = z
  .object({
    cropId: idString,
    quantityKg,
    grade: gradeEnum.optional(),
    maxPrice: z.number().positive().max(1_000_000).nullable().optional(),
    location: strOpt(120),
    requiredBy: dateString.nullish(),
  })
  .strict();

export const adminVerifySchema = z.object({ verified: z.boolean() }).strict();

// ── Lab Testing & Crop Health ────────────────────────────────────────────────

export const problemCategories = [
  "PEST",
  "DISEASE",
  "SOIL",
  "WATER",
  "NUTRIENT_DEFICIENCY",
  "CROP_QUALITY",
  "UNKNOWN",
  "OTHER",
] as const;
export const problemCategoryEnum = z.enum(problemCategories);
export const severityEnum = z.enum(["Low", "Medium", "High"]);

export const labRequestCreateSchema = z
  .object({
    crop: z.string().trim().min(1).max(60),
    variety: strNull(100),
    lotId: idString.nullish(),
    location: strOpt(120),
    problemCategory: problemCategoryEnum,
    problemDescription: z.string().trim().min(10).max(2000),
    symptoms: strNull(1000),
    dateNoticed: dateString.nullish(),
    affectedAreaPct: z.number().int().min(0).max(100).nullish(),
    severity: severityEnum.nullish(),
    preferredLabId: idString.nullish(),
    preferredDate: dateString.nullish(),
    additionalNotes: strNull(1000),
  })
  .strict();

export const labTestStatuses = [
  "DRAFT",
  "REQUESTED",
  "LAB_ACCEPTED",
  "SAMPLE_SUBMITTED",
  "TESTING",
  "REPORT_READY",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;
export const labTestStatusEnum = z.enum(labTestStatuses);
export const labRequestPatchSchema = z
  .object({ status: labTestStatusEnum })
  .strict();

export const labReportMetaSchema = z
  .object({
    crop: z.string().trim().min(1).max(60),
    testType: z.string().trim().min(1).max(80),
    reportDate: dateString.nullish(),
    labId: idString.nullish(),
    testRequestId: idString.nullish(),
    lotId: idString.nullish(),
    notes: strNull(1000),
  })
  .strict();

export const expertAskSchema = z
  .object({
    caseId: idString,
    question: z.string().trim().min(10).max(1500),
  })
  .strict();

export const expertAnswerSchema = z
  .object({ response: z.string().trim().min(10).max(3000) })
  .strict();

export const cropHealthPatchSchema = z
  .object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).optional(),
    actionTaken: strNull(1000),
  })
  .strict();

export const chatBodySchema = z
  .object({
    message: z.string().trim().min(1).max(2000).optional(),
    sessionId: idString.optional(),
    confirmActionId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9-]+$/)
      .optional(),
    cancelActionId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9-]+$/)
      .optional(),
  })
  .strict()
  .refine((b) => Boolean(b.message) || Boolean(b.confirmActionId) || Boolean(b.cancelActionId), {
    message: "Send a message or confirm/cancel an action",
  });

// ── Chat tool argument schemas ───────────────────────────────────────────────

const chatStr = (max: number) => z.string().trim().min(1).max(max).optional();
const chatQty = z.number().positive().max(10_000_000).finite();
const chatPrice = z.number().positive().max(1_000_000).finite();
const chatScore = z.number().int().min(0).max(100);

export const TOOL_ARG_SCHEMAS: Record<string, z.ZodType> = {
  get_market_prices: z.object({ crop: z.string().trim().min(1).max(60), market: chatStr(120) }).strict(),
  get_price_trend: z.object({ crop: z.string().trim().min(1).max(60), market: chatStr(120), days: z.number().int().min(3).max(30).optional() }).strict(),
  get_market_arrivals: z.object({ crop: z.string().trim().min(1).max(60) }).strict(),
  calculate_net_realisation: z
    .object({
      pricePerKg: chatPrice,
      quantityKg: chatQty,
      transport: z.number().min(0).max(10_000_000).optional(),
      handling: z.number().min(0).max(10_000_000).optional(),
      commissionPct: z.number().min(0).max(100).optional(),
      storage: z.number().min(0).max(10_000_000).optional(),
      lossPct: z.number().min(0).max(100).optional(),
    })
    .strict(),
  forecast_price: z.object({ crop: z.string().trim().min(1).max(60) }).strict(),
  find_buyers: z
    .object({
      crop: z.string().trim().min(1).max(60),
      quantityKg: chatQty.optional(),
      grade: gradeEnum.optional(),
      location: chatStr(120),
      expectedPrice: chatPrice.optional(),
    })
    .strict(),
  find_lots: z
    .object({ crop: chatStr(60), grade: gradeEnum.optional(), maxPrice: chatPrice.optional() })
    .strict(),
  get_order_status: z.object({ orderNo: z.string().trim().max(20).optional() }).strict(),
  get_payment_status: z.object({ orderNo: z.string().trim().max(20).optional() }).strict(),

  create_lot: z
    .object({
      crop: z.string().trim().min(1).max(60),
      variety: chatStr(100),
      quantityKg: chatQty,
      grade: gradeEnum.optional(),
      qualityScore: chatScore.optional(),
      location: chatStr(120),
      expectedPrice: chatPrice,
      minPrice: chatPrice.optional(),
      availableDate: dateString.optional(),
      notes: chatStr(500),
    })
    .strict(),
  send_offer: z
    .object({
      lotNo: z.string().trim().min(1).max(20),
      pricePerKg: chatPrice,
      quantityKg: chatQty.optional(),
      message: chatStr(600),
    })
    .strict(),
  counter_offer: z.object({ offerNo: z.string().trim().min(1).max(20), pricePerKg: chatPrice }).strict(),
  reject_offer: z.object({ offerNo: z.string().trim().min(1).max(20) }).strict(),
  accept_offer: z.object({ offerNo: z.string().trim().min(1).max(20) }).strict(),
  schedule_pickup: z
    .object({
      orderNo: z.string().trim().min(1).max(20),
      pickupLocation: chatStr(200),
      deliveryLocation: chatStr(200),
      pickupTime: dateString.optional(),
    })
    .strict(),
  update_delivery_status: z
    .object({ orderNo: z.string().trim().min(1).max(20), status: logisticsStatusEnum, note: chatStr(600) })
    .strict(),
  raise_grievance: z
    .object({
      type: disputeTypeEnum,
      orderNo: z.string().trim().max(20).optional(),
      description: z.string().trim().min(10).max(2000),
    })
    .strict(),
  post_buyer_demand: z
    .object({
      crop: z.string().trim().min(1).max(60),
      quantityKg: chatQty,
      grade: gradeEnum.optional(),
      maxPrice: chatPrice.optional(),
      location: chatStr(120),
    })
    .strict(),
};

// ─── Crop Planner ────────────────────────────────────────────────────────────

/** A new plot inside a crop plan. Yield/projections are computed server-side. */
export const plannerZoneSchema = z
  .object({
    zoneName: z.string().trim().min(1).max(40),
    cropName: z.string().trim().min(1).max(60),
    variety: z.string().trim().max(60).optional(),
    acreage: z.number().positive().max(1000).finite(),
    healthScore: z.number().int().min(0).max(100).optional(),
  })
  .strict();

/** A field-log entry: a lifecycle stage tick, a plot action, or an optical scan. */
export const plannerLogSchema = z
  .object({
    planId: z.string().trim().min(1).max(60),
    kind: z.enum(["STAGE_LOGGED", "ZONE_LOGGED", "SCAN_CAPTURED"]),
    label: z.string().trim().min(1).max(160),
    detail: z.string().trim().max(600).optional(),
    zoneId: z.string().trim().min(1).max(60).optional(),
    stageIndex: z.number().int().min(1).max(10).optional(),
  })
  .strict();

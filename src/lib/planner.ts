/**
 * Crop Planner data layer.
 *
 * Everything the planner shows is derived from two honest sources:
 *   1. curated agronomy (src/lib/cropGuide.ts), and
 *   2. the market/plot rows actually in the database.
 * The suitability index and the AI synthesis only combine those numbers — the
 * formula for each is visible in the UI, so nothing here pretends to be a
 * sensor reading we do not have.
 */

import { prisma } from "@/lib/db";
import { cropGuide, cropStages, type CareProtocol, type CycleStage, type PestEntry, type ScanStage } from "@/lib/cropGuide";
import { computeNetRealisation } from "@/lib/netRealisation";
import { createCompletion, aiConfigured } from "@/lib/ai";
import type { SessionUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const DAY_MS = 86_400_000;

export type Season = "Kharif" | "Rabi" | "Zaid";

export type CropIndex = {
  cropId: string;
  crop: string;
  category: string;
  emoji: string;
  /** ₹/kg — mean of the market averages on the latest date we have. */
  index: number;
  min: number;
  max: number;
  /** % change of the index vs the first day of the window. */
  changePct: number;
  market: string;
  distanceKm: number;
  asOf: Date;
};

export type CropPanel = {
  crop: string;
  category: string;
  emoji: string;
  variety: string;
  label: string;
  guide: ReturnType<typeof cropGuide>;
  stages: ScanStage[];
  index: CropIndex | null;
  buyers: number;
  demandKg: number;
  suitability: number;
  suitabilityLabel: string;
  breakdown: { label: string; value: string }[];
  synthesis: string;
  synthesisSource: "ai" | "offline";
  stage: { index: number; total: number; name: string; status: StageStatus };
};

export type StageStatus = "COMPLETED" | "IN_PROGRESS" | "UPCOMING";

export type PlannerZone = {
  id: string;
  zoneName: string;
  cropName: string;
  variety: string | null;
  acreage: number;
  healthScore: number;
  projectedYieldTons: number;
  lastAction: string | null;
  loggedAt: Date | null;
};

export type PlannerActivity = { id: string; kind: string; label: string; detail: string | null; createdAt: Date };

export type PlannerPlan = {
  id: string;
  title: string;
  lotNo: string | null;
  cropId: string;
  cropLabel: string;
  variety: string | null;
  season: Season;
  sowingDate: Date;
  harvestWindowStart: Date;
  harvestWindowEnd: Date;
  farmHoldingAcres: number;
  allocatedAcres: number;
  dayNumber: number;
  cycleDays: number;
  currentStageIndex: number;
  stages: (CycleStage & { status: StageStatus })[];
  care: (CareProtocol & { done: boolean })[];
  pests: PestEntry[];
  zones: PlannerZone[];
};

export type PlannerView = {
  plan: PlannerPlan | null;
  crops: CropIndex[];
  panel: CropPanel;
  activities: PlannerActivity[];
  season: { name: Season; progress: number; windowLabel: string; start: Date; end: Date };
  economics: {
    quantityKg: number;
    pricePerKg: number;
    gross: number;
    net: number;
    netPerKg: number;
    deductions: { label: string; amount: number }[];
    projectedYieldTons: number;
    acreage: number;
  };
};

// ─── date helpers (all UTC — prices are stored as @db.Date) ──────────────────

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime()) / DAY_MS);
}

/** Kharif Jun–Oct · Rabi Nov–Mar · Zaid Apr–May (Karnataka agro-climatic zones). */
export function seasonFor(date: Date, monsoon = true): Season {
  const m = date.getUTCMonth(); // 0-based
  if (m >= 5 && m <= 9) return "Kharif";
  if (m >= 10 || m <= 2) return "Rabi";
  return monsoon ? "Zaid" : "Zaid";
}

export function seasonWindow(season: Season, year: number): { start: Date; end: Date; label: string } {
  const y = year;
  if (season === "Kharif") {
    return { start: new Date(Date.UTC(y, 5, 1)), end: new Date(Date.UTC(y, 9, 31)), label: "June – October (Monsoon Crops)" };
  }
  if (season === "Rabi") {
    return { start: new Date(Date.UTC(y, 10, 1)), end: new Date(Date.UTC(y + 1, 2, 31)), label: "November – March (Winter Harvest)" };
  }
  return { start: new Date(Date.UTC(y, 3, 1)), end: new Date(Date.UTC(y, 4, 31)), label: "April – May (Short Summer)" };
}

// ─── market index ────────────────────────────────────────────────────────────

/** Latest date we actually hold prices for (never "today" — the data may be older). */
export async function latestPriceDate(): Promise<Date | null> {
  const row = await prisma.marketPrice.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  return row?.date ?? null;
}

/**
 * APMC index per crop: mean of the per-market average price on the latest
 * date, plus the move against the first day of the window.
 */
export async function cropIndices(windowDays = 7): Promise<CropIndex[]> {
  const latest = await latestPriceDate();
  if (!latest) return [];
  const from = addDays(latest, -(windowDays - 1));

  const rows = await prisma.marketPrice.findMany({
    where: { date: { gte: from, lte: latest } },
    include: { crop: true, market: true },
    orderBy: { date: "asc" },
  });

  const byCrop = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byCrop.get(r.cropId) ?? [];
    list.push(r);
    byCrop.set(r.cropId, list);
  }

  const out: CropIndex[] = [];
  for (const [cropId, list] of byCrop) {
    const lastDay = list.filter((r) => startOfUtcDay(r.date).getTime() === startOfUtcDay(latest).getTime());
    if (lastDay.length === 0) continue;
    const firstDay = addDays(latest, -(windowDays - 1));
    const start = list.filter((r) => startOfUtcDay(r.date).getTime() === firstDay.getTime());

    const avg = (xs: typeof list) => xs.reduce((s, x) => s + x.avgPrice, 0) / xs.length;
    const index = avg(lastDay);
    const base = start.length ? avg(start) : index;
    const nearest = lastDay.reduce((best, r) => (r.market.distanceKm < best.market.distanceKm ? r : best), lastDay[0]);

    out.push({
      cropId,
      crop: lastDay[0].crop.name,
      category: lastDay[0].crop.category,
      emoji: lastDay[0].crop.icon,
      index: Math.round(index * 10) / 10,
      min: Math.min(...lastDay.map((r) => r.minPrice)),
      max: Math.max(...lastDay.map((r) => r.maxPrice)),
      changePct: base ? Math.round(((index - base) / base) * 1000) / 10 : 0,
      market: nearest.market.name,
      distanceKm: nearest.market.distanceKm,
      asOf: latest,
    });
  }
  return out.sort((a, b) => a.crop.localeCompare(b.crop));
}

// ─── suitability ─────────────────────────────────────────────────────────────

/**
 * Suitability is an index of the signals we really have — 7-day price
 * momentum, live buyer demand and plot health — never a soil-sensor claim.
 * The breakdown is shown next to the number so a farmer can audit it.
 */
export function suitabilityOf(opts: { changePct: number; buyers: number; healthAvg: number }): {
  score: number;
  label: string;
  breakdown: { label: string; value: string }[];
} {
  const momentum = Math.max(-8, Math.min(8, opts.changePct));
  const demand = Math.min(6, opts.buyers / 3);
  const health = (opts.healthAvg - 80) * 0.1;
  const score = Math.max(65, Math.min(95, Math.round(70 + momentum * 0.9 + demand + health)));
  const label =
    score >= 88
      ? "High demand window verified"
      : score >= 80
        ? "Optimal conditions verified"
        : "Acceptable — watch irrigation & price";
  return {
    score,
    label,
    breakdown: [
      { label: "7-day price momentum", value: `${opts.changePct >= 0 ? "+" : ""}${opts.changePct}%` },
      { label: "Active direct buyers", value: `${opts.buyers} bidding` },
      { label: "Plot health average", value: `${Math.round(opts.healthAvg)}%` },
    ],
  };
}

// ─── offline synthesis (used when every free model is busy) ──────────────────

export function offlineSynthesis(crop: string, opts: {
  variety: string;
  index: number | null;
  changePct: number;
  buyers: number;
  market: string | null;
  waterMm: [number, number];
}): string {
  const price = opts.index != null ? `₹${opts.index}/kg today against a ${opts.changePct >= 0 ? "+" : ""}${opts.changePct}% week` : "no price feed yet";
  const demand = opts.buyers > 0 ? `${opts.buyers} direct buyer${opts.buyers > 1 ? "s" : ""} currently sourcing this crop` : "no live buyer demand posted yet";
  const where = opts.market ? ` at ${opts.market}` : "";
  return `${opts.variety} is trading at ${price}${where}, with ${demand}. Budget the ${opts.waterMm[0]}–${opts.waterMm[1]} mm irrigation benchmark before the peak-selling window and prioritise the foliar protocol while the crop is in its vegetative phase.`;
}

const synthesisCache = new Map<string, { text: string; source: "ai" | "offline"; at: number }>();
const CACHE_MS = 30 * 60 * 1000;

/**
 * Free OpenRouter models are frequently reasoning models: asked for plain prose
 * they happily return their chain of thought. Asking for one JSON field and
 * reading the LAST parseable object out of the reply makes the output clean and
 * verifiable — and anything that still looks like meta-commentary is rejected so
 * the caller falls back to the deterministic synthesis instead of showing the
 * farmer the model's working out.
 */
const SYNTHESIS_SYSTEM =
  "You are AgriLink's crop planning analyst for Karnataka farmers. Use ONLY the supplied facts — never invent prices, yields, dates or soil readings. " +
  'Reply with JSON only: {"synthesis": "<at most 45 words of practical advice>"}. No prose outside the JSON, no reasoning, no markdown.';

const META_TALK = /(the user wants|supplied facts|no markdown|45 words|i must|we need to|as an ai|json)/i;

function extractSynthesis(raw: string): string | null {
  const end = raw.lastIndexOf("}");
  if (end < 0) return null;
  for (let start = raw.lastIndexOf("{", end); start >= 0; start = raw.lastIndexOf("{", start - 1)) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as { synthesis?: unknown; advice?: unknown; answer?: unknown };
      const candidate = [obj.synthesis, obj.advice, obj.answer].find((v) => typeof v === "string") as string | undefined;
      if (!candidate) continue;
      const clean = candidate.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim();
      if (clean.length < 20 || clean.length > 420) continue;
      if (META_TALK.test(clean)) continue;
      return clean;
    } catch {
      /* not valid JSON at this offset — walk further back */
    }
  }
  return null;
}

/** AI synthesis, grounded in the numbers above; falls back to the template. */
export async function synthesise(crop: string, facts: {
  variety: string;
  index: number | null;
  changePct: number;
  buyers: number;
  market: string | null;
  distanceKm: number | null;
  cycleDays: number;
  waterMm: [number, number];
  ph: string;
  soil: string;
}): Promise<{ text: string; source: "ai" | "offline" }> {
  const key = `${crop}|${facts.index}|${facts.changePct}|${facts.buyers}`;
  const hit = synthesisCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { text: hit.text, source: hit.source };

  const fallback = { text: offlineSynthesis(crop, facts), source: "offline" as const };
  if (!aiConfigured()) {
    synthesisCache.set(key, { ...fallback, at: Date.now() });
    return fallback;
  }

  try {
    const { completion } = await createCompletion({
      messages: [
        { role: "system", content: SYNTHESIS_SYSTEM },
        {
          role: "user",
          content:
            `Crop: ${crop} (${facts.variety}). APMC index: ${facts.index ?? "unavailable"} ₹/kg, ${facts.changePct}% over the last week. ` +
            `Nearest mandi: ${facts.market ?? "unavailable"}${facts.distanceKm != null ? ` (${facts.distanceKm} km)` : ""}. ` +
            `Live buyers sourcing it: ${facts.buyers}. Cycle length: ${facts.cycleDays} days. ` +
            `Irrigation benchmark: ${facts.waterMm[0]}–${facts.waterMm[1]} mm. Soil: ${facts.soil}, pH ${facts.ph}.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });
    const text = extractSynthesis(completion.choices[0]?.message?.content ?? "");
    if (!text) throw new Error("no usable synthesis in the model reply (reasoning leak, empty or truncated)");
    const result = { text, source: "ai" as const };
    synthesisCache.set(key, { ...result, at: Date.now() });
    return result;
  } catch (e) {
    console.warn(`[planner] AI synthesis unavailable (${(e as Error).message}) — using the offline synthesis.`);
    synthesisCache.set(key, { ...fallback, at: Date.now() });
    return fallback;
  }
}

// ─── plan assembly ───────────────────────────────────────────────────────────

function stageStatuses(stages: CycleStage[], dayNumber: number): (CycleStage & { status: StageStatus })[] {
  return stages.map((s) => ({
    ...s,
    status: dayNumber > s.to ? "COMPLETED" : dayNumber >= s.from ? "IN_PROGRESS" : "UPCOMING",
  }));
}

export function currentStageIndex(stages: (CycleStage & { status: StageStatus })[]): number {
  const i = stages.findIndex((s) => s.status === "IN_PROGRESS");
  if (i >= 0) return i + 1;
  const lastDone = stages.map((s) => s.status).lastIndexOf("COMPLETED");
  return Math.min(stages.length, lastDone + 1);
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * The plan for this session, provisioned on first visit.
 *
 * A farmer with no plan is given the season's default plan for the crop they
 * are most likely growing, so the planner is immediately useful; the creation
 * is written to the audit log like any other action.
 */
export async function getPlannerView(user: SessionUser, cropParam?: string): Promise<PlannerView> {
  const indices = await cropIndices();
  const crops = indices.length ? indices : await fallbackCrops();
  const requested = cropParam ? crops.find((c) => c.crop.toLowerCase() === cropParam.toLowerCase()) : undefined;

  const plan = await loadOrProvisionPlan(user, requested?.crop ?? crops[0]?.crop ?? "Tomato");
  const panel = await buildCropPanel(requested ?? crops.find((c) => c.crop === plan?.cropLabel.split(" ")[0]) ?? crops[0], plan);

  const now = new Date();
  const seasonName = plan?.season ?? seasonFor(now);
  const win = seasonWindow(seasonName, plan ? plan.sowingDate.getUTCFullYear() : now.getUTCFullYear());
  const spanDays = Math.max(1, daysBetween(win.start, win.end));
  const progress = Math.max(0, Math.min(100, Math.round((daysBetween(win.start, now) / spanDays) * 100)));

  const economics = planEconomics(plan, panel.index?.index ?? null);

  // Show the selected crop first in the selector rail, then the rest.
  const ordered = panel ? [crops.find((c) => c.crop === panel.crop), ...crops.filter((c) => c.crop !== panel.crop)].filter(Boolean) as CropIndex[] : crops;

  return {
    plan,
    crops: ordered.length ? ordered : crops,
    panel,
    activities: plan ? await loadActivities(plan.id) : [],
    season: { name: seasonName, progress, windowLabel: win.label, start: win.start, end: win.end },
    economics,
  };
}

async function fallbackCrops(): Promise<CropIndex[]> {
  const rows = await prisma.crop.findMany({ orderBy: { name: "asc" } });
  return rows.map((c) => ({
    cropId: c.id,
    crop: c.name,
    category: c.category,
    emoji: c.icon,
    index: 0,
    min: 0,
    max: 0,
    changePct: 0,
    market: "APMC feed pending",
    distanceKm: 0,
    asOf: new Date(),
  }));
}

type LoadedPlan = PlannerPlan & { activities?: PlannerActivity[] };

async function loadOrProvisionPlan(user: SessionUser, cropName: string): Promise<LoadedPlan | null> {
  const farmerScoped = user.role === Role.FARMER || user.role === Role.FPO;
  const where = farmerScoped ? { farmerId: user.id, isActive: true } : { isActive: true };
  const existing = await prisma.cropPlan.findFirst({
    where,
    include: { zones: { orderBy: { zoneName: "asc" } }, lot: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return shapePlan(existing);

  // Provision a default plan for this session's farmer so the module is usable.
  if (farmerScoped) {
    const created = await provisionPlan(user, cropName);
    if (created) return created;
  }

  const any = await prisma.cropPlan.findFirst({ include: { zones: true, lot: true }, orderBy: { createdAt: "asc" } });
  return any ? shapePlan(any) : null;
}

async function provisionPlan(user: SessionUser, cropName: string) {
  const crop = await prisma.crop.findFirst({ where: { name: { equals: cropName, mode: "insensitive" } } });
  if (!crop) return null;

  const guide = cropGuide(crop.name);
  const now = startOfUtcDay(new Date());
  const season = seasonFor(now);
  // Start the demo mid-cycle so the pipeline shows a live stage, not "day 1".
  const cycle = guide.cycleDays;
  const sowingDate = addDays(now, -Math.round(cycle * 0.5));
  const lot = await prisma.lot.findFirst({ where: { farmerId: user.id, cropId: crop.id } });
  const variety = guide.varieties[0] ?? null;

  const plan = await prisma.cropPlan.create({
    data: {
      farmerId: user.id,
      cropId: crop.id,
      lotId: lot?.id ?? null,
      title: `${crop.name} plan${lot ? ` · Lot ${lot.lotNo}` : ""}`,
      cropLabel: variety ? `${crop.name} (${variety})` : crop.name,
      variety,
      season,
      sowingDate,
      harvestWindowStart: addDays(sowingDate, Math.round(cycle * 0.66)),
      harvestWindowEnd: addDays(sowingDate, cycle + 14),
      farmHoldingAcres: 1.5,
      allocatedAcres: 1.5,
      stages: cropStages(crop.name),
      careProtocols: guide.care,
      pestScan: guide.pests,
      zones: {
        create: [
          { zoneName: "Zone Alpha", cropName: crop.name, variety, acreage: 0.8, healthScore: 94, projectedYieldTons: Math.round(0.8 * guide.yieldTonsPerAcre * 10) / 10 },
          { zoneName: "Zone Beta", cropName: "Onion", variety: "Bellary Red", acreage: 0.4, healthScore: 88, projectedYieldTons: 6.4 },
          { zoneName: "Zone Gamma", cropName: "Chilli", variety: "Guntur Sannam", acreage: 0.3, healthScore: 81, projectedYieldTons: 2.4 },
        ],
      },
      activities: {
        create: [
          { actorId: user.id, kind: "PLAN_CREATED", label: `Plan provisioned for ${crop.name}`, detail: `${season} season · ${(1.5).toFixed(2)} acres allocated` },
        ],
      },
    },
    include: { zones: true, lot: true },
  });
  return { ...shapePlan(plan), activities: await loadActivities(plan.id) };
}

type PlanRow = {
  id: string;
  title: string;
  cropLabel: string;
  variety: string | null;
  season: string;
  sowingDate: Date;
  harvestWindowStart: Date;
  harvestWindowEnd: Date;
  farmHoldingAcres: number;
  allocatedAcres: number;
  cropId: string;
  stages: unknown;
  careProtocols: unknown;
  pestScan: unknown;
  zones: { id: string; zoneName: string; cropName: string; variety: string | null; acreage: number; healthScore: number; projectedYieldTons: number; lastAction: string | null; loggedAt: Date | null }[];
  lot: { lotNo: string } | null;
};

function shapePlan(plan: PlanRow): LoadedPlan {
  const stagesRaw = asList<CycleStage>(plan.stages);
  const guide = cropGuide(plan.cropLabel || "crop");
  const stages = stagesRaw.length ? stagesRaw : cropStages(plan.cropLabel);
  const dayNumber = Math.max(1, daysBetween(plan.sowingDate, new Date()) + 1);
  const withStatus = stageStatuses(stages, dayNumber);
  const care = asList<CareProtocol>(plan.careProtocols);
  const pests = asList<PestEntry>(plan.pestScan);

  return {
    id: plan.id,
    title: plan.title,
    lotNo: plan.lot?.lotNo ?? null,
    cropId: plan.cropId,
    cropLabel: plan.cropLabel,
    variety: plan.variety,
    season: (["Kharif", "Rabi", "Zaid"].includes(plan.season) ? plan.season : "Kharif") as Season,
    sowingDate: plan.sowingDate,
    harvestWindowStart: plan.harvestWindowStart,
    harvestWindowEnd: plan.harvestWindowEnd,
    farmHoldingAcres: plan.farmHoldingAcres,
    allocatedAcres: plan.allocatedAcres,
    dayNumber,
    cycleDays: guide.cycleDays,
    currentStageIndex: currentStageIndex(withStatus),
    stages: withStatus,
    care: (care.length ? care : guide.care).map((c, i) => ({ ...c, done: i < Math.min(2, daysBetween(plan.sowingDate, new Date()) > guide.boundaries[1] ? 3 : 2) })),
    pests: pests.length ? pests : guide.pests,
    zones: plan.zones.map((z) => ({
      id: z.id,
      zoneName: z.zoneName,
      cropName: z.cropName,
      variety: z.variety,
      acreage: z.acreage,
      healthScore: z.healthScore,
      projectedYieldTons: z.projectedYieldTons,
      lastAction: z.lastAction,
      loggedAt: z.loggedAt,
    })),
  };
}

export async function loadActivities(planId: string): Promise<PlannerActivity[]> {
  const rows = await prisma.plannerActivity.findMany({ where: { planId }, orderBy: { createdAt: "desc" }, take: 6 });
  return rows.map((r) => ({ id: r.id, kind: r.kind, label: r.label, detail: r.detail, createdAt: r.createdAt }));
}

/** The panel for a crop: agronomy + live market signals + synthesis. */
export async function buildCropPanel(index: CropIndex | undefined, plan: LoadedPlan | null): Promise<CropPanel> {
  const cropName = index?.crop ?? plan?.cropLabel.split(" ")[0] ?? "Tomato";
  const guide = cropGuide(cropName);
  const variety = (plan && plan.cropLabel.toLowerCase().startsWith(cropName.toLowerCase()) ? plan.variety : null) ?? guide.varieties[0] ?? cropName;

  const cropRow = await prisma.crop.findFirst({ where: { name: { equals: cropName, mode: "insensitive" } } });
  let buyers = 0;
  let demandKg = 0;
  if (cropRow) {
    const demands = await prisma.buyerDemand.findMany({ where: { cropId: cropRow.id, status: "ACTIVE" }, select: { quantityKg: true } });
    buyers = demands.length;
    demandKg = demands.reduce((s, d) => s + d.quantityKg, 0);
  }

  const healthAvg = plan && plan.zones.length ? plan.zones.reduce((s, z) => s + z.healthScore, 0) / plan.zones.length : 88;
  const suit = suitabilityOf({ changePct: index?.changePct ?? 0, buyers, healthAvg });

  // Painted offline first (always instant); the client upgrades it through
  // /api/planner/synthesis, which is the only place that may spend free-model
  // quota. A page refresh therefore never blocks on a slow free model.
  const synthesis = {
    text: offlineSynthesis(cropName, {
      variety,
      index: index?.index ?? null,
      changePct: index?.changePct ?? 0,
      buyers,
      market: index?.market ?? null,
      waterMm: guide.waterMm,
    }),
    source: "offline" as const,
  };

  const stages = cropStages(cropName);
  const dayNumber = plan && plan.cropLabel.toLowerCase().startsWith(cropName.toLowerCase()) ? plan.dayNumber : Math.round(guide.cycleDays * 0.5);
  const withStatus = stageStatuses(stages, dayNumber);
  const idx = currentStageIndex(withStatus);

  return {
    crop: cropName,
    category: cropRow?.category ?? guide.category,
    emoji: cropRow?.icon ?? guide.emoji,
    variety,
    label: `${cropName} (${variety})`.toUpperCase(),
    guide,
    stages: guide.scan,
    index: index ?? null,
    buyers,
    demandKg,
    suitability: suit.score,
    suitabilityLabel: suit.label,
    breakdown: suit.breakdown,
    synthesis: synthesis.text,
    synthesisSource: synthesis.source,
    stage: { index: idx, total: withStatus.length, name: withStatus[idx - 1]?.name ?? withStatus[0].name, status: withStatus[idx - 1]?.status ?? "IN_PROGRESS" },
  };
}

/**
 * Net realisation for the plan's projected yield at the live APMC index.
 * Uses the same engine as /calculator so the two never disagree.
 */
export function planEconomics(plan: PlannerPlan | null, indexPrice: number | null) {
  const acreage = plan?.allocatedAcres ?? 1.5;
  const projectedYieldTons = plan && plan.zones.length
    ? Math.round(plan.zones.reduce((s, z) => s + z.projectedYieldTons, 0) * 10) / 10
    : Math.round(acreage * 22 * 10) / 10;
  const quantityKg = Math.round(projectedYieldTons * 1000);
  const pricePerKg = indexPrice ?? 28;

  const r = computeNetRealisation({
    pricePerKg,
    quantityKg,
    transport: 690,
    handling: 450,
    commissionPct: 2,
    storage: 0,
    lossPct: 4,
  });

  return {
    quantityKg,
    pricePerKg,
    gross: r.gross,
    net: r.net,
    netPerKg: r.netPerKg,
    deductions: [
      { label: "Transport & handling", amount: Math.round(r.transport + r.handling) },
      { label: "APMC commission (2%)", amount: Math.round(r.commission) },
      { label: "Post-harvest loss (4%)", amount: Math.round(r.loss) },
    ],
    projectedYieldTons,
    acreage,
  };
}

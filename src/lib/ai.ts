/**
 * Single source of truth for LLM access (OpenRouter).
 *
 * HARD RULE — FREE MODELS ONLY
 * Every model this app will send a request to must be a free OpenRouter model,
 * i.e. its id ends in ":free". Priced ids are rejected here, so a wrong
 * OPENROUTER_MODEL value can never turn into a bill. Callers that find no
 * usable model fall back to their deterministic offline engine instead of
 * failing the request.
 *
 * The chain (OPENROUTER_MODEL, then OPENROUTER_FALLBACK_MODELS) exists because
 * free models are rate limited and occasionally unavailable: a request walks
 * the chain until one model answers.
 *
 * Free-tier accounts are additionally capped per day by OpenRouter (currently
 * 50 free requests/day). The offline engines make that a degradation, not an
 * outage.
 */

import OpenAI from "openai";

export const FREE_MODEL_SUFFIX = ":free";

/** Free, tool-calling capable default (fastest free model measured here). */
export const DEFAULT_FREE_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/**
 * Free, tool-calling capable backups, used when the primary is rate limited or
 * overloaded. All four were verified to return real function calls; models that
 * OpenRouter restricts to other harnesses (e.g. thinkingmachines/inkling) are
 * deliberately absent.
 */
export const DEFAULT_FREE_FALLBACKS = [
  "qwen/qwen3.8-27b:free",
  "nex-agi/nex-n2.5-pro:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

/** True only for OpenRouter ids that are free to call. */
export function isFreeModelId(id: string): boolean {
  return id.trim().toLowerCase().endsWith(FREE_MODEL_SUFFIX);
}

function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

let warnedAboutPaidModel = false;

/**
 * Ordered list of free models to try. Never empty: an empty or fully-paid
 * configuration falls back to the free defaults above.
 */
export function freeModelChain(): string[] {
  const configured = [...parseList(process.env.OPENROUTER_MODEL), ...parseList(process.env.OPENROUTER_FALLBACK_MODELS)];
  const free = configured.filter(isFreeModelId);
  if (!warnedAboutPaidModel && configured.length !== free.length) {
    warnedAboutPaidModel = true;
    console.warn(
      `[ai] Ignoring non-free model id(s): ${configured.filter((m) => !isFreeModelId(m)).join(", ")} — ` +
        `this deployment is restricted to free models (ids ending in "${FREE_MODEL_SUFFIX}").`
    );
  }
  const chain = free.length > 0 ? free : [DEFAULT_FREE_MODEL, ...DEFAULT_FREE_FALLBACKS];
  return [...new Set(chain)];
}

/** The model reported as active (first in the chain). */
export function activeModel(): string {
  return freeModelChain()[0];
}

/** Is a server-side OpenRouter key configured? Never expose this to clients. */
export function aiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

/**
 * OpenRouter key for server-side calls only. Read from the environment (or an
 * Antideploy secret, which is the same thing) — never from source code.
 */
function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
  return key;
}

/** OpenRouter is OpenAI-compatible, so the official SDK talks to it directly. */
export function aiClient(): OpenAI {
  return new OpenAI({
    apiKey: apiKey(),
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": "AgriLink",
    },
    timeout: 45_000,
    maxRetries: 0, // retries happen across the model chain, not on one model
  });
}

export type CompletionParams = Omit<
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  "model"
> & { model?: string };

export type CompletionResult = {
  completion: OpenAI.Chat.Completions.ChatCompletion;
  model: string;
  /** Models that were tried and failed before this one answered. */
  skipped: string[];
};

/**
 * Send one completion request, walking the free-model chain until a model
 * answers. Throws only when every free model failed (rate limited, offline,
 * no key) — callers catch that and use their offline engine.
 */
export async function createCompletion(params: CompletionParams): Promise<CompletionResult> {
  const client = aiClient();
  const chain = params.model && isFreeModelId(params.model) ? [params.model] : freeModelChain();
  const skipped: string[] = [];
  let lastError: unknown = null;

  for (const model of chain) {
    try {
      const completion = await client.chat.completions.create({ ...params, model });
      return { completion, model, skipped };
    } catch (e) {
      lastError = e;
      skipped.push(model);
      console.warn(`[ai] free model ${model} failed: ${(e as Error).message}`);
    }
  }
  throw new Error(
    `No free OpenRouter model answered (tried ${chain.join(", ")}): ${(lastError as Error)?.message ?? "unknown error"}`
  );
}

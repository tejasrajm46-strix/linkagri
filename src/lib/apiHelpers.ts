import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isHttpError } from "./auth";
import { MAX_REQUEST_BODY } from "./schemas";
import { requestId } from "./csrf";

/** Validation messages from our own Zod schemas are safe to surface. */
function zodMessage(e: ZodError): string {
  const first = e.issues[0];
  if (!first) return "Invalid request";
  const field = first.path.length ? `${first.path.join(".")}: ` : "";
  return `${field}${first.message}`;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, ...(data as object) }, init);
}

/**
 * Uniform error responses. HttpError-shaped errors (authz/authn/validation
 * messages we raised ourselves) are shown to the user verbatim; everything
 * else — Prisma errors, thrown exceptions, stack-worthy internals — becomes a
 * generic message while the full detail is logged server-side with a
 * correlation id.
 */
export function fail(e: unknown): NextResponse {
  if (isHttpError(e)) {
    return NextResponse.json({ ok: false, message: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json({ ok: false, message: zodMessage(e) }, { status: 400 });
  }
  const rid = requestId();
  const detail = e instanceof Error ? e.message : String(e);
  // Prisma/SQL/stack details are logged server-side only — never returned.
  console.error(`[api error ${rid}]`, detail);
  return NextResponse.json(
    { ok: false, message: "Request could not be completed", requestId: rid },
    { status: 400 }
  );
}

/**
 * Read a JSON request body, bounded to MAX_REQUEST_BODY bytes.
 * Empty bodies parse to {}. Non-JSON bodies are rejected (the SPA always
 * sends JSON with a matching Content-Type).
 */
export async function readBody<T>(req: Request): Promise<T> {
  const raw = await req.text();
  if (!raw.trim()) return {} as T;
  if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BODY) {
    throw { status: 413, message: "Request body too large" };
  }
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct && !ct.includes("application/json")) {
    throw { status: 415, message: "Content-Type must be application/json" };
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw { status: 400, message: "Invalid JSON body" };
  }
}

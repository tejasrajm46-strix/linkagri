/**
 * Environment + demo-mode helpers.
 *
 * DEMO MODE
 * Role entry (the passwordless "enter as Farmer / Buyer / Admin" screen) and the
 * demo seeder must NEVER be active in a plain production deployment. Demo mode
 * is ON only when:
 *   - DEMO_MODE=true|1 is set explicitly, OR
 *   - NODE_ENV is not "production" (local development).
 * A production deployment must set DEMO_MODE explicitly if it intentionally
 * runs the SIH demo; otherwise role entry is refused (403) and the seeder
 * refuses to run. Set DEMO_MODE=false once real user accounts and a signup
 * flow exist.
 */

export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDemoMode(): boolean {
  const v = (process.env.DEMO_MODE ?? "").toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  // No explicit flag → development defaults to demo, production does not.
  return !isProd();
}

const WEAK_SECRETS = new Set([
  "change-me-to-a-long-random-string",
  "change-me",
  "changeme",
  "secret",
  "password",
  "agrilink",
  "jwt-secret",
  "your-secret-key",
  "a-very-long-secret-key-that-is-weak",
]);

export function isWeakSecret(secret: string | undefined): boolean {
  if (!secret) return true;
  return secret.trim().length < 16 || WEAK_SECRETS.has(secret.trim().toLowerCase());
}

/**
 * Validate production secrets when a server operation needs them. This must
 * not run at module import time because Next.js evaluates route modules while
 * building and the deployment environment may only expose secrets at runtime.
 */
export function assertProductionSecrets(): void {
  if (!isProd()) return;
  if (isWeakSecret(process.env.JWT_SECRET)) {
    throw new Error(
      "JWT_SECRET is missing or too weak for production. Generate one with: openssl rand -base64 48"
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }
}

/** Parse "30m", "8h", "7d" → seconds. Falls back to the default, capped. */
export function jwtTtlSeconds(): number {
  const raw = (process.env.JWT_EXPIRES_IN ?? "8h").trim().toLowerCase();
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(raw);
  const DEFAULT = 8 * 3600;
  const MAX = 7 * 24 * 3600; // sessions may not exceed 7 days
  if (!m) return DEFAULT;
  const n = Number(m[1]);
  const mult = m[2] === "s" ? 1 : m[2] === "m" ? 60 : m[2] === "h" ? 3600 : 86400;
  const seconds = Math.max(60, Math.min(n * mult, MAX)); // >= 1 minute, <= 7 days
  return seconds;
}

/** Human duration for cookie/logging. */
export function jwtTtlLabel(): string {
  const s = jwtTtlSeconds();
  if (s % 86400 === 0) return `${s / 86400}d`;
  if (s % 3600 === 0) return `${s / 3600}h`;
  if (s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}

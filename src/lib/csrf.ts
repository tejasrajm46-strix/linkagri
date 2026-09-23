/**
 * CSRF / same-origin defense-in-depth and request metadata helpers.
 *
 * Primary CSRF protection is the SameSite=Lax httpOnly session cookie. This
 * module adds Origin/Referer validation for state-changing requests so a
 * cross-site request that somehow carries the cookie (e.g. a SameSite=Strict
 * downgrade, an embedded context, or a same-site subdomain attack) is still
 * rejected unless it truly originates from our host.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function httpError(status: number, message: string): { status: number; message: string } {
  return { status, message };
}

function normalizedHost(value: string): string {
  return value.trim().toLowerCase().replace(/:443$/, "").replace(/:80$/, "");
}

function requestHosts(req: Request): Set<string> {
  const hosts = new Set<string>();
  const host = req.headers.get("host");
  if (host) hosts.add(normalizedHost(host));

  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const first = forwardedHost.split(",")[0];
    if (first) hosts.add(normalizedHost(first));
  }

  try {
    hosts.add(normalizedHost(new URL(req.url).host));
  } catch {
    // The Host header remains the fallback for non-standard Request objects.
  }
  return hosts;
}

/**
 * Reject state-changing requests whose Origin/Referer do not match the Host.
 * Non-browser clients (no Origin, no Referer) are allowed — they cannot carry
 * ambient browser credentials, and SameSite cookies still protect them.
 */
export function assertSameOrigin(req: Request): void {
  const method = (req.method ?? "GET").toUpperCase();
  if (!MUTATING.has(method)) return;

  const hosts = requestHosts(req);
  // No host metadata: not a browser navigation/fetch; let auth decide.
  if (hosts.size === 0) return;

  const origin = req.headers.get("origin");
  if (origin) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw httpError(403, "Cross-origin request rejected");
    }
    if (!hosts.has(normalizedHost(parsed.host))) throw httpError(403, "Cross-origin request rejected");
    return;
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const parsed = new URL(referer);
      if (!hosts.has(normalizedHost(parsed.host))) throw httpError(403, "Cross-origin request rejected");
    } catch {
      throw httpError(403, "Cross-origin request rejected");
    }
    return;
  }
}

/** Best-effort client IP for rate limiting + audit logs. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Optional request identifier for correlation with server logs. */
export function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

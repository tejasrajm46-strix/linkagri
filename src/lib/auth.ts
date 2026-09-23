import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { isProd, isWeakSecret, jwtTtlSeconds } from "./env";

export const SESSION_COOKIE = "agrilink_session";
export const JWT_ISSUER = "agrilink-web";
export const JWT_AUDIENCE = "agrilink-app";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  verified: boolean;
};

type SessionClaims = SessionUser & {
  sv: number; // session version — bumped on logout for server-side revocation
  iss: string;
  aud: string;
  sub: string;
};

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set — set a strong random secret in .env (openssl rand -base64 48)");
  }
  if (isProd() && isWeakSecret(secret)) {
    // Never ship with a default/weak JWT secret: refuse to run.
    throw new Error(
      "JWT_SECRET is missing or too weak for production. Generate one with: openssl rand -base64 48"
    );
  }
  if (!isProd() && secret.trim().length < 16) {
    throw new Error("JWT_SECRET must be at least 16 characters");
  }
  return secret.trim();
}

export function signSession(user: SessionUser & { sessionVersion: number }): string {
  const claims: Omit<SessionClaims, "sub"> = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    verified: user.verified,
    sv: user.sessionVersion,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
  };
  return jwt.sign(claims, getJwtSecret(), {
    algorithm: "HS256",
    subject: user.id,
    expiresIn: jwtTtlSeconds(),
  });
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"], // reject algorithm-confusion tricks
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (typeof decoded === "string" || !decoded.sub) return null;
    const d = decoded as jwt.JwtPayload;
    if (
      typeof d.id !== "string" ||
      typeof d.sv !== "number" ||
      typeof d.role !== "string" ||
      typeof d.email !== "string"
    ) {
      return null;
    }
    return d as unknown as SessionClaims;
  } catch {
    return null; // malformed / expired / wrong issuer / tampered
  }
}

function toSessionUser(u: {
  id: string;
  name: string;
  email: string;
  role: Role;
  verified: boolean;
}): SessionUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, verified: u.verified };
}

/**
 * Read + verify the session cookie, then confirm the account still exists and
 * the session version has not been revoked. Role + verified always come from
 * the database row, never from a stale JWT payload.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, email: true, role: true, verified: true, sessionVersion: true },
    });
    if (!user || user.sessionVersion !== claims.sv) return null; // logged out / revoked
    return toSessionUser(user);
  } catch {
    return null;
  }
}

/**
 * Require an authenticated session, optionally restricted to given roles.
 * Throws an object route handlers turn into a 401/403 response.
 */
export async function requireSession(roles?: Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    throw { status: 401, message: "Not authenticated. Please log in." };
  }
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw { status: 403, message: `Access denied. This action requires the ${roles.join(" / ")} role.` };
  }
  return user;
}

export function sessionCookieMaxAge(): number {
  return jwtTtlSeconds();
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: sessionCookieMaxAge(),
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function logAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  details?: unknown
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details as object | undefined,
      },
    });
  } catch {
    // audit logging must never break the request
  }
}

/** Reject any object that has the shape of an error thrown by requireSession. */
export function isHttpError(e: unknown): e is { status: number; message: string } {
  return typeof e === "object" && e !== null && "status" in e && "message" in e;
}

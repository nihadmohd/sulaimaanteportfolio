import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-helpers";

/**
 * Session auth for the MN.KP platform (sandbox build).
 * Production note: swap for Supabase Auth — the profiles table and API
 * envelope stay identical; only this adapter changes.
 */

const rawSecret = process.env.JWT_SECRET || (process.env.NODE_ENV !== "production" ? "mnkp-dev-secret-change-in-production-9f8e7d6c5b4a" : null);

if (!rawSecret) {
  // In production, force the owner to set this in their environment variables
  throw new Error("CRITICAL: process.env.JWT_SECRET is missing. You must set this in your production environment variables to prevent forged sessions.");
}

const JWT_SECRET = new TextEncoder().encode(rawSecret);
export const SESSION_COOKIE = "mnkp_session";
const SESSION_DAYS = 7;

export type Role = "reader" | "author" | "editor" | "admin" | "advertiser";
/** Roles allowed to create/edit own posts. */
export const AUTHOR_ROLES: Role[] = ["author", "editor", "admin"];
/** Roles with full Admin & Developer console access. */
export const STAFF_ROLES: Role[] = ["editor", "admin"];
/** Roles allowed to submit client ads for review (#/studio, Task 14). */
export const AD_SUBMIT_ROLES: Role[] = ["advertiser", "editor", "admin"];

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  socials: string;
  role: Role;
  onboardingCompleted: boolean;
  onboardingStep: number;
  marketingOptIn: boolean;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

type DbUser = {
  passwordHash: string;
  verificationToken: string | null;
  resetToken: string | null;
  resetTokenExpires: Date | null;
} & Omit<SessionUser, "role"> & { role: string };

export function sanitizeUser(user: DbUser): SessionUser {
  const { passwordHash, verificationToken, resetToken, resetTokenExpires, ...safe } = user;
  return { ...safe, role: safe.role as Role };
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(JWT_SECRET);
}

export async function readSessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sub = payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") || "";
  const out: Record<string, string> = {};
  for (const part of header.split(/;\s*/)) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      out[part.slice(0, idx)] = decodeURIComponent(part.slice(idx + 1));
    }
  }
  return out;
}

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 3600}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Attach the session cookie onto an outgoing response. */
export function withSession<T>(body: T, token: string | null, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.append("set-cookie", token ? sessionCookieHeader(token) : clearSessionCookieHeader());
  return Response.json(body, { ...init, headers });
}

/** Resolve the logged-in user from the request cookie (role read fresh from DB). */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const userId = await readSessionToken(token);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return sanitizeUser(user);
}

export async function requireUser(req: Request): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }
  if (!user.isActive) {
    throw new ApiError(403, "FORBIDDEN", "This account has been deactivated. Contact support.");
  }
  return user;
}

export async function requireRole(req: Request, roles: Role[]): Promise<SessionUser> {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
  return user;
}

"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * Client session state — GET /api/auth/me.
 * A 401 envelope {ok:false,error:{code:"UNAUTHENTICATED"}} and any network
 * failure are BOTH treated as "guest" (data: null) so the shell never
 * enters throw/retry loops while APIs are still landing.
 */

export type UserRole = "reader" | "author" | "editor" | "admin";

/** Mirror of the server SessionUser (src/lib/auth.ts) with dates serialized. */
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
  role: UserRole;
  onboardingCompleted: boolean;
  onboardingStep: number;
  marketingOptIn: boolean;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SessionSubscription {
  id: string;
  planCode: string;
  status: string;
  interval: string;
  currentPeriodEnd: string | null;
  [key: string]: unknown;
}

interface SessionPayload {
  user: SessionUser;
  subscription: SessionSubscription | null;
}

/** Client-side role mirrors of src/lib/auth.ts (kept client-safe on purpose). */
export const AUTHOR_ROLES: UserRole[] = ["author", "editor", "admin"];
export const STAFF_ROLES: UserRole[] = ["editor", "admin"];

export function isAuthor(user: SessionUser | null | undefined): boolean {
  return !!user && AUTHOR_ROLES.includes(user.role);
}

export function isStaff(user: SessionUser | null | undefined): boolean {
  return !!user && STAFF_ROLES.includes(user.role);
}

async function fetchSession(): Promise<SessionPayload | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as
      | { ok: true; data: SessionPayload }
      | { ok: false; error: { code: string } };
    if (!json.ok) return null;
    return json.data ?? null;
  } catch {
    return null;
  }
}

export interface UseSessionResult {
  user: SessionUser | null;
  subscription: SessionSubscription | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

/** Current session. `user` is null for guests — never an error state. */
export function useSession(): UseSessionResult {
  const query: UseQueryResult<SessionPayload | null> = useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return {
    user: query.data?.user ?? null,
    subscription: query.data?.subscription ?? null,
    isLoading: query.isPending,
    refetch: query.refetch,
  };
}

/** True when the signed-in user can author content. */
export function useIsAuthor(): boolean {
  const { user } = useSession();
  return isAuthor(user);
}

/** True when the signed-in user reaches the Admin & Developer console. */
export function useIsStaff(): boolean {
  const { user } = useSession();
  return isStaff(user);
}

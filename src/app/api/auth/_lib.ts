import type { User } from "@prisma/client";
import { parseJsonRecord, type SafeUser } from "@/types";

/**
 * Serializers for the auth API surface (5-a owned).
 * SafeUser.socials is the PARSED JSON map (BUILD CONTRACT §4 / 2-a handoff).
 */

/** User row → public SafeUser DTO (secrets stripped, socials parsed). */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    displayName: user.displayName,
    headline: user.headline,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    location: user.location,
    websiteUrl: user.websiteUrl,
    socials: parseJsonRecord(user.socials),
    role: user.role as SafeUser["role"],
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: user.onboardingStep,
    marketingOptIn: user.marketingOptIn,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/** Normalize an email for lookups (storage + seed are lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

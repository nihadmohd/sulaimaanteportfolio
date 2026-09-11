import { parseJsonRecord, type SafeUser, type UserRole } from "@/types";

/**
 * User serializer (private to api/users/** — Task 6-a).
 *
 * Mirrors 5-a's api/auth/_lib.ts toSafeUser: SafeUser DTO with the
 * socials JSON-string column PARSED into a flat string map. Secrets
 * (passwordHash / verificationToken / resetToken*) never leave this layer.
 */

type DbUserRow = {
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
  role: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  marketingOptIn: boolean;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeUser(user: DbUserRow): SafeUser {
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
    role: user.role as UserRole,
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

export const USER_ROLES: UserRole[] = ["reader", "author", "editor", "admin"];

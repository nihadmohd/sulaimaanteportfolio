import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withApi } from "@/lib/api-helpers";
import { getSessionUser, requireUser } from "@/lib/auth";
import { parseJsonRecord, toJson } from "@/types";
import { toSafeUser } from "../_lib";

/**
 * GET /api/auth/me — session probe used by useSession().
 * Guest → 401 envelope {code:"UNAUTHENTICATED"} (client treats as guest).
 * Signed in → {user} plus a devVerifyUrl while the email is still
 * unverified (mock transport).
 */

interface MePayload {
  user: ReturnType<typeof toSafeUser>;
  devVerifyUrl?: string;
}

export const GET = withApi(async (req) => {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) {
    return fail(401, "UNAUTHENTICATED", "Please sign in to continue.");
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id } });

  const payload: MePayload = {
    user: toSafeUser(user),
  };
  if (!user.emailVerified && user.verificationToken) {
    payload.devVerifyUrl = `#/auth/verify?token=${user.verificationToken}`;
  }
  return ok(payload);
});

/**
 * PATCH /api/auth/me — profile self-service updates.
 * interests/goals persist inside the User.socials JSON map under the
 * reserved _interests / _goals keys (see worklog 5-a for the convention).
 */
const profileUpdateSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name").max(80).optional(),
    displayName: z.string().max(80).optional(),
    headline: z.string().max(120).optional(),
    location: z.string().max(80).optional(),
    websiteUrl: z.string().url("Must be a valid URL").max(600).optional().or(z.literal("")),
    bio: z.string().max(600).optional(),
    avatarUrl: z.string().max(600).optional(),
    marketingOptIn: z.boolean().optional(),
    interests: z.array(z.string().min(1).max(40)).max(12).optional(),
    goals: z.array(z.string().min(1).max(40)).max(12).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const PATCH = withApi(async (req) => {
  const sessionUser = await requireUser(req);
  const input = profileUpdateSchema.parse(await readJson(req));

  const current = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const socials = parseJsonRecord(current.socials);
  if (input.interests) socials._interests = toJson(input.interests);
  if (input.goals) socials._goals = toJson(input.goals);

  const updated = await db.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName.trim() || null } : {}),
      ...(input.headline !== undefined ? { headline: input.headline.trim() || null } : {}),
      ...(input.location !== undefined ? { location: input.location.trim() || null } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl.trim() || null } : {}),
      ...(input.bio !== undefined ? { bio: input.bio.trim() || null } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl.trim() || null } : {}),
      ...(input.marketingOptIn !== undefined ? { marketingOptIn: input.marketingOptIn } : {}),
      socials: toJson(socials),
    },
  });

  return ok({ user: toSafeUser(updated) });
});

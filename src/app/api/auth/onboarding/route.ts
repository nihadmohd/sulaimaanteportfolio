import { db } from "@/lib/db";
import { ok, readJson, withApi } from "@/lib/api-helpers";
import { onboardingSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { parseJsonRecord, toJson } from "@/types";
import { toSafeUser } from "../_lib";

/**
 * POST /api/auth/onboarding — save one wizard step.
 * Body: {step: 1..4, data: {fullName?, headline?, location?, interests?,
 * goals?, marketingOptIn?}}.
 *
 * interests/goals are persisted inside the User.socials JSON string map
 * under the reserved keys _interests / _goals (arrays JSON-encoded as
 * string values — socials values must stay flat strings). See worklog 5-a.
 *
 * onboardingStep only ever moves forward (max(current, step)); step 4
 * flips onboardingCompleted. Returns the refreshed SafeUser.
 */
export const POST = withApi(async (req) => {
  const sessionUser = await requireUser(req);
  const input = onboardingSchema.parse(await readJson(req));

  const current = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
  const socials = parseJsonRecord(current.socials);

  if (input.data.interests !== undefined) {
    socials._interests = toJson(input.data.interests);
  }
  if (input.data.goals !== undefined) {
    socials._goals = toJson(input.data.goals);
  }

  const updated = await db.user.update({
    where: { id: sessionUser.id },
    data: {
      ...(input.data.fullName !== undefined && input.data.fullName.trim().length >= 2
        ? { fullName: input.data.fullName.trim() }
        : {}),
      ...(input.data.headline !== undefined ? { headline: input.data.headline.trim() || null } : {}),
      ...(input.data.location !== undefined ? { location: input.data.location.trim() || null } : {}),
      ...(input.data.marketingOptIn !== undefined ? { marketingOptIn: input.data.marketingOptIn } : {}),
      socials: toJson(socials),
      onboardingStep: Math.max(current.onboardingStep, input.step),
      ...(input.step === 4 ? { onboardingCompleted: true } : {}),
    },
  });

  return ok({ user: toSafeUser(updated) });
});

import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { registerSchema } from "@/lib/validation";
import { createSessionToken, hashPassword, withSession } from "@/lib/auth";
import { normalizeEmail, toSafeUser } from "../_lib";

/**
 * First-run owner setup — claim the website.
 *
 * GET  /api/auth/setup → {needsSetup: boolean}
 *      needsSetup is true only while ZERO admin/editor accounts exist. The
 *      response is intentionally public (no secrets) so the sign-in pages
 *      can surface the "set up your owner account" callout.
 *
 * POST /api/auth/setup → {user}
 *      Creates the first owner account (role "admin") and auto-signs-in.
 *      Hard-gated: if any staff account already exists the endpoint 403s,
 *      so it can never be used to escalate privileges later.
 */
async function staffCount(): Promise<number> {
  return db.user.count({ where: { role: { in: ["admin", "editor"] } } });
}

export const GET = withApi(async () => {
  return ok({ needsSetup: (await staffCount()) === 0 });
});

export const POST = withApi(async (req) => {
  if ((await staffCount()) > 0) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "This website already has an owner. Sign in with your account instead."
    );
  }

  const input = registerSchema.parse(await readJson(req));
  const email = normalizeEmail(input.email);

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(
      409,
      "CONFLICT",
      "An account with this email already exists — sign in and an admin can promote it, or use a different email."
    );
  }

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      email,
      fullName: input.fullName.trim(),
      passwordHash,
      role: "admin",
      onboardingStep: 4,
      onboardingCompleted: true,
      emailVerified: true,
    },
  });

  const token = await createSessionToken(user.id);
  return withSession(
    { ok: true as const, data: { user: toSafeUser(user) } },
    token
  );
});

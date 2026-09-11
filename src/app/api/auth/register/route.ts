import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { ApiError, readJson, withApi } from "@/lib/api-helpers";
import { registerSchema } from "@/lib/validation";
import { createSessionToken, hashPassword, withSession } from "@/lib/auth";
import { normalizeEmail, toSafeUser } from "../_lib";

/**
 * POST /api/auth/register — create a reader account, auto-login via session
 * cookie, and hand back a mock-transport dev verification link.
 * Body: {fullName, email, password} → {user, devVerifyUrl}.
 */
export const POST = withApi(async (req) => {
  const input = registerSchema.parse(await readJson(req));
  const email = normalizeEmail(input.email);

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "CONFLICT", "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  // Mock email transport: the token is only surfaced via devVerifyUrl.
  const verificationToken = `${crypto.randomUUID()}${uuidv4()}`;

  const user = await db.user.create({
    data: {
      email,
      fullName: input.fullName.trim(),
      passwordHash,
      role: "reader",
      onboardingStep: 1,
      onboardingCompleted: false,
      emailVerified: false,
      verificationToken,
    },
  });

  const token = await createSessionToken(user.id);
  return withSession(
    {
      ok: true as const,
      data: {
        user: toSafeUser(user),
        devVerifyUrl: `#/auth/verify?token=${verificationToken}`,
      },
    },
    token
  );
});

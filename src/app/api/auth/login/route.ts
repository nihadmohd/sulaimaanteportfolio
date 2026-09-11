import { db } from "@/lib/db";
import { ApiError, readJson, withApi } from "@/lib/api-helpers";
import { loginSchema } from "@/lib/validation";
import { createSessionToken, verifyPassword, withSession } from "@/lib/auth";
import { normalizeEmail, toSafeUser } from "../_lib";

/**
 * POST /api/auth/login — credentials sign-in.
 * Generic 401 for unknown email OR bad password (no existence leaks);
 * deactivated accounts get a distinct 403 after the password verifies.
 * Body: {email, password} → {user}.
 */
export const POST = withApi(async (req) => {
  const input = loginSchema.parse(await readJson(req));
  const email = normalizeEmail(input.email);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid email or password.");
  }

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid email or password.");
  }

  if (!user.isActive) {
    throw new ApiError(403, "FORBIDDEN", "This account has been deactivated. Contact support to restore access.");
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await createSessionToken(user.id);
  return withSession(
    { ok: true as const, data: { user: toSafeUser(updated) } },
    token
  );
});

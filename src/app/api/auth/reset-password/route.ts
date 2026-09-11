import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { resetPasswordSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";

/**
 * POST /api/auth/reset-password — consume a reset token.
 * Body: {token, password}. Invalid or expired token → 401; success sets the
 * new hash and clears resetToken/resetTokenExpires (single-use links).
 */
export const POST = withApi(async (req) => {
  const input = resetPasswordSchema.parse(await readJson(req));

  const user = await db.user.findFirst({
    where: {
      resetToken: input.token,
      resetTokenExpires: { gt: new Date() },
    },
  });
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "This reset link is invalid or has expired. Request a new one.");
  }

  const passwordHash = await hashPassword(input.password);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpires: null },
  });

  return ok({ ok: true });
});

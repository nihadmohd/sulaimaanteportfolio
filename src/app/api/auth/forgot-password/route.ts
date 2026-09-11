import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { ok, readJson, withApi } from "@/lib/api-helpers";
import { forgotPasswordSchema } from "@/lib/validation";
import { normalizeEmail } from "../_lib";

/**
 * POST /api/auth/forgot-password — request a reset link.
 * ALWAYS {sent:true}; devResetUrl (hash route with the token) is included
 * only when the account exists — the mock transport stand-in. Response
 * shape and timing never leak account existence.
 */
export const POST = withApi(async (req) => {
  const input = forgotPasswordSchema.parse(await readJson(req));
  const email = normalizeEmail(input.email);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return ok({ sent: true });
  }

  const resetToken = `${crypto.randomUUID()}${uuidv4()}`;
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return ok({ sent: true, devResetUrl: `#/auth/reset-password?token=${resetToken}` });
});

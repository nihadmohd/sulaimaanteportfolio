import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { verifyEmailSchema } from "@/lib/validation";

/**
 * GET /api/auth/verify-email?token=... and POST /api/auth/verify-email {token}.
 * Marks emailVerified, clears the single-use verificationToken, and returns
 * {verified:true}. Unknown/already-used tokens → 404. The view handles the
 * resulting states (verifying / verified / invalid link).
 */

async function consumeVerificationToken(token: string) {
  const user = await db.user.findFirst({ where: { verificationToken: token } });
  if (!user) {
    throw new ApiError(404, "NOT_FOUND", "This verification link is invalid or has already been used.");
  }
  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null },
  });
  return user;
}

export const GET = withApi(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const input = verifyEmailSchema.parse({ token });
  await consumeVerificationToken(input.token);
  return ok({ verified: true });
});

export const POST = withApi(async (req) => {
  const input = verifyEmailSchema.parse(await readJson(req));
  await consumeVerificationToken(input.token);
  return ok({ verified: true });
});

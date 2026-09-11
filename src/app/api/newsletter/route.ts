import { db } from "@/lib/db";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { newsletterSubscribeSchema } from "@/lib/validation";

/**
 * POST /api/newsletter — public subscribe (BUILD CONTRACT §4).
 *
 * · New email        → create pending subscriber with a fresh confirmToken.
 * · Unsubscribed     → reset to pending with a fresh confirmToken.
 * · Pending/confirmed → 409 CONFLICT ("already subscribed").
 *
 * (Admin GET/PATCH/DELETE live in api/newsletter/** — owned by 6-a.)
 */

export const POST = withApi(async (req: Request) => {
  const body = newsletterSubscribeSchema.parse(await readJson(req));
  const email = body.email.toLowerCase();

  const existing = await db.newsletterSubscriber.findUnique({ where: { email } });

  if (existing) {
    if (existing.status === "unsubscribed") {
      const updated = await db.newsletterSubscriber.update({
        where: { email },
        data: {
          status: "pending",
          confirmToken: crypto.randomUUID(),
          confirmedAt: null,
          unsubscribedAt: null,
          subscribedAt: new Date(),
          source: body.source,
        },
      });
      return ok({ ok: true, status: updated.status });
    }
    throw new ApiError(409, "CONFLICT", "This email is already subscribed to the MN.KP newsletter.");
  }

  await db.newsletterSubscriber.create({
    data: {
      email,
      status: "pending",
      confirmToken: crypto.randomUUID(),
      source: body.source,
    },
  });

  return ok({ ok: true, status: "pending" }, { status: 201 });
});

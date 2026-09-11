import { db } from "@/lib/db";
import { ApiError, clientIpHash, deviceFrom, ok, withApi } from "@/lib/api-helpers";
import { getSessionUser } from "@/lib/auth";
import { findProductByIdOrSlug } from "@/app/api/_lib/serialize";

/**
 * POST /api/products/:idOrSlug/click — public outbound affiliate tracking.
 *
 * Logs an AffiliateClick row (sessionId ?? "anon-<random>", userId when
 * signed in, hashed IP, user agent, referrer, device class) and increments
 * the product's clicksCount. The frontend opens affiliateUrl AFTER this
 * call resolves.
 */

interface Ctx {
  params: Promise<{ idOrSlug: string }>;
}

interface ClickBody {
  sessionId?: unknown;
}

export const POST = withApi<Ctx>(async (req, ctx) => {
  const { idOrSlug } = await ctx.params;
  const product = await findProductByIdOrSlug(idOrSlug);
  if (!product) {
    throw new ApiError(404, "NOT_FOUND", "Product not found.");
  }

  // Body is optional and tolerant — a bare POST still tracks the click.
  let body: ClickBody = {};
  try {
    const parsed = (await req.json()) as ClickBody | null;
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    body = {};
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim().length > 0
      ? body.sessionId.trim().slice(0, 80)
      : `anon-${crypto.randomUUID()}`;

  const user = await getSessionUser(req);
  const userAgent = req.headers.get("user-agent");

  await db.affiliateClick.create({
    data: {
      productId: product.id,
      userId: user?.id ?? null,
      sessionId,
      ipHash: clientIpHash(req),
      userAgent: userAgent ? userAgent.slice(0, 400) : null,
      referrer: req.headers.get("referer")?.slice(0, 600) ?? null,
      device: deviceFrom(userAgent),
    },
  });

  const updated = await db.product.update({
    where: { id: product.id },
    data: { clicksCount: { increment: 1 } },
    select: { clicksCount: true },
  });

  return ok({ clicks: updated.clicksCount });
});

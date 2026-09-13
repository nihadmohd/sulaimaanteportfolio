import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { ApiError, ok, readJson, withApi } from "@/lib/api-helpers";
import { AUTHOR_ROLES, requireUser } from "@/lib/auth";

/**
 * POST /api/ai/assist — the editorial AI assistant (Task 12-b).
 *
 * A stateless, staff-only generation endpoint that powers the "AI assist"
 * cards in the post and product editors. Every action maps to a tightly
 * scoped prompt so the model returns paste-ready output:
 *   title      → 5 numbered headline options
 *   excerpt    → one 2-sentence excerpt (< 280 chars)
 *   tags       → up to 8 lowercase kebab tags, comma-separated
 *   outline    → markdown H2/H3 skeleton (8-14 headings)
 *   continue   → 250-400 word continuation of the draft
 *   proofread  → corrected full markdown, no commentary
 *   description→ affiliate product description in markdown (~150-220 words)
 *
 * Guardrails: author/staff roles only, per-user in-memory rate limit
 * (20 calls / 5 min), user content truncated to ~6000 chars, and the
 * z-ai-web-dev-sdk is used BACKEND ONLY (never imported client-side).
 * The zod schema lives here (not in lib/validation.ts) to respect the
 * orchestrator's file ownership.
 */

const SYSTEM_PROMPT =
  "You are the MN.KP editorial AI assistant for MOHAMMED NIHAD KP — an AI-first developer and freelancer from Calicut, Kerala writing practical, honest, professional English blog content. Be concise, concrete, no fluff, no hype.";

/** Cap on user-supplied draft text sent to the model (cost/latency control). */
const MAX_MODEL_CHARS = 6000;

const assistSchema = z.object({
  action: z.enum([
    "title",
    "excerpt",
    "tags",
    "outline",
    "continue",
    "proofread",
    "description",
  ]),
  title: z.string().trim().max(300).optional(),
  content: z.string().max(200_000).optional(),
  topic: z.string().trim().max(300).optional(),
  productName: z.string().trim().max(200).optional(),
  tagline: z.string().trim().max(200).optional(),
  specs: z.record(z.string(), z.string()).optional(),
  pros: z.array(z.string().trim().max(200)).max(10).optional(),
  cons: z.array(z.string().trim().max(200)).max(10).optional(),
});

type AssistBody = z.infer<typeof assistSchema>;

/* ------------------------------------------------------------------ */
/* in-memory rate limit — 20 calls / 5 min per user                    */
/* ------------------------------------------------------------------ */

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_CALLS = 20;
const hitsByUser = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;

  // opportunistic cleanup so the map never grows unbounded
  if (hitsByUser.size > 200) {
    for (const [key, stamps] of hitsByUser) {
      const fresh = stamps.filter((t) => t > cutoff);
      if (fresh.length === 0) hitsByUser.delete(key);
      else hitsByUser.set(key, fresh);
    }
  }

  const recent = (hitsByUser.get(userId) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX_CALLS) return true;
  recent.push(now);
  hitsByUser.set(userId, recent);
  return false;
}

/* ------------------------------------------------------------------ */
/* prompt construction                                                 */
/* ------------------------------------------------------------------ */

function clip(text: string | undefined, max = MAX_MODEL_CHARS): string {
  return (text ?? "").slice(0, max).trim();
}

function bulletList(items: string[] | undefined): string {
  const clean = (items ?? []).map((s) => s.trim()).filter(Boolean);
  return clean.length > 0 ? clean.map((s) => `- ${s}`).join("\n") : "";
}

function specList(specs: Record<string, string> | undefined): string {
  const entries = Object.entries(specs ?? {}).filter(([k]) => k.trim());
  return entries.length > 0
    ? entries.map(([k, v]) => `- ${k.trim()}: ${v}`).join("\n")
    : "";
}

function buildUserPrompt(body: AssistBody): string {
  const title = body.title ?? "";
  const content = clip(body.content);

  switch (body.action) {
    case "title":
      return [
        "Suggest 5 headline options for the blog draft below.",
        'Rules: each option is max 70 characters; output a plain numbered list like "1. First option" on separate lines; blend curiosity with clarity; no clickbait, no quotes, no labels, no commentary.',
        title ? `Current title: ${title}` : "The draft has no title yet.",
        content
          ? `Draft (may be truncated):\n${content}`
          : "The draft body is still empty — base every headline on the current title alone.",
      ]
        .filter(Boolean)
        .join("\n\n");

    case "excerpt":
      return [
        "Write ONE excerpt for the post below.",
        "Rules: exactly 2 sentences; under 280 characters total; plain text only — no quotes, no labels, no markdown; capture the concrete promise of the post.",
        `Title: ${title}`,
        `Post (may be truncated):\n${content}`,
      ].join("\n\n");

    case "tags":
      return [
        "Suggest up to 8 tags for the post below.",
        "Rules: lowercase kebab-case only (like ai-tools, freelancing-calicut); output ONLY the comma-separated list on a single line — nothing else.",
        `Title: ${title}`,
        `Post (may be truncated):\n${content}`,
      ].join("\n\n");

    case "outline": {
      const topic = body.topic || title;
      const opening = clip(body.content, 1500);
      return [
        `Create a markdown outline for an article on this topic: ${topic}.`,
        "Rules: use ## for main sections and ### for subsections; 8-14 headings total; question-style headings where they fit naturally; output only the outline — no sentences, no bullets under the headings, no commentary.",
        title ? `Working title: ${title}` : "",
        opening ? `Existing draft opening (for context, may be truncated):\n${opening}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }

    case "continue":
      return [
        "Continue writing the draft below in the same voice, tone and markdown format.",
        "Rules: write roughly 250-400 additional words; pick up the flow exactly where the draft stops; ending mid-section is fine; output only the continuation — no preamble, no summary, no commentary.",
        title ? `Title: ${title}` : "",
        `Draft so far (may be truncated):\n${content}`,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "proofread":
      return [
        "Proofread and correct the markdown draft below.",
        "Rules: fix grammar, spelling, punctuation and awkward phrasing; preserve the markdown structure exactly (headings, lists, code blocks, links, emphasis); keep the author's voice and meaning — do not rewrite for style; output the corrected full markdown ONLY, with no commentary and no diff.",
        title ? `Title: ${title}` : "",
        `Draft (may be truncated):\n${content}`,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "description": {
      const specs = specList(body.specs);
      const pros = bulletList(body.pros);
      const cons = bulletList(body.cons);
      const hasDetail = !!(specs || pros || cons);
      return [
        `Write an affiliate product description in markdown (~150-220 words) for this product: ${body.productName}${body.tagline ? ` — ${body.tagline}` : ""}.`,
        "Rules: an honest review voice — a short opening on who the product is for, what it does well, the trade-offs, and a natural closing line; weave the specs, pros and cons into the prose; short paragraphs; at most one ## heading; no hype, no invented facts, no emoji; output only the description.",
        hasDetail
          ? [
              "Product inputs:",
              specs ? `Specs:\n${specs}` : "",
              pros ? `Pros:\n${pros}` : "",
              cons ? `Cons:\n${cons}` : "",
            ]
              .filter(Boolean)
              .join("\n")
          : "No specs, pros or cons were provided — lean on the product name and tagline and keep the description general but honest.",
      ].join("\n\n");
    }
  }
}

/* ------------------------------------------------------------------ */
/* handler                                                             */
/* ------------------------------------------------------------------ */

export const POST = withApi(async (req) => {
  const user = await requireUser(req);
  if (!AUTHOR_ROLES.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "AI assist is available to authors and staff only.");
  }
  if (rateLimited(user.id)) {
    throw new ApiError(429, "RATE_LIMIT", "AI assist is busy — try again in a minute.");
  }

  const body = assistSchema.parse(await readJson(req));

  const need = (cond: boolean, message: string) => {
    if (!cond) throw new ApiError(400, "VALIDATION", message);
  };

  switch (body.action) {
    case "title":
      need(
        !!(body.title?.trim() || body.content?.trim()),
        "Add a title or some content before asking for headline ideas."
      );
      break;
    case "excerpt":
    case "tags":
    case "proofread":
      need(!!body.title?.trim(), "A title is required for this action.");
      need(!!body.content?.trim(), "Content is required for this action.");
      break;
    case "outline":
      need(!!(body.topic?.trim() || body.title?.trim()), "A topic or title is required for this action.");
      break;
    case "continue":
      need(!!(body.topic?.trim() || body.title?.trim()), "A topic or title is required for this action.");
      need(!!body.content?.trim(), "Some draft content is required to continue from.");
      break;
    case "description":
      need(!!body.productName?.trim(), "A productName is required for this action.");
      break;
  }

  const userPrompt = buildUserPrompt(body);

  let text: string | undefined;
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    });
    text = completion.choices[0]?.message?.content;
  } catch (e) {
    console.error("[ai-assist] SDK call failed", e);
    throw new ApiError(500, "SERVER", "The AI service is unreachable right now.");
  }

  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    throw new ApiError(500, "SERVER", "The AI service returned an empty response. Please try again.");
  }

  return ok({ action: body.action, text: trimmed });
});

import type { Venture } from "@prisma/client";
import { db } from "@/lib/db";
import { parseJsonArray } from "@/types";
import type { VentureDTO } from "@/types";

/** Serialize a Prisma Venture row into the public VentureDTO contract. */
export function serializeVenture(venture: Venture): VentureDTO {
  return {
    id: venture.id,
    slug: venture.slug,
    name: venture.name,
    tagline: venture.tagline,
    description: venture.description,
    category: venture.category as VentureDTO["category"],
    status: venture.status as VentureDTO["status"],
    location: venture.location,
    websiteUrl: venture.websiteUrl,
    imageUrl: venture.imageUrl,
    highlights: parseJsonArray(venture.highlights),
    collabRoles: parseJsonArray(venture.collabRoles),
    sortOrder: venture.sortOrder,
    isFeatured: venture.isFeatured,
    createdAt: venture.createdAt.toISOString(),
    updatedAt: venture.updatedAt.toISOString(),
  };
}

/** Raw row snapshot for the audit log (JSON columns stay as stored strings). */
export function ventureSnapshot(venture: Venture): Record<string, unknown> {
  return JSON.parse(JSON.stringify(venture)) as Record<string, unknown>;
}

/** Lowercase slug from a name / explicit slug (serialize.ts slugify mirror). */
export function ventureSlugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return slug.length >= 3 ? slug : "venture";
}

/** Is this slug already used by another venture (optionally excluding one id)? */
export async function ventureSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const existing = await db.venture.findFirst({
    where: { slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  return existing != null;
}

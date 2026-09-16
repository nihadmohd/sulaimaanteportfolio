import type { Ad } from "@prisma/client";
import { parseJsonArray } from "@/types";
import type { AdDTO } from "@/types";

/** Serialize a Prisma Ad row into the public AdDTO contract. */
export function serializeAd(ad: Ad): AdDTO {
  return {
    id: ad.id,
    name: ad.name,
    type: ad.type as AdDTO["type"],
    placement: ad.placement as AdDTO["placement"],
    title: ad.title,
    body: ad.body,
    imageUrl: ad.imageUrl,
    imageAlt: ad.imageAlt,
    images: parseJsonArray(ad.images),
    linkUrl: ad.linkUrl,
    linkLabel: ad.linkLabel,
    active: ad.active,
    priority: ad.priority,
    startAt: ad.startAt?.toISOString() ?? null,
    endAt: ad.endAt?.toISOString() ?? null,
    impressions: ad.impressions,
    clicks: ad.clicks,
    // ---- client campaigns + review workflow (Task 14) ----
    source: ad.source as AdDTO["source"],
    clientName: ad.clientName,
    clientCompany: ad.clientCompany,
    clientEmail: ad.clientEmail,
    monthlyRate: ad.monthlyRate,
    planCode: ad.planCode,
    reviewStatus: ad.reviewStatus as AdDTO["reviewStatus"],
    reviewNote: ad.reviewNote,
    submittedById: ad.submittedById,
    reviewedAt: ad.reviewedAt?.toISOString() ?? null,
    createdAt: ad.createdAt.toISOString(),
    updatedAt: ad.updatedAt.toISOString(),
  };
}

/** Is the ad inside its schedule window right now? (null bounds = open) */
export function adInSchedule(ad: Ad, now = new Date()): boolean {
  if (ad.startAt && ad.startAt.getTime() > now.getTime()) return false;
  if (ad.endAt && ad.endAt.getTime() < now.getTime()) return false;
  return true;
}

/** Raw row snapshot for the audit log (JSON columns stay as stored strings). */
export function adSnapshot(ad: Ad): Record<string, unknown> {
  return JSON.parse(JSON.stringify(ad)) as Record<string, unknown>;
}

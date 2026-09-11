"use client";

import * as React from "react";
import { useSettings } from "@/hooks/use-settings";

/**
 * SiteStickers — decorative corner stickers (Task 6-a, addendum ownership).
 *
 * Reads media.stickers from the shared settings query (GET /api/settings).
 * When enabled, renders fixed corner decorations: an emoji character or an
 * image/GIF URL. Purely decorative: pointer-events-none + aria-hidden,
 * opacity-80, hidden in print. The float animation is defined inline via a
 * scoped <style> tag (globals.css is orchestrator-owned).
 *
 * NOTE: sticker VALUES (including emoji characters) are admin-editable site
 * DATA stored in site_settings — the single sanctioned exception to the
 * no-emoji-in-source rule (BUILD CONTRACT §0 / 2-a). No emoji literals
 * appear in this file.
 */

interface StickerItem {
  type: string;
  value: string;
  corner: string;
}

const CORNER_CLASSES: Record<string, string> = {
  tl: "left-4 top-20",
  tr: "right-4 top-20",
  bl: "bottom-24 left-4 md:bottom-8",
  br: "bottom-24 right-4 md:bottom-8",
};

function isImageUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/");
}

export function SiteStickers() {
  const settings = useSettings();

  const stickersBlock = settings.data?.media?.stickers as
    | { enabled?: boolean; items?: StickerItem[] }
    | undefined;
  const items = Array.isArray(stickersBlock?.items) ? stickersBlock.items : [];

  if (!stickersBlock?.enabled || items.length === 0) return null;

  return (
    <>
      <style>{`@keyframes mnkp-sticker-float{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}}.mnkp-sticker{animation:mnkp-sticker-float 6s ease-in-out infinite}`}</style>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 print:hidden">
        {items.map((item, index) => {
          const corner = CORNER_CLASSES[item.corner] ?? CORNER_CLASSES.br;
          const delay = `${index * 1.1}s`;
          return (
            <span
              key={`${item.corner}-${index}`}
              className={`mnkp-sticker absolute flex opacity-80 drop-shadow-sm ${corner}`}
              style={{ animationDelay: delay }}
            >
              {isImageUrl(item.value) ? (
                <img
                  src={item.value}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-auto select-none"
                />
              ) : (
                <span className="select-none text-4xl leading-none">{item.value}</span>
              )}
            </span>
          );
        })}
      </div>
    </>
  );
}

export default SiteStickers;

"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * WishlistButton — save-for-later toggle on the product price card.
 *
 * Persists the product slug in localStorage under "mnkp_wishlist"
 * (string[], deduped, most-recent 50 kept) and toasts on toggle.
 * Product-page scoped: nothing else consumes the list yet (a later
 * task may surface it store-wide).
 */

const WISHLIST_KEY = "mnkp_wishlist";
const WISHLIST_MAX = 50;

function readWishlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function writeWishlist(list: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode / quota) — silently skip */
  }
}

export interface WishlistButtonProps {
  slug: string;
}

export function WishlistButton({ slug }: WishlistButtonProps) {
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setSaved(readWishlist().includes(slug));
  }, [slug]);

  const toggle = () => {
    const list = readWishlist();
    const has = list.includes(slug);
    const next = has
      ? list.filter((item) => item !== slug)
      : [...list, slug].slice(-WISHLIST_MAX);
    writeWishlist(next);
    setSaved(!has);
    toast({ title: has ? "Removed from your gear list" : "Saved to your gear list" });
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from your gear list" : "Save to your gear list"}
      title={saved ? "Remove from your gear list" : "Save to your gear list"}
      className="press-sm size-8 shrink-0"
    >
      <Heart
        className={cn("size-4", saved && "fill-gold text-gold")}
        aria-hidden="true"
      />
    </Button>
  );
}

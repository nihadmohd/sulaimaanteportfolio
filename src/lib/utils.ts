import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Is a product special offer live right now? (Task 14)
 * Offer must be switched on and inside its optional schedule window.
 */
export function isOfferLive(product: {
  offerActive?: boolean;
  offerStartsAt?: string | null;
  offerEndsAt?: string | null;
}): boolean {
  if (!product.offerActive) return false;
  const now = Date.now();
  if (product.offerStartsAt && new Date(product.offerStartsAt).getTime() > now) return false;
  if (product.offerEndsAt && new Date(product.offerEndsAt).getTime() < now) return false;
  return true;
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Package,
  Plus,
  X,
  ZoomIn,
} from "lucide-react";
import type { ProductDTO } from "@/types";

/**
 * ProductGalleryPro — high-tech product gallery (#/store/:slug).
 *
 *  · Mobile: horizontal swipe navigation (drag-follow + rubber-band at the
 *    ends), glass position chip "1/5", dot indicators under the frame.
 *  · Tap or zoom button opens a full-screen lightbox: pinch-zoom + pan
 *    (pointer events), wheel-zoom on desktop, double-tap toggle 1x/2.5x,
 *    keyboard arrows, prev/next chrome arrows, Esc closes. Zoom clamped
 *    1x-4x and reset on every image switch.
 *  · Thumbnails stay synced with the active image.
 *
 * All motion respects prefers-reduced-motion; listeners are passive where
 * possible (the desktop wheel listener is intentionally non-passive so the
 * page never scrolls while zooming) and everything cleans up on unmount.
 */

const SWIPE_THRESHOLD = 40;
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */
/* zoom lightbox (lazy-mounted — only rendered while open)             */
/* ------------------------------------------------------------------ */

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const RESET_TRANSFORM: Transform = { scale: 1, tx: 0, ty: 0 };

/** Keep the panned image from escaping the viewport (transform-origin: center). */
function clampTranslate(t: Transform, w: number, h: number): Transform {
  if (t.scale <= 1) return RESET_TRANSFORM;
  const maxX = ((t.scale - 1) * w) / 2;
  const maxY = ((t.scale - 1) * h) / 2;
  return { scale: t.scale, tx: clamp(t.tx, -maxX, maxX), ty: clamp(t.ty, -maxY, maxY) };
}

function rectCenter(el: HTMLElement | null): { x: number; y: number } {
  const rect = el?.getBoundingClientRect();
  if (!rect) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

type Gesture =
  | {
      type: "pan";
      startX: number;
      startY: number;
      startTx: number;
      startTy: number;
      moved: boolean;
      onBackdrop: boolean;
    }
  | {
      type: "pinch";
      startDist: number;
      startScale: number;
      startTx: number;
      startTy: number;
      startMidX: number;
      startMidY: number;
    };

interface GalleryLightboxProps {
  images: string[];
  name: string;
  active: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

function GalleryLightbox({ images, name, active, onSelect, onClose }: GalleryLightboxProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [view, setView] = React.useState<Transform>(RESET_TRANSFORM);
  const [smooth, setSmooth] = React.useState(true);
  /** Authoritative transform (state mirror kept in sync for rendering). */
  const tf = React.useRef<Transform>(RESET_TRANSFORM);
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const gesture = React.useRef<Gesture | null>(null);
  const tap = React.useRef({ time: 0, x: 0, y: 0 });
  const size = React.useRef({ w: 0, h: 0 });
  const reducedMotion = usePrefersReducedMotion();

  const commit = (next: Transform, animate: boolean) => {
    tf.current = next;
    setSmooth(animate && !reducedMotion);
    setView(next);
  };

  /* Reset zoom whenever the shown image changes. */
  React.useEffect(() => {
    commit(RESET_TRANSFORM, true);
  }, [active]);

  /* Esc closes; arrow keys browse (only meaningful with 2+ images). */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (images.length > 1) {
        if (e.key === "ArrowRight") onSelect((active + 1) % images.length);
        if (e.key === "ArrowLeft") onSelect((active - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, images.length, onClose, onSelect]);

  /* Lock page scroll + focus the dialog while open. */
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    containerRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /* Track container size for pan clamping. */
  React.useEffect(() => {
    const measure = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) size.current = { w: rect.width, h: rect.height };
    };
    measure();
    window.addEventListener("resize", measure, { passive: true });
    return () => window.removeEventListener("resize", measure);
  }, []);

  /* Desktop wheel zoom — non-passive so the page never scrolls instead. */
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = rectCenter(el);
      const s0 = tf.current.scale;
      const s1 = clamp(s0 * Math.exp(-e.deltaY * 0.0016), MIN_SCALE, MAX_SCALE);
      if (s1 === s0) return;
      // Anchor the zoom on the cursor: t1 = t0 + (s0 - s1) * (p - center)
      const next = clampTranslate(
        {
          scale: s1,
          tx: tf.current.tx + (s0 - s1) * (e.clientX - c.x),
          ty: tf.current.ty + (s0 - s1) * (e.clientY - c.y),
        },
        size.current.w,
        size.current.h
      );
      tf.current = next;
      setSmooth(false);
      setView(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    // Let the chrome buttons (close / arrows / zoom) behave natively.
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = el.getBoundingClientRect();
    size.current = { w: rect.width, h: rect.height };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic / already-captured pointers — gesture still tracked */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      gesture.current = {
        type: "pinch",
        startDist: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
        startScale: tf.current.scale,
        startTx: tf.current.tx,
        startTy: tf.current.ty,
        startMidX: (p1.x + p2.x) / 2,
        startMidY: (p1.y + p2.y) / 2,
      };
    } else {
      gesture.current = {
        type: "pan",
        startX: e.clientX,
        startY: e.clientY,
        startTx: tf.current.tx,
        startTy: tf.current.ty,
        moved: false,
        onBackdrop: e.target === el,
      };
    }
    setSmooth(false);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (g.type === "pinch" && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()];
      const dist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const s1 = clamp(g.startScale * (dist / g.startDist), MIN_SCALE, MAX_SCALE);
      const c = rectCenter(containerRef.current);
      // Anchor the pinch midpoint while following the fingers:
      // t1 = t0 + s0*(m0 - c) - s1*(m1 - c)
      const next = clampTranslate(
        {
          scale: s1,
          tx: g.startTx + g.startScale * (g.startMidX - c.x) - s1 * (midX - c.x),
          ty: g.startTy + g.startScale * (g.startMidY - c.y) - s1 * (midY - c.y),
        },
        size.current.w,
        size.current.h
      );
      tf.current = next;
      setView(next);
      return;
    }

    if (g.type === "pan") {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) g.moved = true;
      if (tf.current.scale > 1) {
        const next = clampTranslate(
          { scale: tf.current.scale, tx: g.startTx + dx, ty: g.startTy + dy },
          size.current.w,
          size.current.h
        );
        tf.current = next;
        setView(next);
      } else if (images.length > 1) {
        // Unzoomed horizontal swipe switches images (with rubber-band ends).
        const atStart = active === 0 && dx > 0;
        const atEnd = active === images.length - 1 && dx < 0;
        const tx = atStart || atEnd ? dx * 0.35 : dx;
        const next: Transform = { scale: 1, tx, ty: 0 };
        tf.current = next;
        setView(next);
      }
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (pointers.current.size === 1 && g && g.type === "pinch") {
      // One finger lifted mid-pinch — continue as a pan from here.
      const [p] = [...pointers.current.values()];
      gesture.current = {
        type: "pan",
        startX: p.x,
        startY: p.y,
        startTx: tf.current.tx,
        startTy: tf.current.ty,
        moved: true,
        onBackdrop: false,
      };
      return;
    }
    if (pointers.current.size > 0 || !g) return;

    gesture.current = null;
    const current = tf.current;

    if (current.scale <= 1) {
      // Swipe release: past the threshold → switch image, then snap home.
      if (!cancelled && images.length > 1 && Math.abs(current.tx) > SWIPE_THRESHOLD) {
        onSelect(clamp(active + (current.tx < 0 ? 1 : -1), 0, images.length - 1));
      }
      commit(RESET_TRANSFORM, true);
    } else {
      commit(clampTranslate(current, size.current.w, size.current.h), true);
    }

    if (cancelled || g.type !== "pan" || g.moved) return;

    // ----- tap handling -----
    if (g.onBackdrop) {
      onClose();
      return;
    }
    const now = performance.now();
    const isDoubleTap =
      now - tap.current.time < 320 &&
      Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) < 48;
    if (isDoubleTap) {
      tap.current = { time: 0, x: 0, y: 0 };
      if (tf.current.scale > 1) {
        commit(RESET_TRANSFORM, true);
      } else {
        // Zoom to 2.5x anchored under the finger: t1 = (p - center)*(1 - s1)
        const c = rectCenter(containerRef.current);
        commit(
          clampTranslate(
            {
              scale: DOUBLE_TAP_SCALE,
              tx: (e.clientX - c.x) * (1 - DOUBLE_TAP_SCALE),
              ty: (e.clientY - c.y) * (1 - DOUBLE_TAP_SCALE),
            },
            size.current.w,
            size.current.h
          ),
          true
        );
      }
    } else {
      tap.current = { time: now, x: e.clientX, y: e.clientY };
    }
  };

  const zoomBy = (factor: number) => {
    const s0 = tf.current.scale;
    const s1 = clamp(s0 * factor, MIN_SCALE, MAX_SCALE);
    if (s1 === s0) return;
    commit(
      clampTranslate({ scale: s1, tx: tf.current.tx, ty: tf.current.ty }, size.current.w, size.current.h),
      true
    );
  };

  const transition = smooth ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";

  // Portal to document.body: the view wrapper uses content-visibility
  // ("cv-auto"), which forms a containing block for fixed-position
  // descendants — a portal keeps the overlay truly viewport-sized.
  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — full-screen image viewer`}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex touch-none items-center justify-center bg-black/95 outline-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPointer(e, false)}
      onPointerCancel={(e) => endPointer(e, true)}
    >
      <img
        src={images[active]}
        alt={name}
        draggable={false}
        decoding="async"
        className="max-h-[86vh] max-w-[92vw] select-none object-contain"
        style={{
          transform: `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${view.scale})`,
          transition,
          willChange: "transform",
        }}
      />

      {images.length > 1 ? (
        <span
          className="glass absolute left-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums text-white/90"
          aria-hidden="true"
        >
          {active + 1}/{images.length}
        </span>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer"
        className="press-sm glass absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full text-white/90"
      >
        <X className="size-5" aria-hidden="true" />
      </button>

      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => onSelect((active - 1 + images.length) % images.length)}
            aria-label="Previous image"
            className="press-sm glass absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white/90"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onSelect((active + 1) % images.length)}
            aria-label="Next image"
            className="press-sm glass absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white/90"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </>
      ) : null}

      <div className="absolute inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 px-4 sm:px-6">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">{name}</p>
        <div className="glass flex shrink-0 items-center gap-0.5 rounded-full p-1">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.6)}
            aria-label="Zoom out"
            className="press-sm flex size-8 items-center justify-center rounded-full text-white/90"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => commit(RESET_TRANSFORM, true)}
            aria-label="Reset zoom"
            className="min-w-12 rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-white/90 transition-transform active:scale-95"
          >
            {Math.round(view.scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.6)}
            aria-label="Zoom in"
            className="press-sm flex size-8 items-center justify-center rounded-full text-white/90"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* gallery                                                             */
/* ------------------------------------------------------------------ */

export interface ProductGalleryProProps {
  product: ProductDTO;
}

export function ProductGalleryPro({ product }: ProductGalleryProProps) {
  const images = React.useMemo(
    () => [product.imageUrl, ...product.gallery].filter((src): src is string => Boolean(src)),
    [product.imageUrl, product.gallery]
  );
  const [active, setActive] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const [smooth, setSmooth] = React.useState(true);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const drag = React.useRef({ startX: 0, startY: 0, dx: 0, pointerId: -1 });
  const suppressClick = React.useRef(false);
  const rafRef = React.useRef(0);
  const reducedMotion = usePrefersReducedMotion();

  /* Reset when navigating between products. */
  React.useEffect(() => {
    setActive(0);
    setDragX(0);
    setLightboxOpen(false);
    drag.current = { startX: 0, startY: 0, dx: 0, pointerId: -1 };
  }, [product.slug]);

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const closeLightbox = React.useCallback(() => setLightboxOpen(false), []);

  const goTo = (next: number) => {
    const clamped = clamp(next, 0, images.length - 1);
    if (clamped === active) {
      setSmooth(true);
      setDragX(0);
      return;
    }
    if (reducedMotion) {
      setActive(clamped);
      setDragX(0);
      return;
    }
    // Brief directional slide-in: park the new frame offset, then settle.
    const dir = clamped > active ? 1 : -1;
    setSmooth(false);
    setDragX(dir * 36);
    setActive(clamped);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setSmooth(true);
        setDragX(0);
      });
    });
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (images.length < 2) return;
    suppressClick.current = false;
    const t = e.touches[0];
    if (!t) return;
    drag.current = { startX: t.clientX, startY: t.clientY, dx: 0, pointerId: t.identifier };
    setSmooth(false);
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (drag.current.pointerId === -1) return;
    const touch = Array.from(e.touches).find((t) => t.identifier === drag.current.pointerId);
    if (!touch) return;
    const dx = touch.clientX - drag.current.startX;
    const dy = touch.clientY - drag.current.startY;
    // Vertical intent → hand the gesture back to the page scroll.
    if (Math.abs(dx) <= Math.abs(dy) && Math.abs(dx) < 12) return;
    drag.current.dx = dx;
    const atStart = active === 0 && dx > 0;
    const atEnd = active === images.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx * 0.35 : dx);
  };

  const onTouchEnd = () => {
    if (drag.current.pointerId === -1) return;
    const dx = drag.current.dx;
    suppressClick.current = Math.abs(dx) > 10;
    drag.current = { startX: 0, startY: 0, dx: 0, pointerId: -1 };
    setSmooth(true);
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      setActive((prev) => clamp(prev + (dx < 0 ? 1 : -1), 0, images.length - 1));
      // The incoming frame continues the swipe motion into place.
      if (!reducedMotion) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(() => setDragX(0));
        });
        return;
      }
    }
    setDragX(0);
  };

  const openLightbox = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (images.length === 0) return;
    setLightboxOpen(true);
  };

  const transition =
    smooth && !reducedMotion ? "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)" : "none";

  return (
    <div>
      <div
        className="relative aspect-square w-full touch-pan-y overflow-hidden rounded-2xl border bg-muted"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {images.length > 1 ? (
          <span
            className="glass absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground/90"
            aria-hidden="true"
          >
            {active + 1}/{images.length}
          </span>
        ) : null}

        {images.length > 0 ? (
          <button
            type="button"
            onClick={openLightbox}
            aria-label={`Open ${product.name} full-screen image viewer`}
            className="absolute inset-0 flex w-full cursor-zoom-in items-center justify-center"
          >
            <img
              src={images[active]}
              alt={`${product.name} — view ${active + 1}`}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className="size-full select-none object-cover"
              style={{
                transform: dragX !== 0 ? `translate3d(${dragX}px, 0, 0)` : undefined,
                transition,
              }}
            />
          </button>
        ) : (
          <div
            aria-hidden="true"
            className="flex size-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-gold/30 via-gold/10 to-primary/25"
          >
            <Package className="size-16 text-foreground/50" strokeWidth={1.25} />
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/60">
              MN.KP Digital
            </p>
          </div>
        )}

        {images.length > 0 ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Zoom image"
            className="press-sm glass absolute bottom-3 right-3 z-10 flex size-10 items-center justify-center rounded-full text-foreground/90"
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* mobile dot indicators */}
      {images.length > 1 ? (
        <div
          className="mt-2.5 flex items-center justify-center gap-1 md:hidden"
          role="tablist"
          aria-label="Image position"
        >
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to image ${index + 1}`}
              aria-current={index === active}
              className="press-sm flex h-7 w-7 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={`block size-2 rounded-full transition-colors ${
                  index === active ? "bg-gold" : "bg-foreground/25"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}

      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product images">
          {images.map((src, index) => (
            <li key={`${src}-${index}`}>
              <button
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Show image ${index + 1}`}
                aria-current={index === active}
                className={`press-sm size-16 shrink-0 overflow-hidden rounded-lg border transition-shadow ${
                  index === active ? "border-gold ring-1 ring-gold/50" : "opacity-80 hover:opacity-100"
                }`}
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {lightboxOpen && images.length > 0 ? (
        <GalleryLightbox
          images={images}
          name={product.name}
          active={active}
          onSelect={setActive}
          onClose={closeLightbox}
        />
      ) : null}
    </div>
  );
}

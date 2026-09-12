"use client";

import * as React from "react";
import {
  ArrowRight,
  ArrowUp,
  Clock,
  Copy,
  Headphones,
  History,
  Pause,
  Play,
  Square,
  Twitter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALink } from "@/components/router/link";
import { SocialShare } from "@/components/shared/social-share";
import { formatCompact, type PostCardData } from "@/components/shared/post-card";
import { useToast } from "@/hooks/use-toast";
import { SITE } from "@/lib/constants";
import type { TtsController } from "@/hooks/use-tts";

/**
 * reading-experience — user-hooking engagement layer for the blog post page
 * (Task 12-a). Everything here is client-only, scroll-driven via ONE rAF
 * coalesced passive listener (useArticleScrollTracker), mutates DOM through
 * refs to avoid per-scroll re-renders, and degrades gracefully.
 *
 * Exports:
 * - useArticleScrollTracker  — shared progress store for the article element
 * - ReadingProgressBar       — fixed copper bar + mobile "N min left" pill
 * - MinLeftSlot              — drop-in live minutes-left line for the TOCs
 * - ResumeReading            — "continue where you stopped" banner + storage
 * - ListenCard               — "Listen to this article" TTS player
 * - QuoteSharePopover        — select-to-share quote toolbar
 * - NextUpCard               — session-aware "Up next" retention card
 * - MobileActionCluster      — floating back-to-top / share pill (mobile)
 */

/* ================================================================== */
/* scroll tracker                                                      */
/* ================================================================== */

export interface ScrollTracker {
  /** Subscribe to progress changes (0..1, 0.5% granularity). Fires once with
   *  the current value on subscribe. Returns an unsubscribe function. */
  subscribe(cb: (progress: number) => void): () => void;
  getProgress(): number;
}

/**
 * ONE rAF-coalesced passive scroll/resize listener computing reading
 * progress against the article element. Subscribers are notified only when
 * the rounded progress actually changes.
 */
export function useArticleScrollTracker(
  articleRef: React.RefObject<HTMLElement | null>
): ScrollTracker {
  const subsRef = React.useRef<Set<(progress: number) => void>>(new Set());
  const progressRef = React.useRef(0);

  const tracker = React.useMemo<ScrollTracker>(
    () => ({
      subscribe(cb) {
        subsRef.current.add(cb);
        cb(progressRef.current);
        return () => {
          subsRef.current.delete(cb);
        };
      },
      getProgress: () => progressRef.current,
    }),
    []
  );

  React.useEffect(() => {
    let raf = 0;
    let last = -1;
    const compute = () => {
      raf = 0;
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? -rect.top / total : rect.top < window.innerHeight ? 1 : 0;
      const next = Math.round(Math.min(1, Math.max(0, raw)) * 200) / 200;
      if (next !== last) {
        last = next;
        progressRef.current = next;
        subsRef.current.forEach((cb) => cb(next));
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(compute);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [articleRef]);

  return tracker;
}

/** "N min left" / "Article read" for a given progress value. */
function minutesLeftText(progress: number, readingMinutes: number): string {
  if (progress >= 0.995) return "Article read";
  const minutes = Math.max(1, Math.ceil(readingMinutes * (1 - progress)));
  return `${minutes} min left`;
}

/* ================================================================== */
/* 1 — reading progress bar                                            */
/* ================================================================== */

interface ReadingProgressBarProps {
  tracker: ScrollTracker;
  readingMinutes: number;
}

/** Thin fixed copper progress bar (z-[60], above the sticky header) plus a
 *  subtle mobile-only floating "N min left" pill above the bottom tab bar. */
export function ReadingProgressBar({ tracker, readingMinutes }: ReadingProgressBarProps) {
  const barRef = React.useRef<HTMLDivElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const pillRef = React.useRef<HTMLDivElement | null>(null);
  const pillTextRef = React.useRef<HTMLSpanElement | null>(null);
  const lastTextRef = React.useRef("");
  const lastPercentRef = React.useRef(-1);
  const pillShownRef = React.useRef(false);

  React.useEffect(
    () =>
      tracker.subscribe((progress) => {
        if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
        const percent = Math.round(progress * 100);
        if (percent !== lastPercentRef.current) {
          lastPercentRef.current = percent;
          trackRef.current?.setAttribute("aria-valuenow", String(percent));
        }
        const text = minutesLeftText(progress, readingMinutes);
        if (text !== lastTextRef.current) {
          lastTextRef.current = text;
          if (pillTextRef.current) pillTextRef.current.textContent = text;
        }
        const visible = progress > 0.03 && progress < 0.97;
        if (visible !== pillShownRef.current && pillRef.current) {
          pillShownRef.current = visible;
          pillRef.current.style.opacity = visible ? "1" : "0";
        }
      }),
    [tracker, readingMinutes]
  );

  return (
    <>
      <div
        ref={trackRef}
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        className="fixed inset-x-0 top-0 z-[60] h-[3px]"
      >
        <div
          ref={barRef}
          className="h-full w-full origin-left bg-gold"
          style={{ transform: "scaleX(0)" }}
        />
      </div>
      {/* Mobile minutes-left pill — decorative duplicate of the TOC line. */}
      <div
        ref={pillRef}
        aria-hidden="true"
        className="glass pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 z-40 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tabular-nums text-foreground/85 opacity-0 transition-opacity duration-300 md:hidden"
      >
        <span ref={pillTextRef} />
      </div>
    </>
  );
}

/** Live minutes-left line — drop into any TOC; self-subscribing. */
export function MinLeftSlot({
  tracker,
  readingMinutes,
}: {
  tracker: ScrollTracker;
  readingMinutes: number;
}) {
  const textRef = React.useRef<HTMLSpanElement | null>(null);

  React.useEffect(
    () =>
      tracker.subscribe((progress) => {
        if (textRef.current) textRef.current.textContent = minutesLeftText(progress, readingMinutes);
      }),
    [tracker, readingMinutes]
  );

  return (
    <p className="mt-4 flex items-center gap-1.5 border-t pt-3 text-[11px] font-medium tabular-nums text-muted-foreground">
      <Clock className="size-3 text-gold" aria-hidden="true" />
      <span ref={textRef} />
    </p>
  );
}

/* ================================================================== */
/* 2 — listen to this article (TTS player)                             */
/* ================================================================== */

interface ListenCardProps {
  tts: TtsController;
  readingMinutes: number;
}

/** Compact narration player — the flagship high-tech hook. Renders nothing
 *  when the browser lacks SpeechSynthesis. */
export function ListenCard({ tts, readingMinutes }: ListenCardProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  // Word-boundary progress + chunk changes drive the track via refs (no
  // re-renders while narrating).
  React.useEffect(() => {
    const setWidth = (progress: number) => {
      if (trackRef.current) trackRef.current.style.width = `${(progress * 100).toFixed(1)}%`;
    };
    setWidth(tts.chunkIndex / Math.max(1, tts.chunkCount));
    return tts.subscribeBoundary(setWidth);
  }, [tts.chunkIndex, tts.chunkCount, tts.subscribeBoundary]);

  if (!tts.supported) return null;

  const playing = tts.status === "playing";
  const paused = tts.status === "paused";
  const playLabel = playing ? "Pause narration" : paused ? "Resume narration" : "Play narration";
  const rateLabel = `${tts.rate}x`;

  return (
    <section aria-label="Listen to this article" className="mt-4 max-w-3xl">
      <div className="rounded-2xl border border-gold/35 bg-card p-4 shadow-xs sm:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            type="button"
            size="icon"
            onClick={tts.toggle}
            aria-label={playLabel}
            className="press-sm size-11 shrink-0 rounded-full bg-gold text-black shadow-xs hover:bg-gold/90"
          >
            {playing ? (
              <Pause className="size-5" aria-hidden="true" />
            ) : (
              <Play className="size-5 translate-x-0.5" aria-hidden="true" />
            )}
          </Button>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Headphones className="size-4 shrink-0 text-gold" aria-hidden="true" />
              Listen to this article
            </p>
            <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
              {tts.error ?? (
                <>
                  Narrated reading — {readingMinutes} min
                  {playing || paused ? ` · part ${tts.chunkIndex + 1} of ${tts.chunkCount}` : ""}
                </>
              )}
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                ref={trackRef}
                className="h-full w-0 rounded-full bg-gold transition-[width] duration-300"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={tts.cycleRate}
              aria-label={`Narration speed ${rateLabel}, press to change speed`}
              className="press-sm h-9 rounded-full border border-gold/40 px-3 text-xs font-semibold tabular-nums text-gold transition-colors hover:bg-gold/10"
            >
              {rateLabel}
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={tts.stop}
              aria-label="Stop narration"
              className="press-sm size-9 rounded-full text-muted-foreground hover:border-gold/60 hover:text-gold"
            >
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Keyboard shortcut hints (desktop nicety). */}
        <div
          className="mt-3 hidden items-center gap-4 text-[10px] text-muted-foreground md:flex"
          aria-hidden="true"
        >
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">t</kbd>
            play / pause
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">s</kbd>
            share
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>
            stop
          </span>
        </div>
        <p className="sr-only">
          Keyboard shortcuts: press T to play or pause the narration, S to jump to the share
          controls, and Escape to stop the narration.
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {playing ? "Narration playing" : paused ? "Narration paused" : "Narration stopped"}
        </p>
      </div>
    </section>
  );
}

/* ================================================================== */
/* 3 — resume reading                                                  */
/* ================================================================== */

const READ_POS_PREFIX = "mnkp_read_pos_";
const READ_DISMISS_PREFIX = "mnkp_read_dismiss_";
const READ_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredPosition {
  p: number;
  t: number;
}

function readStoredPosition(slug: string): number | null {
  try {
    const raw = window.localStorage.getItem(`${READ_POS_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "p" in parsed && "t" in parsed) {
      const { p, t } = parsed as { p: unknown; t: unknown };
      if (
        typeof p === "number" &&
        typeof t === "number" &&
        p >= 0.08 &&
        p <= 0.85 &&
        Date.now() - t < READ_MAX_AGE_MS
      ) {
        return p;
      }
    }
  } catch {
    /* private mode or corrupted entry — treat as absent */
  }
  return null;
}

interface ResumeReadingProps {
  slug: string;
  articleRef: React.RefObject<HTMLElement | null>;
  tracker: ScrollTracker;
}

/** Slim dismissible "Continue where you stopped" banner. Saves scroll
 *  progress to localStorage (throttled) and clears it when finished. */
export function ResumeReading({ slug, articleRef, tracker }: ResumeReadingProps) {
  const [resumePercent, setResumePercent] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (window.sessionStorage.getItem(`${READ_DISMISS_PREFIX}${slug}`)) return;
    const stored = readStoredPosition(slug);
    if (stored !== null) setResumePercent(stored);
  }, [slug]);

  const dismiss = React.useCallback(() => {
    setResumePercent(null);
    try {
      window.sessionStorage.setItem(`${READ_DISMISS_PREFIX}${slug}`, "1");
    } catch {
      /* session storage unavailable — banner simply won't re-show */
    }
  }, [slug]);

  // Reader scrolled on their own — retire the banner and arm saving.
  React.useEffect(() => {
    if (resumePercent === null) return;
    return tracker.subscribe((progress) => {
      if (progress > 0.04) dismiss();
    });
  }, [tracker, resumePercent, dismiss]);

  // Throttled save — never while the banner is on screen, so a stored
  // position can't be overwritten before the reader jumps back.
  React.useEffect(() => {
    let lastWrite = 0;
    const save = (progress: number) => {
      const key = `${READ_POS_PREFIX}${slug}`;
      try {
        if (progress > 0.92) {
          window.localStorage.removeItem(key);
          return;
        }
        if (progress < 0.02) return;
        window.localStorage.setItem(
          key,
          JSON.stringify({ p: Math.round(progress * 1000) / 1000, t: Date.now() } satisfies StoredPosition)
        );
      } catch {
        /* storage full / private mode — best effort */
      }
    };
    const unsubscribe = tracker.subscribe((progress) => {
      if (resumePercent !== null) return;
      const now = Date.now();
      if (now - lastWrite < 900) return;
      lastWrite = now;
      save(progress);
    });
    const flush = () => {
      if (resumePercent !== null) return;
      save(tracker.getProgress());
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [tracker, slug, resumePercent]);

  const jumpBack = () => {
    const el = articleRef.current;
    const percent = resumePercent;
    if (!el || percent === null) return;
    const rect = el.getBoundingClientRect();
    const total = Math.max(0, rect.height - window.innerHeight);
    const top = window.scrollY + rect.top + total * percent;
    requestAnimationFrame(() => {
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
    dismiss();
  };

  if (resumePercent === null) return null;

  return (
    <div className="mt-6 max-w-3xl" role="region" aria-label="Resume reading">
      <div className="flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/[0.07] py-2 pl-3 pr-1.5 sm:gap-3 sm:pl-4 sm:pr-2">
        <History className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs leading-snug text-foreground/85 sm:text-sm">
          <span className="font-semibold text-foreground">Continue where you stopped</span>
          <span className="text-muted-foreground"> — {Math.round(resumePercent * 100)}% read</span>
        </p>
        <Button
          type="button"
          size="sm"
          onClick={jumpBack}
          className="press-sm h-8 rounded-full bg-gold px-3.5 text-black shadow-xs hover:bg-gold/90"
        >
          Jump back
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss resume suggestion"
          className="press-sm flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 4 — select-to-share quote                                           */
/* ================================================================== */

interface QuoteSharePopoverProps {
  contentRef: React.RefObject<HTMLDivElement | null>;
  tracker: ScrollTracker;
  title: string;
  slug: string;
}

interface QuotePopoverState {
  x: number;
  y: number;
  quote: string;
}

/** Floating "Share quote / Copy" toolbar that appears when the reader
 *  selects text inside the article body. No libraries — one debounced
 *  selectionchange listener plus mouseup/touchend fast paths. */
export function QuoteSharePopover({ contentRef, tracker, title, slug }: QuoteSharePopoverProps) {
  const { toast } = useToast();
  const [popover, setPopover] = React.useState<QuotePopoverState | null>(null);

  const clearSelection = React.useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setPopover(null);
  }, []);

  const evaluate = React.useCallback(() => {
    const selection = window.getSelection();
    const container = contentRef.current;
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !container) {
      setPopover(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const ancestor = range.commonAncestorContainer;
    const element =
      ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as Element) : ancestor.parentElement;
    if (!element || !container.contains(element)) {
      setPopover(null);
      return;
    }
    const raw = selection.toString().replace(/\s+/g, " ").trim();
    if (raw.length < 4) {
      setPopover(null);
      return;
    }
    const quote = raw.length > 200 ? `${raw.slice(0, 197).trimEnd()}…` : raw;
    const rect = range.getBoundingClientRect();
    const estimatedWidth = 190;
    const x = Math.min(
      Math.max(8, rect.left + rect.width / 2 - estimatedWidth / 2),
      Math.max(8, window.innerWidth - estimatedWidth - 8)
    );
    const below = rect.top < 96;
    const y = below ? rect.bottom + 8 : rect.top - 52;
    setPopover({
      x: Math.round(x),
      y: Math.round(Math.max(8, Math.min(window.innerHeight - 56, y))),
      quote,
    });
  }, [contentRef]);

  React.useEffect(() => {
    let timer = 0;
    const debounced = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(evaluate, 220);
    };
    const onPointerUp = () => {
      window.clearTimeout(timer);
      evaluate();
    };
    const onHide = () => {
      window.clearTimeout(timer);
      setPopover(null);
    };
    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchend", onPointerUp, { passive: true });
    document.addEventListener("selectionchange", debounced);
    window.addEventListener("resize", onHide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
      document.removeEventListener("selectionchange", debounced);
      window.removeEventListener("resize", onHide);
    };
  }, [evaluate]);

  // Hide as soon as the page scrolls (stale position) or Escape is pressed.
  React.useEffect(() => tracker.subscribe(() => setPopover(null)), [tracker]);
  React.useEffect(() => {
    if (!popover) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover]);

  const shareQuote = () => {
    if (!popover) return;
    const shareText = `«${popover.quote}» — ${title}`;
    const shareUrl = `${SITE.url}/#/blog/${slug}`;
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer,width=580,height=540"
    );
    clearSelection();
  };

  const copyQuote = async () => {
    if (!popover) return;
    const text = `«${popover.quote}» — ${title} ${window.location.origin}/#/blog/${slug}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Quote copied",
        description: "The quote and its source link are on your clipboard.",
      });
    } catch {
      toast({ title: "Could not copy", description: "Copy the quote manually.", variant: "destructive" });
    }
    clearSelection();
  };

  if (!popover) return null;

  return (
    <div
      role="toolbar"
      aria-label="Share the selected quote"
      onMouseDown={(event) => event.preventDefault()}
      className="glass fixed z-50 flex items-center gap-0.5 rounded-full p-1 shadow-lg"
      style={{ left: popover.x, top: popover.y }}
    >
      <button
        type="button"
        onClick={shareQuote}
        aria-label="Share the selected quote on X"
        className="press-sm flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-foreground/85 transition-colors hover:bg-gold/15 hover:text-gold"
      >
        <Twitter className="size-3.5" aria-hidden="true" />
        Share quote
      </button>
      <span aria-hidden="true" className="h-4 w-px bg-border" />
      <button
        type="button"
        onClick={copyQuote}
        aria-label="Copy the selected quote"
        className="press-sm flex size-9 items-center justify-center rounded-full text-foreground/85 transition-colors hover:bg-gold/15 hover:text-gold"
      >
        <Copy className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/* ================================================================== */
/* 6 — up next                                                         */
/* ================================================================== */

const VISITED_KEY = "mnkp_visited_posts";

function readVisitedSlugs(): string[] {
  try {
    const raw = window.sessionStorage.getItem(VISITED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((slug): slug is string => typeof slug === "string");
  } catch {
    /* corrupted entry — start fresh */
  }
  return [];
}

function writeVisitedSlugs(slugs: string[]): void {
  try {
    window.sessionStorage.setItem(VISITED_KEY, JSON.stringify(slugs.slice(-60)));
  } catch {
    /* session storage unavailable — next-up falls back to popularity */
  }
}

interface NextUpCardProps {
  currentSlug: string;
  /** Related posts (already excluding the current one). */
  posts: PostCardData[];
}

/** Session-aware "Up next" card — picks the first related post the reader
 *  has not visited this session, falling back to the most-viewed one. */
export function NextUpCard({ currentSlug, posts }: NextUpCardProps) {
  const [pick, setPick] = React.useState<PostCardData | null>(null);

  React.useEffect(() => {
    if (posts.length === 0) {
      setPick(null);
      return;
    }
    const visited = readVisitedSlugs();
    if (!visited.includes(currentSlug)) {
      visited.push(currentSlug);
      writeVisitedSlugs(visited);
    }
    const unvisited = posts.find((post) => !visited.includes(post.slug));
    const chosen = unvisited ?? [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0] ?? null;
    setPick((prev) => (prev?.slug === chosen?.slug ? prev : chosen));
  }, [currentSlug, posts]);

  if (!pick) return null;

  return (
    <section aria-label="Up next" className="mt-10 max-w-3xl">
      <ALink
        href={`#/blog/${pick.slug}`}
        className="press group block rounded-2xl border bg-card p-3 shadow-xs transition-colors hover:border-gold/50 sm:p-4"
      >
        <span className="flex items-stretch gap-3 sm:gap-4">
          <span className="relative block w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-primary/20 to-gold/25 sm:w-44">
            {pick.coverImage ? (
              <img
                src={pick.coverImage}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <ArrowRight className="size-6 text-gold" />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 py-0.5 pr-1">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
              Up next
              <span className="h-px w-6 bg-gold/40" aria-hidden="true" />
              <span className="font-medium normal-case tracking-normal text-muted-foreground">
                auto-picked
              </span>
            </span>
            <span className="mt-1.5 block truncate text-base font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-lg">
              {pick.title}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {pick.category ? (
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                  {pick.category}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="size-3" aria-hidden="true" />
                {pick.readingMinutes} min
              </span>
              <span className="tabular-nums">{formatCompact(pick.views)} views</span>
            </span>
          </span>
          <ArrowRight
            className="hidden size-5 shrink-0 self-center text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-gold sm:block"
            aria-hidden="true"
          />
        </span>
      </ALink>
      <p className="sr-only">Automatically picked from what you have not read this session.</p>
    </section>
  );
}

/* ================================================================== */
/* 7 — mobile floating action cluster                                  */
/* ================================================================== */

interface MobileActionClusterProps {
  tracker: ScrollTracker;
  shareTitle: string;
  sharePath: string;
}

/** Glassy floating pill above the mobile tab bar — back-to-top (after 30%
 *  of the article) + share. Hidden entirely on md+ screens. */
export function MobileActionCluster({ tracker, shareTitle, sharePath }: MobileActionClusterProps) {
  const [showTop, setShowTop] = React.useState(false);
  const shownRef = React.useRef(false);

  React.useEffect(
    () =>
      tracker.subscribe((progress) => {
        const should = progress >= 0.3;
        if (should !== shownRef.current) {
          shownRef.current = should;
          setShowTop(should);
        }
      }),
    [tracker]
  );

  return (
    <div
      role="group"
      aria-label="Quick actions"
      className="glass fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-0.5 rounded-full p-1 md:hidden"
    >
      {showTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="press-sm view-enter flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-gold/15 hover:text-gold"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      ) : null}
      <SocialShare
        title={shareTitle}
        path={sharePath}
        className="h-11 rounded-full border-0 bg-transparent px-4 text-xs font-medium text-muted-foreground shadow-none hover:bg-gold/15 hover:text-gold"
      />
    </div>
  );
}

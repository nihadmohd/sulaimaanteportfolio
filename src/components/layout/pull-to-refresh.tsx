"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PullToRefresh — the native Android/iOS pull-to-refresh gesture for the
 * whole app (Task 12-e).
 *
 * Only active on coarse-pointer (touch) devices. When the document is
 * scrolled to the very top and the user drags down, a circular indicator
 * follows the finger (damped); past PULL_THRESHOLD px and released, it
 * snaps into a spinner, refetches every ACTIVE react-query (the current
 * screen's data — exactly what a native app refreshes), flashes a check
 * when settled, then slides away.
 *
 * Skips when an overlay owns the screen (Radix locks body scroll for
 * sheets/dialogs/menus) or the touch started inside a scrollable sub-area
 * (sheets, lightbox, inner rails) so those keep their native physics.
 *
 * Relies on the global `overscroll-behavior-y: none` (globals.css) which
 * kills the browser's own rubber-band — this component IS the replacement.
 */

const PULL_THRESHOLD = 72; // px of finger travel needed to arm a refresh
const DAMPING = 0.42; // indicator follows at 42% of travel
const MAX_INDICATOR = 88; // indicator never translates further than this
const MAX_SETTLE_MS = 3000; // even if queries hang, the spinner gives up

type Phase = "idle" | "refreshing" | "done";

export function PullToRefresh() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [pull, setPull] = React.useState(0); // damped px while pulling

  const stateRef = React.useRef({
    startY: 0,
    tracking: false,
    armed: false,
    refreshing: false,
  });

  // Coarse-pointer gate — desktop never mounts listeners (also avoids
  // dev-server mouse "touch" emulation quirks).
  const [touchDevice, setTouchDevice] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setTouchDevice(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  React.useEffect(() => {
    if (!touchDevice) return;

    const s = stateRef.current;

    /** True when an overlay (sheet/dialog/menu/lightbox) owns the screen. */
    const overlayOpen = () =>
      document.body.style.overflow === "hidden" ||
      document.body.style.pointerEvents === "none" ||
      Boolean(document.querySelector("[data-state='open'][role='dialog'], [data-radix-focus-guard]"));

    /** True when the touch began inside an internal scroll area. */
    const inInternalScroller = (target: EventTarget | null) =>
      target instanceof Element &&
      Boolean(
        target.closest(
          "[role='dialog'], [data-state='open'], .overflow-y-auto, .overflow-x-auto, .scrollbar-slim, [data-pull-skip]"
        )
      );

    const onTouchStart = (event: TouchEvent) => {
      if (s.refreshing) return;
      if (overlayOpen() || inInternalScroller(event.target)) {
        s.tracking = false;
        return;
      }
      // Only start when the document itself is at the very top.
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
        s.tracking = false;
        return;
      }
      s.tracking = true;
      s.armed = false;
      s.startY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!s.tracking) return;
      const y = event.touches[0]?.clientY ?? s.startY;
      const delta = y - s.startY;
      if (delta <= 0 || window.scrollY > 0) {
        setPull(0);
        s.armed = false;
        return;
      }
      const damped = Math.min(delta * DAMPING, MAX_INDICATOR);
      setPull(damped);
      s.armed = damped >= PULL_THRESHOLD * DAMPING;
    };

    const runRefresh = () => {
      s.refreshing = true;
      setPhase("refreshing");
      setPull(44); // resting spinner position
      const refetch = queryClient
        .refetchQueries({ type: "active" })
        .catch(() => undefined);
      const timeout = new Promise((resolve) => setTimeout(resolve, MAX_SETTLE_MS));
      Promise.race([refetch, timeout]).then(() => {
        setPhase("done");
        window.setTimeout(() => {
          setPhase("idle");
          setPull(0);
          s.refreshing = false;
        }, 650);
      });
    };

    const onTouchEnd = () => {
      if (!s.tracking) return;
      s.tracking = false;
      if (s.armed) {
        runRefresh();
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [touchDevice, queryClient]);

  if (!touchDevice) return null;

  const visible = phase !== "idle" || pull > 0;
  const translateY = phase === "refreshing" || phase === "done" ? 44 : pull;
  const armed = pull >= PULL_THRESHOLD * DAMPING;

  return (
    <div
      aria-hidden={!visible}
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed left-1/2 top-3 z-[70]",
        !visible && "opacity-0"
      )}
      style={{ transform: `translate(-50%, ${translateY - 48}px)` }}
    >
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full border shadow-lg transition-colors",
          phase === "idle" && armed
            ? "border-gold/60 bg-gold/10 text-gold"
            : "border-border bg-card text-muted-foreground"
        )}
      >
        {phase === "refreshing" ? (
          <Loader2 className="size-5 animate-spin text-gold" aria-hidden="true" />
        ) : phase === "done" ? (
          <Check className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <span aria-hidden="true" className="text-sm font-semibold leading-none">
            {armed ? "↻" : "↓"}
          </span>
        )}
      </div>
      <span className="sr-only">
        {phase === "refreshing" ? "Refreshing content" : phase === "done" ? "Content refreshed" : ""}
      </span>
    </div>
  );
}

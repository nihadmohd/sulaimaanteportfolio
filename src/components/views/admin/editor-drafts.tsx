"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "./_shared";

/**
 * editor-drafts — local crash recovery for the long-form editors
 * (Task 12-b).
 *
 * useDraftAutosave keeps a debounced (1.5s) snapshot of the editor state
 * in localStorage while the form is dirty. On the next visit — once the
 * server copy is ready — a differing, newer snapshot raises a banner so
 * work lost to a crash/refresh can be restored in one click. The snapshot
 * is wiped after a successful server save or an explicit discard. All
 * localStorage failures (quota, private mode) are swallowed silently:
 * crash recovery is best-effort, never blocking.
 */

export interface DraftSnapshot<T> {
  savedAt: number;
  data: T;
}

export interface DraftAutosaveConfig<T> {
  /** localStorage key, e.g. `mnkp_draft_post_{id|new}`. */
  key: string;
  /** true once the server copy is loaded (or immediately when creating). */
  ready: boolean;
  /** snapshots are only written while the form is dirty. */
  isDirty: boolean;
  /** value that changes as the user edits — drives the debounce timer. */
  tick: unknown;
  /** serialize the full editor state. */
  capture: () => T;
  /** true when the snapshot differs from the server copy (and is newer). */
  differs: (snapshot: DraftSnapshot<T>) => boolean;
  /** fill the form from a restored snapshot. */
  onRestore: (data: T) => void;
}

export interface DraftAutosave<T> {
  snapshot: DraftSnapshot<T> | null;
  restore: () => void;
  discard: () => void;
  /** wipe the stored snapshot — call after a successful server save. */
  clear: () => void;
}

export function useDraftAutosave<T>(config: DraftAutosaveConfig<T>): DraftAutosave<T> {
  const [snapshot, setSnapshot] = React.useState<DraftSnapshot<T> | null>(null);

  // latest-config ref so stable callbacks always act on fresh closures
  const cfg = React.useRef(config);
  React.useEffect(() => {
    cfg.current = config;
  });

  // recovery check — runs exactly once, right after the editor becomes ready
  const checkedRef = React.useRef(false);
  React.useEffect(() => {
    if (!config.ready || checkedRef.current) return;
    checkedRef.current = true;
    try {
      const raw = window.localStorage.getItem(config.key);
      if (!raw) return;
      const snap = JSON.parse(raw) as DraftSnapshot<T>;
      if (!snap || typeof snap.savedAt !== "number" || snap.data == null) return;
      if (!cfg.current.differs(snap)) return;
      setSnapshot(snap);
    } catch {
      // corrupted snapshot — ignore silently
    }
  }, [config.ready, config.key]);

  // debounced snapshot writes while dirty
  React.useEffect(() => {
    if (!config.isDirty) return;
    const timer = window.setTimeout(() => {
      try {
        const snap: DraftSnapshot<T> = { savedAt: Date.now(), data: cfg.current.capture() };
        window.localStorage.setItem(config.key, JSON.stringify(snap));
      } catch {
        // quota exceeded / storage unavailable — crash recovery is best-effort
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [config.tick, config.isDirty, config.key]);

  const restore = React.useCallback(() => {
    if (!snapshot) return;
    cfg.current.onRestore(snapshot.data);
    setSnapshot(null);
  }, [snapshot]);

  const discard = React.useCallback(() => {
    setSnapshot(null);
    try {
      window.localStorage.removeItem(cfg.current.key);
    } catch {
      // ignore
    }
  }, []);

  const clear = React.useCallback(() => {
    try {
      window.localStorage.removeItem(cfg.current.key);
    } catch {
      // ignore
    }
  }, []);

  return { snapshot, restore, discard, clear };
}

/** Amber, dismissible crash-recovery banner shown above the editor form. */
export function DraftRecoveryBanner({
  savedAt,
  label = "draft",
  onRestore,
  onDiscard,
}: {
  savedAt: number;
  label?: string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const when = Number.isFinite(savedAt) ? timeAgo(new Date(savedAt).toISOString()) : "earlier";
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 sm:flex-row sm:items-center dark:text-amber-400"
    >
      <p className="flex-1 leading-relaxed">
        Local {label} found — saved {when}.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="press-sm h-8 border-amber-500/40"
          onClick={onRestore}
        >
          Restore
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="press-sm h-8 hover:text-amber-800 dark:hover:text-amber-300"
          onClick={onDiscard}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

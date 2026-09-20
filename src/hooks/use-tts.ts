"use client";

import * as React from "react";

/**
 * use-tts — browser SpeechSynthesis narration engine for the blog post page.
 *
 * Client-only feature (no backend): markdown is stripped to readable plain
 * text, split into ~200-char sentence chunks, and queued one utterance at a
 * time so we can track the "part N of M" progress, apply mid-playback rate
 * changes, and stop cleanly on unmount / route change.
 *
 * All mutable state lives in refs; React state updates happen only on
 * status / chunk / rate changes (never per scroll or per boundary event).
 */

/* ------------------------------------------------------------------ */
/* markdown -> narration text                                          */
/* ------------------------------------------------------------------ */

/**
 * Strip markdown syntax (fences, headings, emphasis, links, images,
 * blockquote/list markers, tables, inline HTML) down to readable sentences.
 */
export function markdownToPlain(markdown: string): string {
  return markdown
    // Fenced code blocks are skipped entirely — listening to raw code is noise.
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    // Inline code -> keep the inner text.
    .replace(/`([^`]*)`/g, "$1")
    // Images -> alt text, links -> label text.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Stray HTML tags.
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    // Headings, blockquotes, list markers.
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/^[ \t]{0,3}(?:[-*+]|\d+[.)])[ \t]+/gm, "")
    // Emphasis / strikethrough.
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1")
    // Table pipes and long dashes.
    .replace(/\|/g, " ")
    .replace(/-{3,}/g, " ")
    // Collapse whitespace.
    .replace(/\s+/g, " ")
    .trim();
}

/** Split plain text into sentence-ish pieces (punctuation kept attached). */
function splitSentences(text: string): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  const out: string[] = [];
  const pattern = /[^.!?]*[.!?]+["')\]]*|[^.!?]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(flat)) !== null) {
    const sentence = match[0].trim();
    if (sentence) out.push(sentence);
  }
  return out;
}

/** Merge sentences into narration chunks of roughly `max` characters. */
export function splitIntoChunks(text: string, max = 200): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let current = "";
  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };
  for (const sentence of sentences) {
    // A single sentence longer than the budget is hard-split at word bounds.
    if (sentence.length > max) {
      pushCurrent();
      let rest = sentence;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(" ", max);
        if (cut < max * 0.5) cut = max;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      current = rest;
      continue;
    }
    if (current && current.length + 1 + sentence.length > max) pushCurrent();
    current = current ? `${current} ${sentence}` : sentence;
  }
  pushCurrent();
  return chunks;
}

/* ------------------------------------------------------------------ */
/* controller contract                                                 */
/* ------------------------------------------------------------------ */

export const TTS_RATES = [0.9, 1, 1.2, 1.5] as const;

export type TtsStatus = "idle" | "playing" | "paused";

export interface TtsController {
  /** false until hydration confirms the browser has SpeechSynthesis. */
  supported: boolean;
  status: TtsStatus;
  /** 0-based chunk currently narrated. */
  chunkIndex: number;
  chunkCount: number;
  rateIndex: number;
  rate: number;
  /** Set when the browser refuses to narrate (voices/policy failures). */
  error: string | null;
  play(): void;
  pause(): void;
  stop(): void;
  toggle(): void;
  cycleRate(): void;
  /**
   * Subscribe to fine-grained narration progress (0..1, interpolated inside
   * the current chunk via word boundaries). Returns an unsubscribe fn.
   */
  subscribeBoundary(cb: (progress: number) => void): () => void;
}

export interface UseTtsOptions {
  /** Plain narration text (title + article body recommended). */
  text: string;
}

/* ------------------------------------------------------------------ */
/* hook                                                                */
/* ------------------------------------------------------------------ */

export function useTts(options: UseTtsOptions): TtsController {
  const { text } = options;

  // `supported` starts false so SSR markup matches the first client render;
  // the player mounts only after hydration confirms the API exists.
  const [supported, setSupported] = React.useState(false);
  const [state, setState] = React.useState<{
    status: TtsStatus;
    chunkIndex: number;
    chunkCount: number;
    rateIndex: number;
    error: string | null;
  }>({ status: "idle", chunkIndex: 0, chunkCount: 0, rateIndex: 0, error: null });

  const chunks = React.useMemo(() => splitIntoChunks(text), [text]);
  const chunksRef = React.useRef<string[]>(chunks);
  React.useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  const runIdRef = React.useRef(0);
  const chunkRef = React.useRef(0);
  const rateRef = React.useRef(0);
  const statusRef = React.useRef<TtsStatus>("idle");
  const boundarySubsRef = React.useRef<Set<(progress: number) => void>>(new Set());
  // Keep the live utterance referenced — Chrome GCs unreferenced utterances
  // and then never fires their onend.
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  React.useEffect(() => {
     
    setSupported(
      typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        typeof window.speechSynthesis?.speak === "function"
    );
  }, []);

  // Keep the exposed chunk count in sync when the text changes.
  React.useEffect(() => {
     
    setState((prev) => (prev.chunkCount === chunks.length ? prev : { ...prev, chunkCount: chunks.length }));
  }, [chunks.length]);

  const setStatus = (next: TtsStatus) => {
    statusRef.current = next;
    setState((prev) => (prev.status === next ? prev : { ...prev, status: next }));
  };

  /** Speak chunk `index`; advances itself via utterance onend events.
   *  Assigned in an effect (after every render) so the closures always see
   *  the latest render's helpers — the "latest ref" pattern, lint-clean. */
  const speakFromRef = React.useRef<(index: number) => void>(() => {});
  React.useEffect(() => {
    speakFromRef.current = (index: number) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const list = chunksRef.current;
    if (index < 0 || index >= list.length) {
      chunkRef.current = 0;
      setStatus("idle");
      setState((prev) => (prev.chunkIndex === 0 ? prev : { ...prev, chunkIndex: 0 }));
      boundarySubsRef.current.forEach((cb) => cb(1));
      return;
    }
    // A new run invalidates any onend/onerror still in flight (cancel()).
    const runId = ++runIdRef.current;
    chunkRef.current = index;
    statusRef.current = "playing";
    setState((prev) =>
      prev.chunkIndex === index && prev.status === "playing"
        ? prev
        : { ...prev, chunkIndex: index, status: "playing" }
    );

    const utterance = new window.SpeechSynthesisUtterance(list[index]);
    utteranceRef.current = utterance;
    utterance.rate = TTS_RATES[rateRef.current];

    const emit = (fraction: number) => {
      const count = Math.max(1, list.length);
      boundarySubsRef.current.forEach((cb) => cb(Math.min(1, (index + fraction) / count)));
    };

    utterance.onstart = () => {
      if (runIdRef.current === runId) emit(0);
    };
    utterance.onboundary = (event) => {
      if (runIdRef.current !== runId) return;
      if (typeof event.charIndex !== "number") return;
      const length = Math.max(1, list[index].length);
      emit(Math.min(1, event.charIndex / length));
    };
    utterance.onend = () => {
      if (runIdRef.current !== runId) return;
      speakFromRef.current(index + 1);
    };
    utterance.onerror = (event) => {
      if (runIdRef.current !== runId) return;
      const kind = (event as SpeechSynthesisErrorEvent).error;
      // cancel()/stop() surface as "canceled"/"interrupted" — not an error.
      if (kind === "canceled" || kind === "interrupted") return;
      chunkRef.current = 0;
      statusRef.current = "idle";
      setState((prev) => ({
        ...prev,
        status: "idle",
        chunkIndex: 0,
        error: "Narration is not available in this browser.",
      }));
      boundarySubsRef.current.forEach((cb) => cb(0));
    };

    emit(0);
    synth.speak(utterance);
    };
  });

  const play = React.useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (statusRef.current === "paused") {
      if (synth.paused) {
        synth.resume();
        setStatus("playing");
        return;
      }
      // Browsers whose pause() is a no-op — restart the current chunk.
      speakFromRef.current(chunkRef.current);
      return;
    }
    if (statusRef.current === "playing") return;
    synth.cancel();
    speakFromRef.current(0);
  }, []);

  const pause = React.useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth || statusRef.current !== "playing") return;
    synth.pause();
    setStatus("paused");
  }, []);

  const stop = React.useCallback(() => {
    const synth = window.speechSynthesis;
    runIdRef.current += 1;
    synth?.cancel();
    chunkRef.current = 0;
    statusRef.current = "idle";
    setState((prev) =>
      prev.status === "idle" && prev.chunkIndex === 0 ? prev : { ...prev, status: "idle", chunkIndex: 0 }
    );
    boundarySubsRef.current.forEach((cb) => cb(0));
  }, []);

  const toggle = React.useCallback(() => {
    if (statusRef.current === "playing") pause();
    else play();
  }, [pause, play]);

  const cycleRate = React.useCallback(() => {
    const next = (rateRef.current + 1) % TTS_RATES.length;
    rateRef.current = next;
    setState((prev) => (prev.rateIndex === next ? prev : { ...prev, rateIndex: next }));
    if (statusRef.current === "playing") {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      speakFromRef.current(chunkRef.current);
    }
  }, []);

  const subscribeBoundary = React.useCallback((cb: (progress: number) => void) => {
    boundarySubsRef.current.add(cb);
    return () => {
      boundarySubsRef.current.delete(cb);
    };
  }, []);

  // Route change / unmount: kill narration immediately (BUILD CONTRACT perf).
  React.useEffect(() => {
    const onUnload = () => {
      runIdRef.current += 1;
      window.speechSynthesis?.cancel();
    };
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      onUnload();
    };
  }, []);

  // Leaving the tab mid-narration pauses it (browsers throttle background
  // speech anyway; coming back keeps the paused state for the reader).
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      if (statusRef.current !== "playing") return;
      window.speechSynthesis?.pause();
      setStatus("paused");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return React.useMemo<TtsController>(
    () => ({
      supported,
      status: state.status,
      chunkIndex: state.chunkIndex,
      chunkCount: state.chunkCount,
      rateIndex: state.rateIndex,
      rate: TTS_RATES[state.rateIndex],
      error: state.error,
      play,
      pause,
      stop,
      toggle,
      cycleRate,
      subscribeBoundary,
    }),
    [supported, state, play, pause, stop, toggle, cycleRate, subscribeBoundary]
  );
}

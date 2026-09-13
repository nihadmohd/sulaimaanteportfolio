"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * usePresence — realtime live-visitor counter (Task 7-a, BUILD CONTRACT §13).
 *
 * Socket-first with a REST fallback:
 * - Singleton socket.io connection (`io("/")` + `XTransformPort=3003` query —
 *   Caddy routes it to the presence mini-service; NEVER an absolute URL/port).
 * - On connect: emits `presence:join` {sessionId, path, device}; the session
 *   id persists in sessionStorage ("mnkp_sid") so reconnects and multi-badge
 *   consumers count as ONE visitor (server upserts by session key).
 * - On mount + hashchange: emits `presence:path` {path}.
 * - Listens to `presence:stats` {online, byPath, updatedAt} (3s broadcast)
 *   and `presence:welcome` {online} (instant first paint after joining).
 * - When reconnection attempts are exhausted (`reconnect_failed` or the 4th
 *   `connect_error`): `connected:false` + polls GET /api/presence every 15s.
 *
 * Contract: usePresence(): {online: number|null, byPath: PresencePathCount[], connected: boolean}
 * `online` is null until the first datapoint (socket stats/welcome or REST) —
 * consumers should render nothing while it is null (graceful degradation to
 * silence when the presence service is down).
 */

export interface PresencePathCount {
  path: string;
  count: number;
}

export interface PresenceStats {
  online: number;
  byPath: PresencePathCount[];
  updatedAt?: string;
}

export interface PresenceState {
  /** Live visitor count; null until the first datapoint arrives. */
  online: number | null;
  /** Top live hash routes (max 10, count desc). Empty until socket stats arrive. */
  byPath: PresencePathCount[];
  /** True while the socket transport is live; false during REST fallback. */
  connected: boolean;
}

const SESSION_STORAGE_KEY = "mnkp_sid";
const MAX_RECONNECTION_ATTEMPTS = 3;
const REST_POLL_INTERVAL_MS = 15_000;
/** Total failures tolerated: initial attempt + N reconnection attempts. */
const MAX_CONNECT_FAILURES = MAX_RECONNECTION_ATTEMPTS + 1;

let socket: Socket | null = null;
let consumers = 0;

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.length > 0) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    // sessionStorage unavailable (blocked storage) — ephemeral per-mount identity.
    return crypto.randomUUID();
  }
}

function currentPath(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

function currentDevice(): "mobile" | "desktop" {
  return window.matchMedia("(max-width: 768px)").matches ? "mobile" : "desktop";
}

function getSocket(): Socket {
  if (!socket) {
    // NEVER an absolute URL or port — the Caddy gateway routes via the
    // XTransformPort query param, exactly like examples/websocket.
    socket = io("/", {
      query: { XTransformPort: "3003" },
      reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
      reconnectionDelay: 2000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

async function fetchRestOnline(): Promise<number | null> {
  try {
    const res = await fetch("/api/presence", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: { online?: number | null } };
    const online = json?.data?.online;
    return typeof online === "number" ? Math.max(0, Math.round(online)) : null;
  } catch {
    return null;
  }
}

export function usePresence(): PresenceState {
  const [state, setState] = useState<PresenceState>({
    online: null,
    byPath: [],
    connected: false,
  });

  useEffect(() => {
    const s = getSocket();
    consumers += 1;

    let restPoll: ReturnType<typeof setInterval> | null = null;
    let failures = 0;

    const stopRestPoll = () => {
      if (restPoll !== null) {
        clearInterval(restPoll);
        restPoll = null;
      }
    };

    const pollRest = async () => {
      const online = await fetchRestOnline();
      setState((prev) => ({ ...prev, online }));
    };

    const startRestFallback = () => {
      if (restPoll !== null) return; // already polling
      setState((prev) => (prev.connected ? { ...prev, connected: false } : prev));
      void pollRest();
      restPoll = setInterval(() => void pollRest(), REST_POLL_INTERVAL_MS);
    };

    const onConnect = () => {
      failures = 0;
      stopRestPoll();
      s.emit("presence:join", {
        sessionId: getSessionId(),
        path: currentPath(),
        device: currentDevice(),
      });
      setState((prev) => (prev.connected ? prev : { ...prev, connected: true }));
    };

    const onWelcome = (payload: { online?: number } | undefined) => {
      if (typeof payload?.online !== "number") return;
      setState((prev) => ({ ...prev, online: Math.max(0, Math.round(payload.online as number)) }));
    };

    const onStats = (stats: PresenceStats | undefined) => {
      if (!stats || typeof stats.online !== "number") return;
      const byPath = Array.isArray(stats.byPath)
        ? stats.byPath.filter(
            (item): item is PresencePathCount =>
              !!item && typeof item.path === "string" && typeof item.count === "number"
          )
        : [];
      setState({
        online: Math.max(0, Math.round(stats.online)),
        byPath,
        connected: true,
      });
    };

    const onHashChange = () => {
      s.emit("presence:path", { path: currentPath() });
    };

    const onConnectError = () => {
      failures += 1;
      setState((prev) => (prev.connected ? { ...prev, connected: false } : prev));
      if (failures >= MAX_CONNECT_FAILURES) startRestFallback();
    };

    const onReconnectFailed = () => startRestFallback();

    const onDisconnect = () => {
      setState((prev) => (prev.connected ? { ...prev, connected: false } : prev));
    };

    s.on("connect", onConnect);
    s.on("presence:welcome", onWelcome);
    s.on("presence:stats", onStats);
    s.on("connect_error", onConnectError);
    s.on("reconnect_failed", onReconnectFailed);
    s.on("disconnect", onDisconnect);
    window.addEventListener("hashchange", onHashChange);

    // Announce the mount path (the join payload also carries it on connect).
    onHashChange();

    return () => {
      s.off("connect", onConnect);
      s.off("presence:welcome", onWelcome);
      s.off("presence:stats", onStats);
      s.off("connect_error", onConnectError);
      s.off("reconnect_failed", onReconnectFailed);
      s.off("disconnect", onDisconnect);
      window.removeEventListener("hashchange", onHashChange);
      stopRestPoll();
      consumers -= 1;
      if (consumers <= 0) {
        // Last consumer unmounted — drop the singleton and its socket cleanly.
        s.disconnect();
        socket = null;
      }
    };
  }, []);

  return state;
}

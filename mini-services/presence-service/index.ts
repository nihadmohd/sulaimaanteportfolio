/**
 * MN.KP presence mini-service — realtime live-visitor counter (Task 7-a).
 *
 * Socket.io server on a fixed port 3003 with path "/" (gateway contract:
 * browser clients connect through Caddy via ?XTransformPort=3003 and the
 * request path is always "/", per examples/websocket).
 *
 * REST endpoints share the SAME http server:
 *   GET /presence -> {"online":N}  (CORS *, no-store)
 *   GET /health   -> {"ok":true}   (CORS *, no-store)
 *
 * WHY THE REQUEST-LISTENER RE-WRAP (verified against the installed engine.io
 * source): engine.io computes its path as "/" (path "/" + trailing-slash
 * normalization) and its request check is `"/" === req.url.slice(0, 1)` —
 * which matches EVERY possible HTTP request. A request handler registered
 * before socket.io attaches would therefore never run (engine claims all
 * URLs and answers non-socket.io requests with 400 "Transport unknown").
 * So: we attach socket.io FIRST, then re-wrap the server's "request"
 * listeners with a dispatcher that serves /presence and /health itself and
 * forwards everything else to the captured engine listener. serveClient is
 * disabled so exactly one engine request-listener exists to capture.
 * Websocket upgrades never emit "request" — engine keeps them via its own
 * "upgrade" listener, which is left untouched.
 *
 * Presence model (in-memory, broadcast-only, zero DB writes):
 *   Map<sessionKey, {socketId, path, device, lastSeen}>
 *   + reverse index Map<socketId, sessionKey>
 *
 * Events:
 *   client -> "presence:join"  {sessionId?, path?, device?}  upsert + "presence:welcome" {online} to socket
 *   client -> "presence:path"  {path}                        update (self-heals unknown sockets)
 *   server -> "presence:stats" {online, byPath[10], updatedAt} every 3s
 *
 * Prune (every 3s): entries whose socket is dead (no longer in the connected
 * map) or whose lastSeen is older than 75s. lastSeen is refreshed on
 * join/path AND on every engine.io pong (server pings every 25s), so
 * idle-but-connected visitors are never pruned.
 */

import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";

const PORT = 3003; // fixed: Caddy gateway forwards ?XTransformPort=3003 here
const PRUNE_INTERVAL_MS = 3000;
const STALE_AFTER_MS = 75000;

type Device = "mobile" | "desktop";

interface PresenceEntry {
  socketId: string;
  path: string;
  device: Device;
  lastSeen: number;
}

interface PathCount {
  path: string;
  count: number;
}

interface JoinPayload {
  sessionId?: string;
  path?: string;
  device?: string;
}

interface PathPayload {
  path?: string;
}

interface StatsPayload {
  online: number;
  byPath: PathCount[];
  updatedAt: string;
}

const sessions = new Map<string, PresenceEntry>(); // sessionKey -> entry
const sessionBySocket = new Map<string, string>(); // socketId -> sessionKey

const nowMs = (): number => Date.now();

function normalizePath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "/";
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.length > 128 ? withSlash.slice(0, 128) : withSlash;
}

function normalizeDevice(value: unknown): Device {
  return value === "mobile" ? "mobile" : "desktop";
}

function normalizeSessionId(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 64) : fallback;
}

function statsPayload(): StatsPayload {
  const counts = new Map<string, number>();
  for (const entry of sessions.values()) {
    counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1);
  }
  const byPath: PathCount[] = Array.from(counts, ([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, 10);
  return { online: sessions.size, byPath, updatedAt: new Date().toISOString() };
}

function broadcastStats(): void {
  io.emit("presence:stats", statsPayload());
}

function touch(socketId: string): void {
  const key = sessionBySocket.get(socketId);
  if (key === undefined) return;
  const entry = sessions.get(key);
  if (entry && entry.socketId === socketId) entry.lastSeen = nowMs();
}

function removeBySocket(socketId: string): void {
  const key = sessionBySocket.get(socketId);
  if (key === undefined) return;
  sessionBySocket.delete(socketId);
  const entry = sessions.get(key);
  // Only drop the session when THIS socket still owns it — a newer socket
  // (same sessionStorage sid after a quick reconnect) may have re-joined.
  if (entry && entry.socketId === socketId) sessions.delete(key);
}

// ---------------------------------------------------------------------------
// http server + socket.io
// ---------------------------------------------------------------------------

const httpServer = createServer(); // no handler: engine.io attaches its own below

const io = new Server(httpServer, {
  // DO NOT change the path — it is how Caddy routes the request here.
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  serveClient: false, // no client bundle routes; keeps one engine request-listener to capture
});

io.on("connection", (socket: Socket) => {
  // Refresh lastSeen on every engine.io pong so connected-but-idle visitors
  // survive the 75s stale prune (server pings every 25s).
  socket.conn.on("packet", (packet: { type: string }) => {
    if (packet.type === "pong") touch(socket.id);
  });

  socket.on("presence:join", (payload: JoinPayload | undefined) => {
    const sessionId = normalizeSessionId(payload?.sessionId, socket.id);
    const path = normalizePath(payload?.path);
    const device = normalizeDevice(payload?.device);
    // Drop any entry this socket previously owned (a self-healed entry keyed
    // by socket.id, or an older session id if the client switched identity).
    const previousKey = sessionBySocket.get(socket.id);
    if (previousKey !== undefined && previousKey !== sessionId) sessions.delete(previousKey);
    sessionBySocket.set(socket.id, sessionId);
    sessions.set(sessionId, { socketId: socket.id, path, device, lastSeen: nowMs() });
    socket.emit("presence:welcome", { online: sessions.size });
    console.log(
      `[join] sid=${sessionId.slice(0, 8)} path=${path} device=${device} online=${sessions.size}`
    );
  });

  socket.on("presence:path", (payload: PathPayload | undefined) => {
    const path = normalizePath(payload?.path);
    let key = sessionBySocket.get(socket.id);
    if (key === undefined) {
      // Self-heal: socket never joined (or was pruned) — adopt its id as key.
      key = socket.id;
      sessionBySocket.set(socket.id, key);
    }
    const entry = sessions.get(key);
    if (entry) {
      entry.socketId = socket.id; // adopt a reconnecting owner
      entry.path = path;
      entry.lastSeen = nowMs();
    } else {
      sessions.set(key, { socketId: socket.id, path, device: "desktop", lastSeen: nowMs() });
    }
  });

  socket.on("disconnect", (reason: string) => {
    removeBySocket(socket.id);
    console.log(`[left] reason=${reason} online=${sessions.size}`);
  });
});

// ---------------------------------------------------------------------------
// REST endpoints on the same http server (see header comment)
// ---------------------------------------------------------------------------

interface RestResponse {
  writeHead(status: number, headers: Record<string, string>): RestResponse;
  end(body?: string): RestResponse;
}

interface RestRequest {
  method?: string;
  url?: string;
}

function sendJson(res: RestResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

type RequestListener = (req: RestRequest, res: RestResponse) => void;

const engineListeners = httpServer.listeners("request").slice(0) as RequestListener[];
httpServer.removeAllListeners("request");
httpServer.on("request", ((req: RestRequest, res: RestResponse) => {
  const pathname = (req.url ?? "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (req.method === "GET" && pathname === "/presence") {
    sendJson(res, 200, { online: sessions.size });
    return;
  }
  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }
  // Everything else (socket.io engine polling, unknown paths) -> engine.io.
  for (const listener of engineListeners) listener.call(httpServer, req, res);
}) as RequestListener);

// ---------------------------------------------------------------------------
// prune + broadcast loop
// ---------------------------------------------------------------------------

const pruneAndBroadcast = setInterval(() => {
  const cutoff = nowMs() - STALE_AFTER_MS;
  let pruned = 0;
  for (const [key, entry] of sessions) {
    const alive = io.sockets.sockets.has(entry.socketId);
    if (!alive || entry.lastSeen < cutoff) {
      if (sessionBySocket.get(entry.socketId) === key) sessionBySocket.delete(entry.socketId);
      sessions.delete(key);
      pruned += 1;
    }
  }
  if (pruned > 0) console.log(`[prune] removed=${pruned} online=${sessions.size}`);
  broadcastStats();
}, PRUNE_INTERVAL_MS);

// ---------------------------------------------------------------------------
// start + graceful shutdown
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[presence] socket.io (path "/") + REST /presence /health listening on :${PORT}`);
});

function shutdown(signal: string): void {
  console.log(`[presence] ${signal} received, shutting down`);
  clearInterval(pruneAndBroadcast);
  io.close(() => {
    console.log("[presence] closed");
    process.exit(0);
  });
  // Safety net: force-exit if close callbacks never drain (3s).
  setTimeout(() => process.exit(0), 3000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

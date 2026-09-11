# Task 7-a — Z.ai Code (build agent) — Work Record
# Realtime Presence Service (live user counter) — MN.KP platform

Task ID: 7-a
Agent: Z.ai Code
Date: 2026-09-11 (~11:20-11:40 sandbox time)
Spec: worklog.md "=== TASK 7-a SPEC (Realtime Presence) ===" + BUILD CONTRACT v1 §13
Files owned this task: mini-services/presence-service/**, src/hooks/use-presence.ts, src/components/shared/live-visitor-badge.tsx

## Files created / rewritten

1. mini-services/presence-service/package.json — EXACTLY per spec:
   {"name":"presence-service","private":true,"scripts":{"dev":"bun --hot index.ts"},"dependencies":{"socket.io":"^4.8.3"}}
   bun install ran inside the dir (22 packages, lockfile created). Compatible with .zscripts/mini-services-install.sh and dev.sh start_mini_services conventions (auto-starts on future sandbox boots).

2. mini-services/presence-service/index.ts (~250 lines, simple TS):
   - Fixed port 3003; `new Server(httpServer, { path: "/", cors: { origin: "*", methods: ["GET","POST"] }, pingTimeout: 60000, pingInterval: 25000, serveClient: false })`.
   - Presence model: Map<sessionKey, {socketId, path, device: "mobile"|"desktop", lastSeen}> + reverse Map<socketId, sessionKey>.
   - presence:join {sessionId?, path?, device?} → normalize (sessionId ≤64 chars fallback socket.id; path ≤128 forced leading "/"; device mobile|desktop) → delete socket's previously-owned key (phantom cleanup) → upsert → socket.emit("presence:welcome", {online}).
   - presence:path {path} → update entry (adopt socket.id when unknown — self-heal for pruned-while-connected or buffered pre-join emits).
   - disconnect → removeBySocket (only deletes the session when this socket still owns it — quick-reconnect safe).
   - socket.conn.on("packet", pong → touch lastSeen) — engine pings every 25s so idle-but-connected visitors survive the 75s prune.
   - setInterval 3000: prune entries (io.sockets.sockets.has(socketId)===false OR lastSeen < now-75s) + io.emit("presence:stats", {online, byPath: top-10 [{path,count}] count desc, updatedAt ISO}).
   - REST on the SAME httpServer (see deviations): GET /presence → {"online":N}, GET /health → {"ok":true} — both CORS *, no-store.
   - SIGTERM/SIGINT: clearInterval + io.close + 3s force-exit safety net. Compact logs: [join]/[left]/[prune] one-liners + startup line.

3. src/hooks/use-presence.ts ("use client", TS strict):
   - Module-singleton socket (created lazily INSIDE useEffect — SSR-safe): io("/", { query: { XTransformPort: "3003" }, reconnectionAttempts: 3, reconnectionDelay: 2000, transports: ["websocket","polling"] }) — NEVER absolute URL/port (gateway contract).
   - Exports: usePresence(): { online: number | null; byPath: PresencePathCount[]; connected: boolean } and types PresencePathCount {path,count}, PresenceStats {online,byPath,updatedAt?}, PresenceState.
   - On connect: emit presence:join {sessionId (sessionStorage "mnkp_sid", crypto.randomUUID when absent/blocked), path (location.hash sans "#", "/" fallback), device (matchMedia("(max-width: 768px)") mobile|desktop)}.
   - hashchange + mount: emit presence:path {path}.
   - presence:stats (3s) → {online, byPath, connected:true}; presence:welcome (additive) → instant online.
   - connect_error count ≥ 4 OR reconnect_failed → connected:false + REST fallback: fetch("/api/presence") every 15s (envelope {ok,data.online} parsed, null-tolerant, Math.max(0,round)).
   - Consumer refcount: socket.disconnect() + null only when the LAST consumer unmounts (header + hero badges share ONE socket/session).

4. src/components/shared/live-visitor-badge.tsx (REWRITE — owned since 3-a):
   - usePresence(); returns null while online === null (no data → silent).
   - Emerald pulse dot PINNED: bg-emerald-500 / dark:bg-emerald-400 + animate-ping layer (stays emerald under consumer className overrides like the gold hero).
   - Users icon + "{online} online"; role="status"; aria-label "{online} visitors online now"; title "Live visitors on MN.KP right now".
   - Props {className?, variant?: "header"|"hero"}; hero = px-4 py-2 text-sm, size-2.5 dot, size-4 icon, gap-2 + "LIVE NOW" micro-label (uppercase, tracking-[0.2em], opacity-80).
   - Named export LiveVisitorBadge preserved — existing consumers untouched and verified: site-header.tsx:189 (className "hidden sm:inline-flex"), home-view.tsx:187 (className "border-gold-soft/30 bg-white/10 text-gold-soft").

## Key technical finding (deviation #1 — REST-on-same-port)

engine.io v6 (installed @ node_modules/engine.io) computes its path as "/" for `path:"/"` (`_computePath`: strip trailing slash then re-add → "/") and its request check is:
  `check(req) { return path === req.url.slice(0, path.length); }`
With path "/" EVERY http request matches (all urls start with "/"). A request handler registered before socket.io attaches is cached by engine.io's attach() but NEVER invoked — engine claims everything and answers non-socket requests with 400 "Transport unknown". This is also exactly WHY the examples/websocket demo works (client engine path defaults to "/socket.io", requests hit /socket.io/?EIO=4&transport=...&XTransformPort=3003 — still claimed by the path-"/" prefix check).

FIX implemented: attach socket.io FIRST with serveClient:false (→ exactly ONE engine request listener), then capture + removeAllListeners("request") and register a dispatcher that serves GET /presence + GET /health itself and forwards everything else to the captured engine listener(s). Websocket upgrades never emit "request" (engine owns the "upgrade" listener) — untouched. Verified end-to-end: REST JSON direct + via Caddy, polling handshake, and a real websocket client through the gateway.

## Service status (at task finish)

- RUNNING: PID 12305 (bun --hot index.ts), parent 12303 (bun run dev, PPID 1 — double-fork orphan).
- Start command (works around the tool harness reaping plain nohup children at invocation end):
  cd /home/z/my-project/mini-services/presence-service && setsid --fork bun run dev > presence.log 2>&1 < /dev/null
- Log: mini-services/presence-service/presence.log (startup + [join]/[left] lines only).
- curl direct: http://localhost:3003/presence → {"online":1}; http://localhost:3003/health → {"ok":true}
- curl via Caddy gateway: http://localhost:81/presence?XTransformPort=3003 → {"online":1}; /health?XTransformPort=3003 → {"ok":true}
- engine.io handshake via gateway: /socket.io/?EIO=4&transport=polling&XTransformPort=3003 → 0{"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":60000}
- Next REST fallback: http://localhost:3000/api/presence → {"ok":true,"data":{"online":1}} (4-a's probe now live).
- E2E socket client (bun, gateway origin, spec opts): connected transport=websocket → presence:welcome {"online":1} → presence:stats {"online":1,"byPath":[{"path":"/blog","count":1}],"updatedAt":...} → disconnect → /presence {"online":0}.
- Browser (agent-browser/chrome via :81): hero badge renders role=status aria-label="1 visitors online now" + gold consumer classes + emerald ping dot + "1 online"; sessionStorage mnkp_sid set and matches service [join] sid; nav away → clean unmount+disconnect (online 0); nav back → reconnect+rejoin (same sid) → "1 online"; zero console/page errors.

## Verification

- bun run lint → exit 0 (whole repo; mini-services included — eslint ignores only node_modules/.next/out/build/examples/skills).
- bunx tsc --noEmit → zero errors in MY files; only 2 pre-existing errors in skills/ (platform files, untouched). NOTE: this tsc run OOM-killed next-server — see incident.
- tail -40 dev.log → clean 200s, no compile errors (after the restart below).
- Files mtime all precede the lint/tsc runs (final code was what was checked).

## Incident (logged in worklog too)

bunx tsc --noEmit pushed the sandbox past its memory limit → OOM killer killed next-server (pid 1532, ~2.1GB RSS) at ~11:31. Restarted the dev server detached: `cd /home/z/my-project && setsid --fork bash -c 'exec bun run dev'` → Ready in 2.4s, GET / 200, all APIs + presence re-verified healthy. dev.log truncated by tee on restart (platform boot behavior). .zscripts/dev.pid is stale (old PIDs). Future agents: avoid heavy tsc while the hot next-server is ~2GB RSS.

## Other deviations (all in worklog Stage Summary)

- serveClient:false (keeps one engine request listener to capture; no client-bundle routes).
- Pong-touch keeps lastSeen fresh so the 75s prune never evicts idle-but-connected visitors (spec's prune rule preserved for truly stale entries).
- presence:path self-heal + join previous-key cleanup (kills phantom double-count from buffered pre-connect emits; N tabs = ONE sessionKey count per spec's Map<sessionKey> upsert).
- Hook also listens presence:welcome (instant count); fallback triggers on reconnect_failed OR 4th connect_error; refcounted singleton cleanup.
- init-fullstack bootstrap NOT re-run (env initialized since 1-b; re-run would spawn a 2nd dev server on busy :3000).

## Handoff notes

- ORCHESTRATOR (Task 8): admin overview "Live activity" card (6-a/6-a-1: usePresenceOnline REST poll 10s, queryKey ["admin-presence"]) can swap to usePresence() for realtime; byPath top-10 is exported and ready for a "where visitors are" mini-list.
- home-view hero badge can pass variant="hero" for the larger LIVE NOW treatment (already renders correctly today with className overrides alone).
- When AppShell/SiteHeader mounts (page.tsx is currently 4-a's SMOKE harness — no shell yet), the header badge becomes a 2nd usePresence consumer; refcounted singleton handles co-existence (one session, one socket, one count).
- Manual restart of the presence service: cd mini-services/presence-service && setsid --fork bun run dev > presence.log 2>&1 < /dev/null (plain nohup gets reaped by the tool harness).
- Client engine requests hit /socket.io/?EIO=4&transport=...&XTransformPort=3003 (client-default engine path); server path "/" claims them. Both /?EIO and /socket.io/?EIO handshakes verified through the gateway.

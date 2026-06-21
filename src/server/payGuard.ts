// Pay guard for the PUBLIC x402 endpoint. Bounds griefing on the deployed demo: the payer key sits
// on a public URL, so a bot could otherwise loop /api/underwrite and spend the wallet's USDC $0.01
// at a time. When the guard says "no", the route SKIPS the paid pull and serves the cached experience
// (no hard error) — a legit judge gets the live on-chain payment; a spammer gets cached responses.
//
// HARD cap on loss is the payer wallet's small balance (fund ~$2-3); x402 cannot overdraw USDC.
// This guard is best-effort: serverless instances don't share memory, so limits are per-warm-instance.
// For ironclad cross-instance limits, back it with Vercel KV / Upstash (left as a documented upgrade).

const PER_IP_COOLDOWN_MS = 20_000;        // one paid pull per IP per 20s
const GLOBAL_MAX_PER_WINDOW = 60;         // paid pulls per instance per window
const GLOBAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_IPS = 5000;             // bound the map so it can't grow unbounded

const lastByIp = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

export interface PayGuardResult { allowed: boolean; reason: string }

// Returns whether a paid x402 pull is allowed for this caller right now. Side-effectful: records the
// grant so the next call is rate-limited. `now` is injectable for tests (defaults to Date.now()).
export function allowPaidCall(ip: string, now: number = Date.now()): PayGuardResult {
  if (now - windowStart > GLOBAL_WINDOW_MS) { windowStart = now; windowCount = 0; }
  if (windowCount >= GLOBAL_MAX_PER_WINDOW) return { allowed: false, reason: "global daily cap reached — serving cached" };

  const last = lastByIp.get(ip) ?? 0;
  if (now - last < PER_IP_COOLDOWN_MS) return { allowed: false, reason: "per-IP cooldown — serving cached" };

  // [CRITIQUE #9] bound the map by EVICTING the oldest-inserted entries — never a full clear. A clear()
  // would reset EVERYONE's cooldown at once, so an attacker could flush the table (5000 junk IPs) to
  // wipe their own cooldown and resume draining. Map preserves insertion order → the first keys are the
  // oldest, so deleting from the front evicts stale callers without touching recent ones.
  if (lastByIp.size >= MAX_TRACKED_IPS) {
    const toEvict = lastByIp.size - MAX_TRACKED_IPS + 1;
    let i = 0;
    for (const k of lastByIp.keys()) { if (i++ >= toEvict) break; lastByIp.delete(k); }
  }
  lastByIp.set(ip, now);
  windowCount++;
  return { allowed: true, reason: "ok" };
}

// test-only reset
export function __resetPayGuard(): void { lastByIp.clear(); windowStart = 0; windowCount = 0; }

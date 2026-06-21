// Fix 3 — CoinMarketCap MCP technical-analysis tier (gated, best-effort, never throws).
// The CMC Agent Hub `get_crypto_technical_analysis` tool returns moving averages, MACD, RSI,
// Fibonacci retracement/extension levels and a pivot point (field names captured live via
// scripts/probe-mcp-ta.ts). We derive stop/take-profit candidate levels from those CMC figures.
//
// SAFETY: this never throws and is validity-gated by the caller — if CMC's levels don't yield a
// usable envelope around the entry (common when the snapshot price differs from the agent's entry),
// the caller transparently falls through to the working Bybit-klines path. It is enrichment, never
// a single point of failure on the live underwrite path.
const MCP_URL = "https://mcp.coinmarketcap.com/mcp";

export interface CmcLevels { support: number[]; resistance: number[]; rsi: number; raw: Record<string, unknown>; }

// in-memory cache (per serverless instance) so we don't pay MCP latency on every request
const cache = new Map<string, { at: number; ta: Record<string, unknown> | null }>();
const TTL_MS = 5 * 60 * 1000;

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

// Single stateless tools/call (this MCP server needs no session). Returns the parsed TA object or null.
async function fetchTA(cmcId: number, timeoutMs: number): Promise<Record<string, unknown> | null> {
  const key = process.env.CMC_MCP_API_KEY;
  if (!key) return null;
  const cached = cache.get(String(cmcId));
  if (cached && Date.now() - cached.at < TTL_MS) return cached.ta;
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "X-CMC-MCP-API-KEY": key },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_crypto_technical_analysis", arguments: { id: String(cmcId) } } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) { cache.set(String(cmcId), { at: Date.now(), ta: null }); return null; }
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    let env: unknown;
    if (ct.includes("text/event-stream")) {
      const data = text.split("\n").filter((l) => l.startsWith("data:")).pop()?.slice(5).trim();
      env = data ? JSON.parse(data) : null;
    } else { env = JSON.parse(text); }
    const content = (env as { result?: { content?: { text?: string }[] } })?.result?.content?.[0]?.text;
    const ta = content ? (JSON.parse(content) as Record<string, unknown>) : null;
    cache.set(String(cmcId), { at: Date.now(), ta });
    return ta;
  } catch {
    cache.set(String(cmcId), { at: Date.now(), ta: null });
    return null;
  }
}

// Flatten CMC's TA payload into a sorted list of candidate price levels.
export function candidateLevels(ta: Record<string, unknown>): number[] {
  const out: number[] = [];
  const push = (v: unknown) => { const n = num(v); if (n) out.push(n); };
  push((ta as Record<string, unknown>).pivotPoint);
  const fib = ta.fibonacciLevels as Record<string, unknown> | undefined;
  if (fib) {
    push(fib.swingHigh); push(fib.swingLow);
    for (const grp of ["retracementLevels", "extensionLevels"]) {
      const m = fib[grp] as Record<string, unknown> | undefined;
      if (m) for (const v of Object.values(m)) push(v);
    }
  }
  const ma = ta.moving_averages as Record<string, unknown> | undefined;
  if (ma) for (const v of Object.values(ma)) push(v);
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

// Build support/resistance around `entry` from CMC levels, applying the same min-gap hygiene as the
// klines path. Returns null when CMC's levels can't bracket the entry on both sides (-> caller falls back).
export function levelsFromCmcTA(ta: Record<string, unknown>, entry: number, minGapFrac = 0.005): CmcLevels | null {
  if (!Number.isFinite(entry) || entry <= 0) return null;
  const levels = candidateLevels(ta);
  const gap = entry * minGapFrac;
  const support = levels.filter((x) => entry - x >= gap);
  const resistance = levels.filter((x) => x - entry >= gap);
  if (support.length === 0 || resistance.length === 0) return null;
  const rsiObj = ta.rsi as Record<string, unknown> | undefined;
  const rsi = num(rsiObj?.rsi14) ?? num(rsiObj?.rsi7) ?? 50;
  return { support, resistance, rsi, raw: ta };
}

// Public: fetch + build CMC-sourced levels for a token, or null (never throws). Gated by env key upstream.
export async function getCmcTechnicalAnalysis(cmcId: number, entry: number, timeoutMs = 2500): Promise<CmcLevels | null> {
  const ta = await fetchTA(cmcId, timeoutMs);
  if (!ta) return null;
  return levelsFromCmcTA(ta, entry);
}

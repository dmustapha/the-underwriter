// NOTE (DEV-003, still open): live CMC TA field names are undocumented (beta). The candidate-path
// resolver below is reconciled against the closed-form fallback fixture (real Binance klines); it must
// still be reconciled against a real CMC TA response once a CMC_MCP_API_KEY is available.
import { Signals, FibLevel, RawJson } from "../types";

// Resolve the first defined value among candidate dotted paths.
function pick(obj: RawJson, paths: string[]): unknown {
  for (const path of paths) {
    const v = path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as RawJson)[k] : undefined), obj);
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}
function num(v: unknown, d = NaN): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : d;
}
function arr(v: unknown): number[] {
  return Array.isArray(v) ? v.map((x) => num(x)).filter(Number.isFinite) : [];
}

// Extract the live spot price from a CMC quotes/latest x402 response (closes critique #1: the paid
// quote price was fetched then DISCARDED). The beta x402 shape is loosely documented, so accept both
// the keyed-by-id object (`data: { "1839": { quote: { USD: { price } } } }`) and an array form, and
// both `quote.USD.price` (object) and `quote[0].price` (array). Returns undefined if no positive,
// finite price is present so the caller falls back to the next entry source rather than trusting junk.
export function quotePriceFromX402(raw: RawJson): number | undefined {
  const data = raw?.data as unknown;
  if (!data || typeof data !== "object") return undefined;
  const entries: unknown[] = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>);
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const q = (e as RawJson).quote as unknown;
    const usd: RawJson | undefined = Array.isArray(q)
      ? (q[0] as RawJson | undefined)
      : ((q as RawJson)?.USD as RawJson | undefined) ?? (q as RawJson | undefined);
    const price = num(usd?.price ?? usd?.value);
    if (Number.isFinite(price) && price > 0) return price;
  }
  return undefined;
}

// Fear & Greed (documented): { data: { value } }
export function fearGreedValue(raw: RawJson): number {
  return num(pick(raw, ["data.value", "value"]), 50);
}
// Altcoin season index. Live CMC /v1/altcoin-season-index/latest returns `data.altcoin_index`
// (verified live 2026-06-19) — added as the primary path so a real key actually maps (was silently
// defaulting to 50 because the candidate paths missed the real field name).
export function altSeasonValue(raw: RawJson): number {
  return num(pick(raw, ["data.altcoin_index", "altcoin_index", "data.altcoin_season", "data.value", "altcoin_season", "data.0.value"]), 50);
}

// Market-wide risk proxy from CMC /v1/global-metrics/quotes/latest. True derivatives leverage is not
// on the free tier, so we use altcoin share (100 − BTC dominance) as a TRANSPARENT froth proxy:
// lower BTC dominance ⇒ more capital rotated into alts ⇒ higher systemic risk. Returns undefined if
// dominance is unavailable (regime then reports "leverage n/a" rather than a fabricated constant).
export function globalRiskFromMetrics(raw: RawJson): number | undefined {
  const dom = num(pick(raw, ["data.btc_dominance", "btc_dominance"]), NaN);
  if (!Number.isFinite(dom)) return undefined;
  return Math.max(0, Math.min(100, 100 - dom));
}

// Build Signals from a CMC TA response + entry price + regime numbers.
export function toSignals(
  ta: RawJson,
  entryPrice: number,
  regime: { fearGreed: number; altSeason: number; globalLeverage?: number }
): Signals {
  const support = arr(pick(ta, ["support_levels", "data.support", "technical_analysis.support", "data.support_levels"]));
  const resistance = arr(pick(ta, ["resistance_levels", "data.resistance", "technical_analysis.resistance", "data.resistance_levels"]));
  const fibRaw = pick(ta, ["fibonacci", "data.fibonacci", "fib_levels", "data.fib"]);
  const fib: FibLevel[] = Array.isArray(fibRaw)
    ? (fibRaw as RawJson[]).map((f) => ({ ratio: num(pick(f, ["ratio", "level"]), 0), price: num(pick(f, ["price", "value"]), NaN) })).filter((f) => Number.isFinite(f.price))
    : [];
  const rsi = num(pick(ta, ["rsi", "data.rsi", "indicators.rsi"]), 50);

  return {
    entryPrice,
    support: support.sort((a, b) => a - b),
    resistance: resistance.sort((a, b) => a - b),
    fib,
    rsi,
    fearGreed: regime.fearGreed,
    altSeason: regime.altSeason,
    globalLeverage: regime.globalLeverage,
    degraded: support.length === 0 || resistance.length === 0,
  };
}

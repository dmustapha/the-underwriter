// x402 payment path VERIFIED LIVE 2026-06-18 (F-006 PASS): real USDC settled on Base via the quotes
// endpoint; 2 on-chain tx in submission/proof.md. `pnpm smoke` reproduces a live receipt with a funded key.
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { CMC, CMC_IDS, CHAIN, env } from "../config";
import { CmcResult, X402Receipt, RawJson } from "../types";
import { computeLevels } from "../engine/indicators";
import { getDailyKlinesLive } from "./marketData";
import { getCmcTechnicalAnalysis } from "./mcpClient";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FIX_DIR = join(process.cwd(), "fixtures", "cmc");

// CMC quotes/latest x402 shape (beta, loose): `data` keyed-by-id OR an array; price under quote.USD.
type QuoteEntry = { quote?: { USD?: { price?: number } } };
type QuoteData = { data?: Record<string, QuoteEntry> | QuoteEntry[] };

function makePayingFetch(): typeof fetch {
  const pk = env("X402_PRIVATE_KEY");
  // Require a well-formed 32-byte hex key. A missing OR placeholder/malformed key (e.g. the
  // .env.example default) falls back to plain fetch -> cache/REST path, never a hard crash.
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) return fetch;
  const account = privateKeyToAccount(pk as `0x${string}`);
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: CHAIN.network, client: new ExactEvmScheme(account) }],
    // budget guard: reject any 402 demanding more than maxCallUnits.
    // NB: selector signature is contextually typed as SelectPaymentRequirements
    // = (x402Version: number, paymentRequirements: PaymentRequirements[]) => PaymentRequirements
    // (DEV-001: ARCHITECTURE §10 annotated the first param as `string`; the installed
    // @x402/core 2.15 types it as `number`. Annotations dropped so they infer correctly.)
    // [T0-3] budget guard: reject any 402 demanding more than maxCallUnits. A malformed `amount`
    // (non-numeric) must not throw inside BigInt() — skip it; if nothing is affordable, return
    // undefined → the x402 lib makes no payment → paidGet's try/catch falls back cleanly.
    paymentRequirementsSelector: (_v, accepts) => {
      const affordable = accepts.filter((a) => {
        try { return BigInt(a.amount) <= CMC.maxCallUnits; } catch { return false; }
      });
      return affordable[0];
    },
  });
}

const payingFetch = makePayingFetch();

function cacheRead<T>(key: string): T | undefined {
  const p = join(FIX_DIR, `${key}.json`);
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")) as T;
  return undefined;
}
function cacheWrite(key: string, data: unknown): void {
  // Best-effort (DBG-007): on a read-only serverless filesystem (e.g. Vercel) the write throws.
  // Caching is an optimization, never a correctness requirement — a write failure must NOT bubble up
  // and discard a just-earned x402 receipt. Reads fall back to the committed fixtures.
  try {
    mkdirSync(FIX_DIR, { recursive: true });
    writeFileSync(join(FIX_DIR, `${key}.json`), JSON.stringify(data, null, 2));
  } catch {
    /* read-only fs — skip caching, keep the receipt */
  }
}

// Generic paid GET with: x402 -> REST-key fallback -> cache. Records a receipt on x402 success.
async function paidGet<T = unknown>(key: string, path: string): Promise<CmcResult<T>> {
  // 1) try x402 (payment is auth)
  try {
    const res = await payingFetch(`${CMC.x402Base}${path}`, { method: "GET" });
    if (res.ok) {
      const data = (await res.json()) as T;
      let receipt: X402Receipt | undefined;
      const h = res.headers.get("PAYMENT-RESPONSE");
      if (h) {
        // [T0-1] The payment ALREADY settled on-chain by the time this header arrives. A decode failure
        // must NOT discard the result and fall through to a fallback — that would lose proof of money
        // already spent. Record the receipt regardless; only the txHash may be unknown on a parse error.
        // verified live (2026-06-18): settlement header decodes to { success, txHash, networkId, x402FlowId }.
        // ARCHITECTURE §10 read `decoded.transaction` (wrong) — the real field is `txHash` (DEV-009).
        let txHash = "";
        try {
          const decoded = decodePaymentResponseHeader(h) as { txHash?: string; transaction?: string };
          txHash = decoded.txHash ?? decoded.transaction ?? "";
        } catch {
          /* malformed header — keep the receipt with an empty txHash, never drop the settled payment */
        }
        receipt = { endpoint: path, amountUsd: 0.01, txHash, source: "x402" };
      }
      cacheWrite(key, data);
      return { data, source: "x402", receipt };
    }
  } catch {
    /* fall through */
  }
  // 2) REST-key fallback
  const apiKey = env("CMC_PRO_API_KEY");
  if (apiKey) {
    try {
      const res = await fetch(`${CMC.restBase}${path}`, { headers: { "X-CMC_PRO_API_KEY": apiKey } });
      if (res.ok) {
        const data = (await res.json()) as T;
        cacheWrite(key, data);
        return { data, source: "rest" };
      }
    } catch {
      /* fall through */
    }
  }
  // 3) cache fallback (beta insurance)
  const cached = cacheRead<T>(key);
  if (cached) return { data: cached, source: "cache", degraded: false };
  return { data: {} as T, source: "cache", degraded: true };
}

export const cmcClient = {
  getFearGreed: () => paidGet("fear-greed", CMC.fearGreedPath),
  getGlobalMetrics: () => paidGet("global-metrics", CMC.globalMetricsPath),
  getAltSeason: () => paidGet("alt-season", CMC.altSeasonPath),
  // x402-enabled quotes pull — yields a REAL Base receipt + the live entry price (verified live).
  getQuoteX402: (symbol: string): Promise<CmcResult<QuoteData>> => {
    const id = CMC_IDS[symbol.toUpperCase()];
    // [CRITIQUE #7] never silently map an unsupported symbol to BNB — that pays $0.01 for the WRONG
    // market and (once price→entry is wired) underwrites it at BNB's price. Return a degraded empty
    // result so the caller falls back instead of paying. The route also allowlists before reaching here.
    if (id === undefined) return Promise.resolve({ data: {}, source: "cache", degraded: true });
    return paidGet<QuoteData>(`quote-${symbol.toLowerCase()}`, `${CMC.x402QuotesPath}?id=${id}`);
  },
  // TA has no documented REST endpoint -> served from a Day-1 captured fixture (via MCP) or computed from klines.
  getTechnicalAnalysisCached: (symbol: string) => {
    const cached = cacheRead<Record<string, unknown>>(`ta-${symbol.toLowerCase()}`);
    return { data: cached ?? {}, source: "cache" as const, degraded: !cached };
  },
  // LIVE request-path levels (closes critique #2/#3): compute CMC-method pivots+fib from real daily
  // klines pulled per request (Bybit — Binance is HTTP 451 from US clouds). The SAME computeLevels the
  // backtest uses, so the engine math is identical to the EARNED ablation. `entryHint` (caller entry or
  // live quote price) partitions support/resistance; absent it, the latest close is used. Any failure
  // (unsupported token / network / degenerate levels) falls back to the committed closed-form fixture,
  // so the path NEVER fail-opens and offline demos still work. levelsSource tags which tier served it.
  getTechnicalAnalysisLive: async (
    symbol: string,
    entryHint?: number
  ): Promise<{ data: RawJson; source: "rest" | "cache"; degraded: boolean; levelsSource: "cmc" | "live" | "fixture" }> => {
    // [Fix 3] Two live level sources race CONCURRENTLY (no added latency vs the klines-only path):
    //   (a) the CMC Agent Hub technical-analysis tier — real CoinMarketCap fib + pivot + MAs;
    //   (b) the live Bybit daily-klines path (CMC-method pivots+fib).
    // CMC is preferred when its levels actually bracket the entry on both sides a meaningful distance
    // away (validity-gated, never throws); otherwise — e.g. a snapshot price that differs from the
    // agent's entry, the common demo case — we transparently use the klines result. Both are kicked
    // off before either is awaited, so wall-clock is max(MCP, klines), not their sum.
    const cmcId = CMC_IDS[symbol.toUpperCase()];
    const wantCmc = !!cmcId && Number.isFinite(entryHint) && (entryHint as number) > 0;
    const cmcPromise = wantCmc ? getCmcTechnicalAnalysis(cmcId, entryHint as number) : Promise.resolve(null);

    const klinesPromise = (async () => {
      const window = await getDailyKlinesLive(symbol); // throws on unsupported/failed
      const lastClose = window[window.length - 1]?.close;
      const entry = Number.isFinite(entryHint) && (entryHint as number) > 0 ? (entryHint as number) : lastClose;
      if (!Number.isFinite(entry) || entry <= 0) throw new Error("no usable entry for level computation");
      const lv = computeLevels(window, entry);
      // Drop levels that collapse onto the entry (see hygiene note): a coincident pivot a hair below
      // the latest close would fabricate a near-zero stop and an absurd reward:risk. Require >=0.5%.
      const MIN_GAP = entry * 0.005;
      const support = lv.support.filter((x) => entry - x >= MIN_GAP);
      const resistance = lv.resistance.filter((x) => x - entry >= MIN_GAP);
      if (support.length === 0 || resistance.length === 0) {
        throw new Error("computed levels degenerate (no support/resistance a meaningful distance from entry)");
      }
      const data: RawJson = {
        _source: "live Bybit daily klines, CMC-method pivots+fib (request path)",
        entry: lastClose,
        support_levels: support,
        resistance_levels: resistance,
        fibonacci: lv.fib,
        rsi: lv.rsi,
      };
      return { data, source: "rest" as const, degraded: false, levelsSource: "live" as const };
    })();

    const [cmcSettled, klinesSettled] = await Promise.allSettled([cmcPromise, klinesPromise]);
    if (cmcSettled.status === "fulfilled" && cmcSettled.value) {
      const cmc = cmcSettled.value;
      return {
        data: {
          _source: "live CoinMarketCap Agent Hub technical analysis (MCP)",
          entry: entryHint, support_levels: cmc.support, resistance_levels: cmc.resistance,
          fibonacci: [], rsi: cmc.rsi, levelsProvider: "cmc-mcp",
        },
        source: "rest", degraded: false, levelsSource: "cmc",
      };
    }
    if (klinesSettled.status === "fulfilled") return klinesSettled.value;
    {
      // Fixture fallback (Bybit unreachable). Apply the SAME min-gap hygiene to the frozen levels so a
      // caller entry landing ~on a fixture level can't produce a degenerate near-zero stop / absurd
      // reward:risk. Partition around the resolved entry; if nothing meaningful remains, the levels read
      // as degraded → the engine DECLINEs (safe), never an absurd APPROVE.
      const fb = cmcClient.getTechnicalAnalysisCached(symbol);
      const d = fb.data as RawJson;
      const fEntry = Number.isFinite(entryHint) && (entryHint as number) > 0
        ? (entryHint as number)
        : typeof d.entry === "number" ? (d.entry as number) : undefined;
      if (fEntry && Array.isArray(d.support_levels) && Array.isArray(d.resistance_levels)) {
        const gap = fEntry * 0.005;
        const support = (d.support_levels as number[]).filter((x) => fEntry - x >= gap);
        const resistance = (d.resistance_levels as number[]).filter((x) => x - fEntry >= gap);
        return {
          data: { ...d, support_levels: support, resistance_levels: resistance },
          source: "cache",
          degraded: fb.degraded || support.length === 0 || resistance.length === 0,
          levelsSource: "fixture",
        };
      }
      return { data: d, source: "cache", degraded: fb.degraded, levelsSource: "fixture" };
    }
  },
};

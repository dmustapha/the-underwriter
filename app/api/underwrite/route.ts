import { NextRequest, NextResponse } from "next/server";
import { cmcClient } from "../../../src/clients/cmcClient";
import { toSignals, fearGreedValue, altSeasonValue, globalRiskFromMetrics, quotePriceFromX402 } from "../../../src/clients/cmcAdapter";
import { allowPaidCall } from "../../../src/server/payGuard";
import { underwrite } from "../../../src/engine/envelope";
import { CMC_IDS } from "../../../src/config";
import { TradeRequest, PortfolioState, X402Receipt, RawJson } from "../../../src/types";

// Supported tokens = the CMC ids we can actually price. Allowlisting here (a) stops an unsupported
// symbol from being silently priced as BNB (#7) and (b) closes a cache-key path-traversal (the symbol
// becomes part of a fixture filename downstream).
const SUPPORTED_TOKENS = Object.keys(CMC_IDS); // BNB, CAKE, BTC, ETH, SOL

// The request runs the x402 quote then live klines sequentially; allow headroom so a cold-start Bybit
// connection still resolves LIVE levels (clamped to the platform max if the plan is lower).
export const maxDuration = 30;

// Sane upper bounds (#11): reject absurd inputs outright. Finite/positive is checked separately; these
// stop a 1e30 "size" or price from sailing through into the response as a nonsense number.
const MAX_INTENDED_SIZE = 1e12; // $1T notional — beyond any real trade
const MAX_ENTRY_PRICE = 1e9;    // $1B unit price

// [CRITIQUE #9] Trusted client IP. The LEFTMOST x-forwarded-for entry is attacker-spoofable (the client
// can pre-set the header), so the old guard keyed cooldowns on a value the attacker controls. Prefer
// Vercel's x-real-ip (set by the edge, not the client); else take the LAST x-forwarded-for hop (the one
// appended by the trusted proxy, closest to us).
function clientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "local";
}

// [CRITIQUE #10] CSRF/origin guard. A cross-site page must not be able to fire a paid pull. Same-origin
// browser requests carry an Origin matching the Host (works for prod AND preview without hardcoding a
// domain); server-to-server / agent / curl calls carry no Origin and are allowed. Anything else → 403.
function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const o = new URL(origin).host;
    const host = req.headers.get("host") ?? req.nextUrl.host;
    if (o === host) return true;
    return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // [CRITIQUE #10] reject cross-origin browser callers + non-JSON content types BEFORE any work — a CSRF
  // "simple request" can only set text/plain | form | multipart, so requiring application/json blocks
  // the drain vector while still accepting legit JSON agents.
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "cross-origin request not allowed" }, { status: 403 });
  }
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }
  // Validate input → clean 400s (the route is part of the public skill surface; a malformed request
  // should never 500 or reach the paying CMC path with garbage). The engine guards size again (defense
  // in depth), but rejecting here saves a wasted live data pull.
  let body: TradeRequest & { entryPrice?: number };
  try {
    body = (await req.json()) as TradeRequest & { entryPrice?: number };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body?.token !== "string" || body.token.trim() === "") {
    return NextResponse.json({ error: "token is required (non-empty string)" }, { status: 400 });
  }
  const token = body.token.trim().toUpperCase();
  if (!SUPPORTED_TOKENS.includes(token)) {
    return NextResponse.json({ error: `unsupported token '${body.token}' — supported: ${SUPPORTED_TOKENS.join(", ")}` }, { status: 400 });
  }
  if (body.side !== "long" && body.side !== "short") {
    return NextResponse.json({ error: "side must be 'long' or 'short'" }, { status: 400 });
  }
  if (typeof body.intendedSize !== "number" || !Number.isFinite(body.intendedSize) || body.intendedSize <= 0 || body.intendedSize > MAX_INTENDED_SIZE) {
    return NextResponse.json({ error: `intendedSize must be a positive number <= ${MAX_INTENDED_SIZE}` }, { status: 400 });
  }
  // [CRITIQUE #8/#11] if the caller pins an entry it must be a finite, positive, bounded price — never
  // let NaN/Infinity/0/absurd reach the engine (div-by-zero → Infinity reward:risk in the response).
  if (body.entryPrice !== undefined && (typeof body.entryPrice !== "number" || !Number.isFinite(body.entryPrice) || body.entryPrice <= 0 || body.entryPrice > MAX_ENTRY_PRICE)) {
    return NextResponse.json({ error: `entryPrice, when provided, must be a positive number <= ${MAX_ENTRY_PRICE}` }, { status: 400 });
  }
  // [§8] Optional account context. An agent passes its real book (equity, drawdown budget, current
  // drawdown) so the sizing governor reflects the actual account; omitted fields fall back to the demo
  // defaults ($10k / 30% / 0), so existing callers are unchanged. Validated so a bad account can never
  // div-by-zero peakEquity or hand the governor a nonsense budget.
  const acct = body as { equity?: number; ddBudget?: number; currentDrawdown?: number };
  if (acct.equity !== undefined && (typeof acct.equity !== "number" || !Number.isFinite(acct.equity) || acct.equity <= 0 || acct.equity > MAX_INTENDED_SIZE)) {
    return NextResponse.json({ error: `equity, when provided, must be a positive number <= ${MAX_INTENDED_SIZE}` }, { status: 400 });
  }
  if (acct.ddBudget !== undefined && (typeof acct.ddBudget !== "number" || !Number.isFinite(acct.ddBudget) || acct.ddBudget <= 0 || acct.ddBudget > 1)) {
    return NextResponse.json({ error: "ddBudget, when provided, must be a number in (0, 1]" }, { status: 400 });
  }
  if (acct.currentDrawdown !== undefined && (typeof acct.currentDrawdown !== "number" || !Number.isFinite(acct.currentDrawdown) || acct.currentDrawdown < 0 || acct.currentDrawdown >= 1)) {
    return NextResponse.json({ error: "currentDrawdown, when provided, must be a number in [0, 1)" }, { status: 400 });
  }
  const acctEquity = acct.equity ?? 10_000;
  const acctDdBudget = acct.ddBudget ?? 0.3;
  const acctCurrentDD = acct.currentDrawdown ?? 0;
  const receipts: X402Receipt[] = [];

  // x402-enabled pull: a real $0.01 USDC payment on Base → live receipt (on-chain proof in the demo).
  // Gated by the pay guard so the PUBLIC endpoint can't be looped to drain the wallet (SEC-1/DBG-007).
  // When rate-limited we SKIP the paid pull and serve the cached experience (no hard error).
  const pay = allowPaidCall(clientIp(req));
  // [CRITIQUE #1] the paid quote price is now USED as the live entry (was fetched then discarded —
  // "payment theater"). undefined when the pull is rate-limited/skipped/offline → next entry source.
  let quotePrice: number | undefined;
  if (pay.allowed) {
    const quote = await cmcClient.getQuoteX402(token);
    if (quote.receipt?.txHash) receipts.push(quote.receipt);
    quotePrice = quotePriceFromX402(quote.data as RawJson);
  }

  // value-of-information: cheap regime signals (REST/cache — not x402-enabled, no receipt).
  const fg = await cmcClient.getFearGreed();
  if (fg.receipt) receipts.push(fg.receipt);
  const alt = await cmcClient.getAltSeason();
  if (alt.receipt) receipts.push(alt.receipt);

  const fearGreed = fearGreedValue(fg.data as RawJson);
  const altSeason = altSeasonValue(alt.data as RawJson);

  // escalate to expensive global metrics only if regime is ambiguous (mid-range F&G). [CRITIQUE #5]
  // skip escalation when F&G is DEGRADED — an outage returns the neutral 50, which lands inside the
  // 45–60 band and would otherwise trigger a paid derivatives pull on every degraded run (an outage
  // must not INCREASE spend).
  let globalLeverage: number | undefined;
  if (!fg.degraded && fearGreed >= 45 && fearGreed <= 60) {
    const gm = await cmcClient.getGlobalMetrics();
    if (gm.receipt) receipts.push(gm.receipt);
    // Real market-risk proxy from live CMC global-metrics (BTC dominance) — replaces the former
    // hardcoded placeholder (DEV-007). undefined if unavailable → regime reports "leverage n/a".
    globalLeverage = globalRiskFromMetrics(gm.data as RawJson);
  }

  // [CRITIQUE #2/#3] LIVE request-path levels computed from real daily klines (Bybit), fixture
  // fallback. Levels are partitioned around the resolved entry (caller > live quote > latest close).
  const ta = await cmcClient.getTechnicalAnalysisLive(token, body.entryPrice ?? quotePrice);
  const taData = ta.data as RawJson;
  // entry resolution: caller-pinned > live x402 quote price > TA's recorded entry (live close, or the
  // fixture's recorded entry on fallback) > 600 offline default. Guarded finite & positive (#8) so a
  // bad source can never div-by-zero the engine into an Infinity reward:risk.
  const taEntry = typeof taData.entry === "number" ? (taData.entry as number) : undefined;
  const entryCandidate = body.entryPrice ?? quotePrice ?? taEntry ?? 600;
  const entryPrice = Number.isFinite(entryCandidate) && entryCandidate > 0 ? entryCandidate : 600;
  const signals = toSignals(taData, entryPrice, { fearGreed, altSeason, globalLeverage });

  // [§8] account state from the request (or demo defaults). peakEquity is derived so that
  // (peak - equity)/peak == currentDrawdown, keeping the governor's budget math consistent.
  const state: PortfolioState = {
    equity: acctEquity,
    peakEquity: acctEquity / (1 - acctCurrentDD),
    ddBudget: acctDdBudget,
    currentDrawdown: acctCurrentDD,
  };
  // Live path opts into the DIRECTIONAL + RSI-aware regime (the backtest/ablation path does NOT, so the
  // earned Day-2 numbers stay byte-identical). Directional: froth shrinks longs, not shorts. RSI: shrink
  // a long that's overbought or a short that's oversold.
  const envelope = underwrite({ token, side: body.side, intendedSize: body.intendedSize }, signals, state, receipts, { side: body.side, useRsi: true });

  // [CRITIQUE #4] HONEST evidence scoreboard. The old version reported `pulls = receipts.length`, which
  // only ever counts the ONE x402-payable quote (F&G/altSeason/derivatives are REST/cache, not payable)
  // — so a rate-limited SKIP read as "4 fewer pulls, $0.04 saved", inflating an outage into a win.
  // The genuine value-of-information story is in PULLS, not dollars: cheap regime signals first, and the
  // expensive derivatives pull bought ONLY when the regime is ambiguous. On-chain spend is just the
  // single $0.01 price quote.
  const escalated = globalLeverage !== undefined;
  const signalPulls = (pay.allowed ? 1 : 0) /* live price quote */ + 2 /* F&G + altSeason */ + (escalated ? 1 : 0);
  const NAIVE_PULLS = 4; // a naive agent consults price + F&G + altSeason + derivatives on EVERY call
  const pullsSaved = Math.max(0, NAIVE_PULLS - signalPulls);
  const paidPulls = receipts.length; // real on-chain x402 payments (only the quote is payable)
  return NextResponse.json({
    envelope,
    evidencePath: {
      signalPulls,                       // CMC signals consulted this request (escalation-aware)
      paidPulls,                         // real on-chain x402 payments settled
      spendUsd: paidPulls * 0.01,        // real USDC settled on Base (only the price quote is payable)
      escalated,                         // did regime ambiguity trigger the extra derivatives pull
      pullsSaved,                        // signal pulls avoided vs a naive consult-everything agent
      naivePulls: NAIVE_PULLS,
      levelsSource: ta.levelsSource,     // "live" (Bybit klines) | "fixture" — provenance of stop/TP
      regimeSource: fg.source,           // "x402" | "rest" | "cache" — provenance of the regime read
    },
  });
}

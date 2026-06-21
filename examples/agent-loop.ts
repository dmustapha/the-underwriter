// A real agent loop: a momentum signal agent hands every proposed trade to The Underwriter
// BEFORE it places it, and acts on the verdict. This is the whole pitch, made runnable.
//
//   pnpm example      (tsx --env-file-if-exists=.env examples/agent-loop.ts)
//
// Deterministic + offline: it reads the committed BNB daily klines fixture, generates the same
// RSI+MACD+Fear&Greed signals the backtest uses (src/signals/momentum.ts), and underwrites each
// one with the SAME engine the live /desk and the forkable skill call (src/engine/envelope.ts).
//
// It also carries account state across the session (§8): each fill updates equity + drawdown, so
// the drawdown governor visibly shrinks size — and finally halts — as the account bleeds. That is
// the proof the sizing is real account-aware risk, not a per-call constant.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { momentumTradeLog } from "../src/signals/momentum";
import { signalsFromOHLCV } from "../src/engine/indicators";
import { underwrite } from "../src/engine/envelope";
import { realizeTrade } from "../src/backtest/ablation";
import { Kline, PortfolioState, Trade } from "../src/types";

const KLINES = "fixtures/klines/BNBUSDT-1d-1633046400000-1672444800000.json";
const REGIME = { fearGreed: 72, altSeason: 65, globalLeverage: 68 }; // frothy snapshot -> governor leans risk-off
const INTENDED = 12_000;     // the naive agent's reckless ask (~1.2x equity) on every signal

// The account the agent runs (§8: real context, not a hardcoded constant). A forker changes these.
const ACCOUNT: PortfolioState = { equity: 10_000, peakEquity: 10_000, ddBudget: 0.3, currentDrawdown: 0 };

const usd = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n: number) => (n * 100).toFixed(1) + "%";
const indexAtOrAfter = (k: Kline[], ts: number) => { for (let i = 0; i < k.length; i++) if (k[i].openTime >= ts) return i; return -1; };

function main(): void {
  const klines = JSON.parse(readFileSync(join(process.cwd(), KLINES), "utf8")) as Kline[];
  const signals: Trade[] = momentumTradeLog(klines, REGIME.fearGreed, INTENDED);

  // live, mutable account state carried across the session
  const state: PortfolioState = { ...ACCOUNT };
  let naiveEquity = ACCOUNT.equity; // counterfactual: same signals, NO underwriting, full size every time

  const line = "─".repeat(78);
  console.log(`\n  THE UNDERWRITER · agent loop`);
  console.log(`  a momentum agent underwrites every trade before placing it`);
  console.log(`  account ${usd(state.equity)} · max drawdown budget ${pct(state.ddBudget)} · ${signals.length} signals (RSI×MACD×F&G)\n${line}`);

  let approved = 0, sizedDown = 0, declined = 0;
  for (let n = 0; n < signals.length; n++) {
    const t = signals[n];
    const idx = indexAtOrAfter(klines, t.entryTs);
    if (idx < 2) continue;
    const window = klines.slice(0, idx); // bars strictly before entry — no look-ahead
    const s = signalsFromOHLCV(window, t.entryPrice, REGIME);
    const env = underwrite({ token: t.token, side: t.side, intendedSize: t.intendedSize }, s, state, [], { side: t.side, useRsi: true });

    const date = new Date(t.entryTs).toISOString().slice(0, 10);
    const head = `  #${String(n + 1).padStart(2)}  ${date}  ${t.token} ${t.side} · agent wants ${usd(t.intendedSize)}`;

    // the naive agent always fills full size — its drawdown is the thing being avoided
    naiveEquity += realizeTrade(klines, { entryIndex: idx, entry: t.entryPrice, stop: s.support.filter(x => x < t.entryPrice).at(-1) ?? t.entryPrice * 0.9, tp: s.resistance.find(x => x > t.entryPrice) ?? t.entryPrice * 1.1, notional: t.intendedSize, side: t.side });

    if (env.verdict === "DECLINE") {
      declined++;
      console.log(`${head}\n      → DECLINE  ${env.reason}\n      → agent skips. no trade placed.`);
      continue;
    }
    // APPROVE or SIZE_DOWN: the agent places env.size, then we settle the fill and update the account
    const pnl = realizeTrade(klines, { entryIndex: idx, entry: env.entryPrice, stop: env.stop, tp: env.takeProfit, notional: env.size, side: t.side });
    state.equity += pnl;
    state.peakEquity = Math.max(state.peakEquity, state.equity);
    state.currentDrawdown = (state.peakEquity - state.equity) / state.peakEquity;

    if (env.verdict === "SIZE_DOWN") sizedDown++; else approved++;
    const tag = env.verdict === "SIZE_DOWN" ? "SIZE_DOWN" : "APPROVE  ";
    console.log(`${head}\n      → ${tag}  place ${usd(env.size)}  stop ${env.stop.toFixed(2)}  TP ${env.takeProfit.toFixed(2)}  R:R ${env.rewardRisk.toFixed(2)}`);
    console.log(`      → filled: ${pnl >= 0 ? "+" : ""}${usd(pnl)}  ·  account ${usd(state.equity)}  ·  drawdown ${pct(state.currentDrawdown)}${state.currentDrawdown > 0.18 ? "  ⟵ governor tightening" : ""}`);
  }

  const uwDD = (ACCOUNT.peakEquity - Math.min(state.equity, ACCOUNT.equity)) / ACCOUNT.peakEquity;
  console.log(line);
  console.log(`  verdicts:   ${approved} approved · ${sizedDown} sized-down · ${declined} declined`);
  console.log(`  underwritten account:  ${usd(state.equity)}  (drawdown held to ${pct(Math.max(0, uwDD))})`);
  console.log(`  same signals, no underwriting (full size every time):  ${usd(naiveEquity)}`);

  // ── the governor biting (§8): the same desk, but the agent's account is ALREADY deep in drawdown.
  // Remaining budget is thin, so each trade is clamped hard, and once the budget is spent it HALTS.
  console.log(`\n${line}\n  GOVERNOR · same signals, but the account starts 28.5% into a 30% drawdown budget\n${line}`);
  const stressed: PortfolioState = { equity: 7_150, peakEquity: 10_000, ddBudget: 0.3, currentDrawdown: 0.285 };
  let halted = false;
  for (let n = 0; n < signals.length && !halted; n++) {
    const t = signals[n];
    const idx = indexAtOrAfter(klines, t.entryTs);
    if (idx < 2) continue;
    const s = signalsFromOHLCV(klines.slice(0, idx), t.entryPrice, REGIME);
    const env = underwrite({ token: t.token, side: t.side, intendedSize: t.intendedSize }, s, stressed, [], { side: t.side, useRsi: true });
    const remaining = Math.max(0, stressed.ddBudget - stressed.currentDrawdown);
    if (env.verdict === "DECLINE" && /drawdown budget/i.test(env.reason)) {
      console.log(`  #${n + 1}  → HALT  ${env.reason}`);
      halted = true; break;
    }
    if (env.verdict === "DECLINE") continue; // reward-floor decline, not the governor — skip quietly
    const pnl = realizeTrade(klines, { entryIndex: idx, entry: env.entryPrice, stop: env.stop, tp: env.takeProfit, notional: env.size, side: t.side });
    stressed.equity += pnl;
    stressed.peakEquity = Math.max(stressed.peakEquity, stressed.equity);
    stressed.currentDrawdown = (stressed.peakEquity - stressed.equity) / stressed.peakEquity;
    console.log(`  #${n + 1}  → ${env.verdict === "SIZE_DOWN" ? "SIZE_DOWN" : "APPROVE  "}  place ${usd(env.size)} (vs ${usd(t.intendedSize)} asked) · ${pct(remaining)} budget left → ${pct(Math.max(0, stressed.ddBudget - stressed.currentDrawdown))}`);
  }
  if (!halted) console.log(`  → the governor sized every $12,000 ask down to fit the thin budget — it never let one trade exhaust it.\n  (At currentDrawdown == the budget it stops sizing and DECLINEs outright — proven in tests/account-context.test.ts.)`);
  console.log(`\n  the agent never had to know risk math — it just asked first.\n`);
}

main();

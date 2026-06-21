import { Signals, RegimeResult, Side } from "../types";
import { RISK } from "../config";

// Opt-in directional + momentum behavior. Both default OFF so the side-agnostic path (the backtest /
// locked ablation) is byte-identical to the original. The LIVE route opts in via {side, useRsi}.
export interface RegimeOpts {
  side?: Side;      // when set, regime is DIRECTIONAL: froth shrinks longs, not shorts
  useRsi?: boolean; // when true, an RSI momentum gate shrinks trades chasing exhausted momentum
}

// Each sub-signal yields a multiplier in (0,1]; we take the product, floored at K_MIN.
// Higher froth/greed/leverage -> smaller size.
export function regimeMultiplier(s: Signals, opts: RegimeOpts = {}): RegimeResult {
  const isShort = opts.side === "short";

  // Froth (greed, alt-season rotation, market-risk proxy) is LONG-side risk — it marks bullish
  // exhaustion. For a long it shrinks size; for a short that same froth is the SETUP, not a risk, so a
  // directional short is not penalized for it. With no side (backtest/legacy path) froth always shrinks,
  // preserving the earned ablation exactly.
  const frothActive = !isShort;

  const fgMult = frothActive ? (s.fearGreed >= 75 ? 0.5 : s.fearGreed >= 60 ? 0.75 : 1.0) : 1.0;
  const altMult = frothActive ? (s.altSeason >= 75 ? 0.7 : s.altSeason >= 60 ? 0.85 : 1.0) : 1.0;

  // Market-risk proxy (optional): from CMC global-metrics (100 − BTC dominance = altcoin froth);
  // higher = more capital in alts = riskier → shrinks size. (Field is named globalLeverage for
  // back-compat; true derivatives leverage isn't on the free CMC tier.)
  let levMult = 1.0;
  let partialRegime = true;
  if (typeof s.globalLeverage === "number") {
    partialRegime = false;
    levMult = frothActive ? (s.globalLeverage >= 75 ? 0.7 : s.globalLeverage >= 60 ? 0.85 : 1.0) : 1.0;
  }

  // RSI momentum gate (opt-in): chasing exhausted momentum is risk on either side — overbought (>=70)
  // for a long, oversold (<=30) for a short. Off by default → backtest path unchanged.
  let rsiMult = 1.0;
  if (opts.useRsi) {
    if (isShort) { if (s.rsi <= 30) rsiMult = 0.8; }
    else if (s.rsi >= 70) rsiMult = 0.8;
  }

  const raw = fgMult * altMult * levMult * rsiMult;
  const k = Math.max(RISK.kMin, raw);
  const rsiNote = opts.useRsi ? `, RSI ${s.rsi.toFixed(0)}->x${rsiMult}` : "";
  const sideNote = isShort ? `, short (froth-neutral)` : "";
  const rationale =
    `F&G ${s.fearGreed}->x${fgMult}, altSeason ${s.altSeason}->x${altMult}` +
    (partialRegime ? `, mktRisk n/a` : `, mktRisk ${s.globalLeverage}->x${levMult}`) +
    rsiNote + sideNote +
    ` => k=${k.toFixed(2)}`;
  return { k, rationale, partialRegime };
}

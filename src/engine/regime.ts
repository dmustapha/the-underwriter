import { Signals, RegimeResult } from "../types";
import { RISK } from "../config";

// Each sub-signal yields a multiplier in (0,1]; we take the product, floored at K_MIN.
// Higher froth/greed/leverage -> smaller size.
export function regimeMultiplier(s: Signals): RegimeResult {
  // Fear & Greed: extreme greed (>75) shrinks size; extreme fear (<25) allows full.
  const fgMult = s.fearGreed >= 75 ? 0.5 : s.fearGreed >= 60 ? 0.75 : 1.0;

  // Altcoin season: frothy alt rotation (>75) shrinks size.
  const altMult = s.altSeason >= 75 ? 0.7 : s.altSeason >= 60 ? 0.85 : 1.0;

  // Market-risk proxy (optional): from CMC global-metrics (100 − BTC dominance = altcoin froth);
  // higher = more capital in alts = riskier → shrinks size. (Field is named globalLeverage for
  // back-compat; true derivatives leverage isn't on the free CMC tier.)
  let levMult = 1.0;
  let partialRegime = true;
  if (typeof s.globalLeverage === "number") {
    partialRegime = false;
    levMult = s.globalLeverage >= 75 ? 0.7 : s.globalLeverage >= 60 ? 0.85 : 1.0;
  }

  const raw = fgMult * altMult * levMult;
  const k = Math.max(RISK.kMin, raw);
  const rationale =
    `F&G ${s.fearGreed}->x${fgMult}, altSeason ${s.altSeason}->x${altMult}` +
    (partialRegime ? `, mktRisk n/a` : `, mktRisk ${s.globalLeverage}->x${levMult}`) +
    ` => k=${k.toFixed(2)}`;
  return { k, rationale, partialRegime };
}

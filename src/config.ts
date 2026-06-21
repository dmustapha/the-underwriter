// Central config. All tunables live here so the ablation + engine are reproducible.

export const CHAIN = {
  // Base mainnet — the ONLY network CMC x402 accepts (eip155:8453). No testnet.
  network: "eip155:8453" as const,
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`, // native USDC, 6 dec
  baseScanTx: (h: string) => `https://basescan.org/tx/${h}`,
};

export const CMC = {
  // x402 REST base — payment is auth, no API key (DEEP-RESEARCH §1).
  x402Base: "https://pro-api.coinmarketcap.com/x402",
  // REST-key fallback base.
  restBase: "https://pro-api.coinmarketcap.com",
  // x402-ENABLED path (verified live 2026-06-18 against coinmarketcap.com/api/x402): the quotes
  // endpoint is the payable surface that yields a real Base receipt + the live entry price.
  // NB: fear-and-greed/global-metrics/alt-season are NOT x402-enabled (return empty `accepts`);
  // they stay REST/cache-only and degrade gracefully.
  x402QuotesPath: "/v3/cryptocurrency/quotes/latest",
  fearGreedPath: "/v3/fear-and-greed/latest",
  globalMetricsPath: "/v1/global-metrics/quotes/latest",
  altSeasonPath: "/v1/altcoin-season-index/latest",
  // per-call x402 spend cap in USDC base units (6 dec): 0.05 USDC. The Base accept is 10000 (0.01).
  maxCallUnits: 50_000n,
};

// CMC numeric ids for the x402 quotes pull (symbol -> id). BNB/CAKE cover the demo tokens.
export const CMC_IDS: Record<string, number> = { BNB: 1839, CAKE: 7186, BTC: 1, ETH: 1027, SOL: 5426 };

export const BINANCE = {
  klines: "https://api.binance.com/api/v3/klines",
};

// Risk-engine tunables.
export const RISK = {
  baseRiskFraction: 0.01,   // 1% of equity at risk per trade before regime/governor
  rrMin: 2.0,               // decline if reward:risk below this (Day-2 tuning: raised 1.5->2.0 per PLAN Task 2.5 decision tree to strengthen selection; standard 2:1 R:R floor)
  kMin: 0.25,               // regime multiplier floor
  governorPerTradeFraction: 0.1, // a trade may risk at most 10% of remaining DD budget
};

// Indicator windows.
export const INDI = {
  fibLookback: 60,          // bars for swing high/low
  rsiPeriod: 14,
};

export function env(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

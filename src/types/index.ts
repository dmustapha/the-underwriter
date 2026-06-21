// All shared types. If a type is used by >1 component, it lives here.

export type Side = "long" | "short";
export type Verdict = "APPROVE" | "SIZE_DOWN" | "DECLINE";
export type CmcSource = "x402" | "rest" | "cache";

// ---- request / output ----
export interface TradeRequest {
  token: string;        // symbol, e.g. "BNB"
  side: Side;
  intendedSize: number; // USD notional the agent wants to deploy
}

export interface X402Receipt {
  endpoint: string;     // which CMC pull
  amountUsd: number;    // e.g. 0.01
  txHash: string;       // Base mainnet tx hash for BaseScan
  source: CmcSource;
}

export interface RiskEnvelope {
  token: string;
  side: Side;
  size: number;             // USD notional we authorize (<= intendedSize)
  stop: number;             // price
  takeProfit: number;       // price
  rewardRisk: number;       // |TP-entry| / |entry-stop|
  verdict: Verdict;
  reason: string;           // cites CMC S/R levels
  entryPrice: number;
  cmcLevels: { support: number; resistance: number };
  regimeK: number;
  receipts: X402Receipt[];
  degraded: boolean;        // true if signals were unavailable -> fail-safe DECLINE
}

// ---- signals (source-agnostic: CMC live OR OHLCV-derived in backtest) ----
export interface FibLevel { ratio: number; price: number; }

export interface Signals {
  entryPrice: number;
  support: number[];        // ascending
  resistance: number[];     // ascending
  fib: FibLevel[];
  rsi: number;
  fearGreed: number;        // 0-100
  altSeason: number;        // 0-100 (50 neutral)
  globalLeverage?: number;  // optional, normalized 0-100 (higher = riskier)
  degraded: boolean;        // a required field (support/resistance) was missing
}

export interface RegimeResult {
  k: number;                // sizing multiplier in [K_MIN, 1]
  rationale: string;
  partialRegime: boolean;   // derivatives pull skipped/failed
}

export interface PortfolioState {
  equity: number;
  peakEquity: number;
  ddBudget: number;         // e.g. 0.30 (DQ line)
  currentDrawdown: number;  // (peakEquity - equity) / peakEquity, >=0
}

// ---- raw CMC shapes (loose: beta, undocumented field names) ----
export type RawJson = Record<string, unknown>;
export interface CmcResult<T = RawJson> {
  data: T;
  source: CmcSource;
  receipt?: X402Receipt;
  degraded?: boolean;
}

// ---- backtest ----
export interface Kline {
  openTime: number; open: number; high: number; low: number; close: number; volume: number; closeTime: number;
}

export interface Trade {
  token: string;
  side: Side;
  entryTs: number;          // ms
  entryPrice: number;
  intendedSize: number;     // USD notional
}

export type ArmName = "raw" | "flatHaircut" | "fullGate";

export interface ArmResult {
  arm: ArmName;
  totalReturn: number;      // fraction, e.g. 0.42
  maxDrawdown: number;      // fraction, e.g. 0.34
  calmar: number;           // totalReturn / maxDrawdown
  winRate: number;          // fraction of executed trades that won
  avgExposure: number;      // mean (notional / equity-at-entry) over executed trades
  tradeCount: number;       // executed trades
  excludedTrades: number;   // declined (fullGate only)
}

export interface AblationResult {
  arms: ArmResult[];
  equityCurves: Record<ArmName, number[]>;
  declined: Trade[];
  haircutConstant: number;  // c such that flatHaircut avgExposure == fullGate avgExposure
}

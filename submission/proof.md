# The Underwriter — Proof of Integration

**Hackathon:** BNB Hack: AI Trading Agent Edition — Track 2 (Strategy Skills) + Best Use of CMC Agent Hub
**What it is:** a CoinMarketCap AI-Agent Strategy Skill that risk-underwrites a proposed trade
`{token, side, intended size}` into a full risk envelope — position size, stop-loss, take-profit,
reward:risk, and a drawdown-budget verdict (APPROVE / SIZE_DOWN / DECLINE). Two layers: a forkable
`SKILL.md` (CMC Agent Skills format) + a deterministic TypeScript engine (math + backtest + x402).

---

## 1. The depth proof — equal-exposure ablation (EARNED, real data)

Demo stress scenario: the **2022 BNB bear** (real Binance `BNBUSDT` daily klines). We underwrite a
named competitor-style **RSI + MACD + Fear&Greed momentum skill** (the kind several Track-2 teams
ship) and compare three arms. All three exit at the **same CMC-level stops** — the only variables are
sizing and trade selection. `flatHaircut` and `fullGate` are held to a **matched average exposure**
(0.81 vs 0.83) — so any edge is from *which trades it takes*, not from deploying less capital.

| Arm | Return | Max Drawdown | Calmar | Win-rate | Avg exposure | Trades | Declined |
|---|---|---|---|---|---|---|---|
| raw (naive momentum) | −9.6% | 11.7% | −0.82 | 31% | 1.29 | 13 | 0 |
| flatHaircut (trivial size cut) | −6.2% | 7.5% | −0.82 | 31% | 0.81 | 13 | 0 |
| **fullGate (The Underwriter)** | **−0.4%** | **2.0%** | **−0.21** | 17% | 0.83 | 6 | **7** |

- **Why a flat size-cut can't fake it:** Calmar is scale-invariant, so `flatHaircut` has the *same*
  Calmar as `raw` (−0.82). Only the underwriter's per-trade selection + risk-based sizing moves it
  (−0.82 → −0.21) while cutting realized drawdown from 7.5% to **2.0% at a matched exposure (0.81 vs 0.83)**.
- **DECLINE is a true exclusion:** 7 of 13 trades excluded → win-rate moves (31% → 17%), not size→0.
- **EARNED, not fabricated:** reproduce with `pnpm seed && pnpm backtest fixtures/trade-log-momentum.json BNBUSDT 1d` → prints `DAY-2 GATE: GO`.
- Demonstrated on the **2022 BNB bear** (shown). The method is window-agnostic — re-run `pnpm backtest`
  against any window to reproduce; the deep-bear window is the hardest stress and is the one shipped.

## 2. On-chain x402 proof (Base mainnet) — ✅ LIVE & VERIFIED (2026-06-18)

Real CMC x402 USDC micropayments on **Base mainnet** (eip155:8453), gasless EIP-3009, $0.01 each.
The payable surface is `/x402/v3/cryptocurrency/quotes/latest` (verified against coinmarketcap.com/api/x402).

- **Payer wallet (Base):** `0x33ba73912604b678B1A53FF174D06Cd49d9b5728`
- **x402 tx #1:** https://basescan.org/tx/0xd8bc0df690ecfc2dfcad920ae2e92b72da21c222303e09156e33b8a540478a95 (block 47486980)
- **x402 tx #2:** https://basescan.org/tx/0x4963491fa313d7b70759c9c64f128041e77074b9ae9bc787fd4af6e6eae0a547 (block 47486994)
- **x402 tx #3 (production build):** https://basescan.org/tx/0x6652eb731acbcb55e2367501b78887dabe72920b9adbe27ae4aae83b210aaaf8 (block 47568588) — fired from `pnpm start` (the production bundle that Vercel runs), proving the deployed code path settles a real payment. All three resolve with `from` = payer `0x33ba73…5728`, `to` = USDC contract, 0.01 USDC each.
- **x402 tx #4 (live deployment, livetest 2026-06-20):** https://basescan.org/tx/0xa7215fe6be759f27b88b45aa845161eacb7b838a13ae2f59ee893d0eff687add (block 47575040) — fired from the deployed `the-underwriter.vercel.app` Underwrite path during the live-deployment audit, status success, `to` = USDC, `from` = payer `0x33ba73…5728`, 0.01 USDC.
- **x402 tx #5 (redesigned 4-page deployment, livetest 2026-06-20):** https://basescan.org/tx/0x80ee4c2aebab70f7b47753ff475fab38c96c0859db08a7b9953519c59095d53d (block 47595555) — fired from the new `/desk` route after the Tearsheet redesign + redeploy, status success, `to` = USDC, `from` = payer `0x33ba73…5728`, 0.01 USDC. Confirms the redesigned deployment still settles real on-chain payments.
- **x402 tx #6 (LIVE-DATA deployment, `fra1` region, 2026-06-20):** https://basescan.org/tx/0x2e3b296bf3b09d0bd598ec21a6ceecebdfb08721da374ce183e3c6736442ae78 — fired from the deployed Underwrite path *after* the engine fix that uses the paid quote price as the live entry and computes stop/take-profit from **live daily klines**. The same response reported `evidencePath.levelsSource = "live"`, proving the deployed endpoint now prices from real market data (not a frozen fixture) **and** settles a real on-chain payment in one call. (Functions run in `fra1` — Bybit's public market data is blocked from Vercel's US datacenter IPs but reachable from EU; x402 → Base settles fine from either.)
- **Token / amount:** native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 0.01 USDC per call
- **Settlement:** server returns `payment-response` header → `{ success: true, txHash, networkId: "eip155:8453" }`
- **Reproduce:** `pnpm smoke` → prints `source=x402` + a resolvable BaseScan tx. Both hashes above resolve via `eth_getTransactionByHash` on Base (to = USDC contract).

> The live demo's Underwrite button also fires a real x402 quote pull, so a fresh BaseScan receipt
> appears in the UI on each underwrite. The quote price is now USED as the live entry (not discarded),
> and the stop/take-profit levels are computed from live klines. Value-of-information metering is in
> PULLS: cheap regime signals first, the expensive derivatives pull only when the regime is ambiguous
> — the one on-chain cost is the single $0.01 price quote (the regime signals are REST/cache, not payable).

## 3. CMC Agent Hub surfaces

| Surface | Status |
|---|---|
| MCP tool composition (5 `mcp__cmc-mcp__*` tools in `SKILL.md`, all with a code path or a documented skip) | ✅ authored (`skill/the-underwriter/SKILL.md`) |
| x402 paid pulls (Base mainnet, value-of-information metering) | ✅ LIVE — 6 verified Base receipts (see §2) |
| Live request-path data (quote price → entry; stop/TP from live klines) | ✅ LIVE — deployed `evidencePath.levelsSource = "live"` (tx #6) |
| Skills-format authoring (forkable single-file `SKILL.md`) | ✅ valid frontmatter + 5 tool IDs |
| Upstream PR to `openCMC/skills-for-ai-agents-by-CoinMarketCap` | ⏳ PENDING publish |
| Value-of-information spend metering (naive vs metered scoreboard) | ✅ `/api/underwrite` + UI |
| CMC CLI (`cmc quotes BNB`, E-4) screenshot | ⏳ PENDING (`pnpm cmc:demo`; needs `cmc` CLI + key) → `submission/screenshots/cmc-cli.png` |

## 4. Live demo — ✅ DEPLOYED

- **URL: https://the-underwriter.vercel.app** (Vercel production, public)
- **Live x402 from the deployed serverless runtime:** a real $0.01 USDC payment fired from the deployed app — tx **https://basescan.org/tx/0x6007062572f137fc12b4977c878c4ca79716b354f9b941cf22615eab1ca88222** (Base block 47572728, status OK, from payer `0x33ba73…5728`). This is the strongest proof: the *deployed* URL, not just local, settles real on-chain payments.
- `/` — landing + the equal-exposure ablation ledger (auto-loads) with the 30% DQ reference line
- `/desk` — underwrite a proposed trade → full risk envelope, live x402 receipt, evidence scoreboard (verdict is computed from the live entry price, so it tracks the market)
- `/proof` — this document
- Deploy posture: `CMC_PRO_API_KEY` + `X402_PRIVATE_KEY` set on Vercel; payer wallet funded small ($2.5 USDC) + a per-IP/global pay guard (trusted-IP keyed, bounded-eviction) bound griefing to the wallet balance; CSRF guard (same-origin + `application/json` required) on the paid route. Functions pinned to `fra1` (`vercel.json`) so the live-klines source is reachable.

## 5. Forkable skill

- Own MIT repo: `PENDING — push skill/the-underwriter/` (install via `cp -r`, NOT `npx skills add`)
- Upstream PR: `PENDING`

---

### Honesty notes
- The "naive arm blows past the 30% DQ line" framing was **dropped** — on real data the level-based
  stops cap raw drawdown at ~11.7%; manufacturing a 30% blowup would require fake leverage. The 30%
  line appears on the chart as the competition's rule **context**, not as the proof. The proof is the
  equal-exposure dominance above.
- Live underwrite levels are computed per request from **live daily klines** (Bybit — Binance returns
  HTTP 451 from US clouds, so it is unusable on the deploy) using the **same `computeLevels` method the
  backtest uses**, so the demo stays self-consistent and the earned ablation numbers cannot move. The
  live x402 **quote price is used as the entry** (no longer fetched-then-discarded). The committed
  closed-form fixture is the **offline fallback**; the UI tags each envelope `levels: live | fixture`
  for transparency. With a CMC MCP key, the same path can read live CMC technical analysis directly.

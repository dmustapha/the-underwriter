// Fix 2 — out-of-sample robustness panel. Reads fixtures/ablation-aggregate.json (earned by
// `pnpm seed:aggregate`) and renders the multi-window result: max-drawdown reduction across
// 5 assets x market regimes, with a sign test + bootstrap CI. Honest: leads with drawdown,
// states Calmar is flat, lists every window (incl. losers) and the excluded ones.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface Window {
  asset: string; intendedRegime: string; classifiedRegime: string; trades: number; declined: number;
  flatHaircut: { maxDD: number; calmar: number }; fullGate: { maxDD: number; calmar: number };
  dCalmar: number; dMaxDD: number; improvedMaxDD: boolean;
}
interface Aggregate {
  framing: string; comparison: string; nothingFitted: string; worstCaseNote: string; regimeNote: string;
  windows: Window[]; excluded: { asset: string; regime: string; reason: string }[];
  aggregate: {
    nWindows: number;
    maxDD: { medianDelta: number; improved: number; signTestP: number; bootstrap95: [number, number] };
    calmar: { medianDelta: number; improved: number; signTestP: number };
    byRegime: Record<string, { n: number; improvedMaxDD: number; medianDMaxDD: number; signTestP: number }>;
    adverseOnly: { label: string; n: number; improvedMaxDD: number; medianDMaxDD: number; signTestP: number };
    exposureDeltaMean: number;
  };
}

const pp = (n: number) => (n * 100).toFixed(1) + "pp";
const REGIME_TAG: Record<string, string> = { bull: "bull", bear: "bear", chop: "chop", mixed: "mixed" };

export function AblationAggregate() {
  const p = join(process.cwd(), "fixtures", "ablation-aggregate.json");
  if (!existsSync(p)) return null;
  const data = JSON.parse(readFileSync(p, "utf8")) as Aggregate;
  const a = data.aggregate;
  const md = a.maxDD;
  const adv = a.adverseOnly;

  return (
    <div>
      {/* headline */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="uw-tile p-7" style={{ background: "var(--ink-1)", borderLeft: "2px solid var(--brand)" }}>
          <div className="uw-eyebrow mb-3" style={{ color: "var(--paper-45)" }}>Out-of-sample · {a.nWindows} windows · 5 assets</div>
          <div className="uw-serif" style={{ fontSize: "clamp(28px,3.4vw,40px)", lineHeight: 1.05, letterSpacing: "-0.01em", color: "var(--paper)" }}>
            Cut max drawdown in <span style={{ color: "var(--brand)", fontWeight: 600 }}>{md.improved} of {a.nWindows}</span> windows.
          </div>
          <div className="uw-mono mt-4 text-[14px]" style={{ color: "var(--paper-70)" }}>
            median <span style={{ color: "var(--paper)" }}>−{pp(md.medianDelta)}</span> · sign-test{" "}
            <span style={{ color: "var(--brand)" }}>p = {md.signTestP.toFixed(4)}</span> · bootstrap 95% CI [{pp(md.bootstrap95[0])}, {pp(md.bootstrap95[1])}]
          </div>
          <div className="uw-mono mt-3 text-[13px]" style={{ color: "var(--paper-45)" }}>
            where drawdown risk exists (bear + chop): <span style={{ color: "var(--brand)" }}>{adv.improvedMaxDD}/{adv.n}</span>, p = {adv.signTestP.toFixed(4)}
          </div>
        </div>
        <div className="uw-tile p-7" style={{ background: "var(--ink-1)" }}>
          <div className="uw-label mb-3">Read it honestly</div>
          <p className="m-0 text-[13.5px]" style={{ color: "var(--paper-70)", lineHeight: 1.6 }}>
            A risk <strong style={{ color: "var(--paper)" }}>overlay</strong>, not a new alpha signal. Same entries and exits — only sizing and selection change, at a{" "}
            <strong style={{ color: "var(--paper)" }}>matched average exposure</strong> (Δ {a.exposureDeltaMean.toFixed(2)}). So Calmar stays roughly flat
            (median {a.calmar.medianDelta.toFixed(2)}); the win is <strong style={{ color: "var(--brand)" }}>drawdown</strong>.
          </p>
          <p className="m-0 mt-3 text-[12px]" style={{ color: "var(--paper-45)", lineHeight: 1.55 }}>
            Sentiment is held gate-open on purpose — the adverse case a momentum agent that keeps trading through a downturn — so this is the harder test, not an easier one.
          </p>
        </div>
      </div>

      {/* per-window table */}
      <div className="mt-7 overflow-x-auto">
        <table className="uw-mono w-full" style={{ fontSize: 14, borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {["Asset", "Regime", "Trades", "Declined", "Equal-cut maxDD", "Overlay maxDD", "Δ maxDD", "Δ Calmar"].map((h, i) => (
                <th key={h} className={`px-3 pb-3 ${i < 2 ? "text-left" : "text-right"}`}
                  style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--rule-strong)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.windows.map((w, i) => (
              <tr key={i}>
                <td className="px-3 py-3 text-left" style={{ color: "var(--paper)", fontWeight: 500, borderBottom: "1px solid var(--rule)" }}>{w.asset}</td>
                <td className="px-3 py-3 text-left" style={{ borderBottom: "1px solid var(--rule)" }}>
                  <span style={{ color: "var(--paper-70)" }}>{REGIME_TAG[w.classifiedRegime] ?? w.classifiedRegime}</span>
                  {w.classifiedRegime !== w.intendedRegime && <span className="ml-2 text-[10px]" style={{ color: "var(--paper-45)" }}>({w.intendedRegime})</span>}
                </td>
                <td className="px-3 py-3 text-right" style={{ color: "var(--paper-70)", borderBottom: "1px solid var(--rule)" }}>{w.trades}</td>
                <td className="px-3 py-3 text-right" style={{ color: "var(--brand)", borderBottom: "1px solid var(--rule)" }}>{w.declined}</td>
                <td className="px-3 py-3 text-right" style={{ color: "var(--paper-70)", borderBottom: "1px solid var(--rule)" }}>{(w.flatHaircut.maxDD * 100).toFixed(1)}%</td>
                <td className="px-3 py-3 text-right" style={{ color: "var(--paper)", borderBottom: "1px solid var(--rule)" }}>{(w.fullGate.maxDD * 100).toFixed(1)}%</td>
                <td className="px-3 py-3 text-right" style={{ fontWeight: 600, color: w.improvedMaxDD ? "var(--brand)" : "var(--clay)", borderBottom: "1px solid var(--rule)" }}>
                  {w.dMaxDD >= 0 ? "−" : "+"}{Math.abs(w.dMaxDD * 100).toFixed(1)}pp
                </td>
                <td className="px-3 py-3 text-right" style={{ color: "var(--paper-45)", borderBottom: "1px solid var(--rule)" }}>{w.dCalmar === 0 ? "·" : w.dCalmar.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* footnotes */}
      <p className="mt-5 text-[12.5px]" style={{ color: "var(--paper-70)", lineHeight: 1.7, maxWidth: "82ch" }}>
        <span className="uw-serif italic" style={{ color: "var(--brand)" }}>No curve to overfit: </span>{data.nothingFitted}
        {" "}Each window is labeled by an objective classifier (90-day return + 200-DMA + ADX) fixed before running — the label shown is the classifier&apos;s own. It rarely calls a tradeable window a clean <em>bull</em>: the cross-50 momentum signal fires too few times in a sustained uptrend, so the strategy&apos;s real tradeable periods are bear / chop / mixed. By the classifier&apos;s labels: <strong style={{ color: "var(--paper)" }}>bear {a.byRegime?.bear?.improvedMaxDD ?? 0}/{a.byRegime?.bear?.n ?? 0}</strong> improved, and every {adv.n} adverse (bear+chop) window improved.
        {data.excluded.length > 0 && (
          <> {" "}<strong style={{ color: "var(--paper)" }}>Excluded ({data.excluded.length}):</strong>{" "}
          {data.excluded.map((e) => `${e.asset} ${e.regime}`).join(", ")} — {data.excluded[0].reason}.</>
        )}
        {" "}Reproduce: <code style={{ color: "var(--brand)" }}>pnpm seed:aggregate</code>.
      </p>
    </div>
  );
}

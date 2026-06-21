"use client";
// [CRITIQUE E-1] DQ-line overlay: the competition's 30% max-drawdown rule drawn as the chart's
// threshold (context). The proof is the equal-exposure comparison below, not crossing this line.
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { AblationResult } from "../../src/types";

// Tearsheet palette — ONE gold hue (full-envelope), gold-55 for the flat haircut,
// muted paper for raw, warm clay for the DQ reference. Recharts strokes are JS props, not CSS.
const C = {
  raw: "rgba(243,235,221,0.28)",
  flatHaircut: "rgba(200,162,74,0.55)",
  fullGate: "#c8a24a",
  grid: "rgba(243,235,221,0.16)",
  muted: "rgba(243,235,221,0.45)",
  paper: "#f3ebdd",
  dq: "#b5654b",
  surface: "#221c17",
};
const FONT = "var(--font-hanken, 'Hanken Grotesk'), sans-serif";

export function AblationChart({ result, startEquity = 10000, variant = "chart" }: { result: AblationResult; startEquity?: number; variant?: "chart" | "ledger" }) {
  const len = Math.max(...Object.values(result.equityCurves).map((c) => c.length));
  const data = Array.from({ length: len }, (_, i) => ({
    t: i, raw: result.equityCurves.raw[i], flatHaircut: result.equityCurves.flatHaircut[i], fullGate: result.equityCurves.fullGate[i],
  }));
  const arm = (name: string) => result.arms.find((a) => a.arm === name)!;
  const dqLine = startEquity * 0.7; // 30% max-drawdown DQ line (competition rule)
  const fg = arm("fullGate"); const fh = arm("flatHaircut");

  if (variant === "ledger") {
    return (
      <div>
        <div className="overflow-x-auto">
          <table className="uw-mono w-full" style={{ fontSize: 15, borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th className="px-3 pb-3 text-left" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, borderBottom: `1px solid var(--rule-strong)` }}>Arm</th>
                {["Return", "Max drawdown", "Calmar", "Win-rate", "Avg exposure"].map((h) => (
                  <th key={h} className="px-3 pb-3 text-right" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, borderBottom: `1px solid var(--rule-strong)` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["raw", "flatHaircut", "fullGate"] as const).map((n) => {
                const a = arm(n); const hero = n === "fullGate";
                const armTag = n === "raw" ? "no envelope" : n === "flatHaircut" ? "size cut only" : "the underwriter";
                return (
                  <tr key={n} style={{ background: hero ? "var(--brand-dim)" : undefined, boxShadow: hero ? "inset 3px 0 0 var(--brand)" : undefined }}>
                    <td className="px-3 py-4 text-left" style={{ fontFamily: "var(--font-fraunces, serif)", fontSize: 16, fontWeight: hero ? 600 : 500, color: hero ? "var(--brand)" : "var(--paper)", borderBottom: `1px solid var(--rule)` }}>
                      {n}
                      <span className="ml-2 text-[9.5px] font-semibold uppercase" style={{ letterSpacing: "0.1em", color: hero ? "var(--brand)" : "var(--paper-45)", fontFamily: FONT }}>{armTag}</span>
                    </td>
                    <td className="px-3 py-4 text-right" style={{ color: hero ? "var(--paper)" : "var(--paper-70)", fontWeight: hero ? 600 : 400, borderBottom: `1px solid var(--rule)` }}>{(a.totalReturn * 100).toFixed(1)}%</td>
                    <td className="px-3 py-4 text-right" style={{ color: hero ? "var(--paper)" : "var(--paper-70)", fontWeight: hero ? 600 : 400, borderBottom: `1px solid var(--rule)` }}>{(a.maxDrawdown * 100).toFixed(1)}%</td>
                    <td className="px-3 py-4 text-right" style={{ color: hero ? "var(--brand)" : "var(--paper-70)", fontWeight: hero ? 700 : 400, fontSize: hero ? 16 : 15, borderBottom: `1px solid var(--rule)` }}>{a.calmar.toFixed(2)}</td>
                    <td className="px-3 py-4 text-right" style={{ color: hero ? "var(--paper)" : "var(--paper-70)", fontWeight: hero ? 600 : 400, borderBottom: `1px solid var(--rule)` }}>{(a.winRate * 100).toFixed(0)}%</td>
                    <td className="px-3 py-4 text-right" style={{ color: hero ? "var(--paper)" : "var(--paper-70)", fontWeight: hero ? 600 : 400, borderBottom: `1px solid var(--rule)` }}>{a.avgExposure.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[13px]" style={{ color: "var(--paper-70)", lineHeight: 1.65, maxWidth: "72ch" }}>
          <span className="uw-serif italic" style={{ color: "var(--brand)" }}>The proof: </span>
          all three arms exit at the <strong style={{ color: "var(--paper)", fontWeight: 600 }}>same CMC-level stops</strong> — only the sizing and selection differ. Flat-haircut and full-gate hold a
          {" "}<strong style={{ color: "var(--paper)", fontWeight: 600 }}>matched average exposure</strong> ({fh.avgExposure.toFixed(2)} vs {fg.avgExposure.toFixed(2)}; haircut {result.haircutConstant.toFixed(2)}),
          yet full-gate holds a {(fg.maxDrawdown * 100).toFixed(1)}% max drawdown vs flat-haircut&apos;s {(fh.maxDrawdown * 100).toFixed(1)}% — a Calmar a trivial size cut cannot reproduce (its Calmar equals raw&apos;s).
          {" "}{result.declined.length} trade(s) <strong style={{ color: "var(--brand)" }}>DECLINED</strong> and excluded — win-rate moves.
        </p>
      </div>
    );
  }

  return (
    <div role="img" aria-label="equity curves: raw bleeds, full envelope holds">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <XAxis dataKey="t" stroke={C.grid} tick={{ fill: C.muted, fontSize: 11, fontFamily: FONT }} tickLine={false} />
          <YAxis domain={["auto", "auto"]} stroke={C.grid} tick={{ fill: C.muted, fontSize: 11, fontFamily: FONT }} tickLine={false} width={56} />
          <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.grid}`, borderRadius: 3, fontFamily: FONT, fontSize: 12, color: C.paper }} labelStyle={{ color: C.muted }} />
          <Legend wrapperStyle={{ fontFamily: FONT, fontSize: 12, color: C.muted }} />
          <ReferenceLine y={dqLine} stroke={C.dq} strokeDasharray="6 4" label={{ value: "30% drawdown — disqualified below", position: "insideBottomRight", fill: C.dq, fontSize: 10 }} />
          <Line type="monotone" dataKey="raw" stroke={C.raw} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="flatHaircut" stroke={C.flatHaircut} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="fullGate" stroke={C.fullGate} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <figcaption className="mt-3 flex gap-2.5 border-t pt-3 text-[12px]" style={{ borderColor: "var(--rule)", color: "var(--paper-70)", lineHeight: 1.6 }}>
        <span className="uw-serif whitespace-nowrap italic" style={{ color: "var(--brand)" }}>Fig. 1 —</span>
        <span>Three arms run the same trades through the same CMC-level stops — only sizing and selection differ. Flat-haircut and full-envelope are held to a matched exposure ({fh.avgExposure.toFixed(2)} vs {fg.avgExposure.toFixed(2)}); raw is the unconstrained baseline. The raw line bleeds; the flat haircut bleeds less, the same way. The full envelope barely moves — it declined the trades that would have hurt.</span>
      </figcaption>
    </div>
  );
}

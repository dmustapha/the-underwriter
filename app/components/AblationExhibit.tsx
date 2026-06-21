"use client";
import { useState, useEffect } from "react";
import { AblationChart } from "./AblationChart";
import { AblationResult } from "../../src/types";

export function AblationExhibit({ variant = "chart" }: { variant?: "chart" | "ledger" }) {
  const [ablation, setAblation] = useState<AblationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function backtest() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/backtest", { method: "POST" });
      if (!res.ok) throw new Error(`backtest failed (HTTP ${res.status})`);
      setAblation((await res.json()) as AblationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "backtest failed — try again");
    } finally {
      setLoading(false);
    }
  }

  // PRD §7.5: the ablation must render immediately on first visit (no empty state).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { backtest(); }, []);

  const empty = variant === "ledger"
    ? <div className="uw-mono grid h-[160px] place-items-center text-sm italic" style={{ color: "var(--paper-45)" }}>{loading ? "tallying the ledger…" : "drawing the exhibit…"}</div>
    : <div className="uw-mono grid h-[300px] place-items-center text-sm italic" style={{ color: "var(--paper-45)" }}>{loading ? "drawing the exhibit…" : "drawing the exhibit…"}</div>;

  return (
    <div>
      {error && (
        <div className="uw-mono mb-4 rounded-[3px] px-4 py-3 text-sm" style={{ background: "rgba(181,101,75,.1)", border: "1px solid rgba(181,101,75,.4)", color: "var(--clay)" }} aria-live="polite">
          {error}
        </div>
      )}
      {ablation ? <AblationChart result={ablation} startEquity={10000} variant={variant} /> : empty}
    </div>
  );
}

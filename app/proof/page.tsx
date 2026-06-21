import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { ProofDocument } from "../components/ProofDocument";

export default function Proof() {
  const p = join(process.cwd(), "submission", "proof.md");
  const content = existsSync(p)
    ? readFileSync(p, "utf8")
    : "Proof artifacts are generated in the build/package phase (x402 tx hashes, PR link, ablation numbers).";

  return (
    <>
      <div className="uw-grid-bg" />
      <div className="uw-glow" />
      <SiteNav />

      <main className="relative z-10 mx-auto max-w-[1000px] px-6 pb-16 md:px-10">
        <section className="pt-12 lg:pt-16">
          <div className="mb-5 flex items-center gap-3.5 text-[11px]" style={{ color: "var(--paper-45)", letterSpacing: "0.06em" }}>
            <span className="uw-eyebrow">Audit trail</span>
            <span className="inline-block h-px w-6" style={{ background: "var(--brand-glow)" }} />
            <span>Verify it yourself</span>
          </div>
          <h1 className="uw-serif m-0 mb-4 font-medium" style={{ fontSize: "clamp(30px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: "var(--paper)" }}>
            The receipts, <em style={{ fontStyle: "italic", color: "var(--brand)", fontWeight: 500 }}>on-chain</em>.
          </h1>
          <p className="m-0 mb-2 text-[16px]" style={{ lineHeight: 1.6, color: "var(--paper-70)", maxWidth: "58ch" }}>
            Nothing here is a screenshot. Every x402 payment resolves to a real Base transaction, and every backtest figure reproduces from the committed record. Open a hash and check it.
          </p>
        </section>

        {/* ── ON-CHAIN RECORD ── */}
        <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
          <div className="uw-sec-head mb-7">
            <span className="uw-sec-num">§</span>
            <h2 className="uw-sec-h2">On-chain record</h2>
            <span className="uw-sec-fill" />
            <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>Base mainnet</span>
          </div>
          <ProofDocument content={content} />
        </section>

        <p className="mt-2 text-[12px]" style={{ color: "var(--paper-45)", letterSpacing: "0.04em" }}>
          The Underwriter <span className="uw-serif italic" style={{ color: "var(--brand)" }}>·</span> Research Note №&nbsp;001 — every figure above reproduces from the on-chain record. The equal-exposure ledger lives on the <a className="uw-link" href="/">front page</a>.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}

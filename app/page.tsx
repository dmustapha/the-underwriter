import Link from "next/link";
import { SiteNav } from "./components/SiteNav";
import { SiteFooter } from "./components/SiteFooter";
import { AblationExhibit } from "./components/AblationExhibit";

const STEPS = [
  { n: "01", title: "Resolve the token", body: "Look up the symbol on CoinMarketCap and pull a live entry price — the number every other figure is measured against." },
  { n: "02", title: "Read the levels", body: "Take the stop from the nearest support and the target from the nearest resistance or Fibonacci line. Levels are read, never invented." },
  { n: "03", title: "Read the regime", body: "Weigh Fear & Greed, dominance, and leverage. A frothy market shrinks the size; an ambiguous one buys one more expensive signal — and only one." },
  { n: "04", title: "Return the envelope", body: "Reward against risk, a size that respects your loss budget, and a verdict: approve, size down, or decline the trade outright." },
];

export default function Home() {
  return (
    <>
      <div className="uw-grid-bg" />
      <div className="uw-glow" />
      <SiteNav />

      <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-16 md:px-10">
        {/* ── HERO: lede + Exhibit 1 ── */}
        <section className="grid grid-cols-1 items-start gap-10 pt-12 pb-8 lg:grid-cols-[0.92fr_1.18fr] lg:gap-14 lg:pt-16">
          <div>
            <div className="mb-5 flex items-center gap-3.5 text-[11px]" style={{ color: "var(--paper-45)", letterSpacing: "0.06em" }}>
              <span className="uw-eyebrow">Research Note №&nbsp;001</span>
              <span className="inline-block h-px w-6" style={{ background: "var(--brand-glow)" }} />
              <span>For trading agents · CMC Skill</span>
            </div>
            <h1 className="uw-serif m-0 mb-5 font-medium" style={{ fontSize: "clamp(36px,4.4vw,56px)", lineHeight: 1.03, letterSpacing: "-0.015em", color: "var(--paper)" }}>
              The trade gets <em style={{ fontStyle: "italic", color: "var(--brand)", fontWeight: 500 }}>underwritten</em> before it gets taken.
            </h1>
            <p className="m-0 mb-7 text-[17px]" style={{ lineHeight: 1.65, color: "var(--paper-70)", maxWidth: "38ch" }}>
              A signal tells you what to trade. The Underwriter tells you <strong style={{ color: "var(--paper)", fontWeight: 600 }}>whether to take it and how big</strong> — with a stop at the nearest support, a target at the nearest resistance, the reward measured against the risk, and a size that respects your loss budget. Every number is drawn from live market data, and we prove the edge with a backtest you can read like an exhibit.
            </p>
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <Link href="/desk" className="uw-btn uw-btn-primary">Open the desk</Link>
              <Link href="/proof" className="uw-btn uw-btn-ghost">See the proof</Link>
              <Link href="/fork" className="uw-btn uw-btn-ghost">Fork the skill</Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-[12px]" style={{ color: "var(--paper-45)" }}>
              <span className="uw-chip"><b style={{ color: "var(--brand)", fontWeight: 600 }}>x402</b>&nbsp;live data · USDC on Base</span>
              <span className="uw-chip">Forkable CMC Agent Skill</span>
            </div>
          </div>

          {/* Exhibit 1 — the signature proof teaser */}
          <figure className="uw-tile uw-tile-hero m-0 px-7 pb-5 pt-6">
            <div className="mb-1 flex items-start justify-between gap-4">
              <div>
                <div className="uw-serif text-[13px] font-medium italic" style={{ color: "var(--brand)", letterSpacing: "0.02em" }}>Exhibit 1</div>
                <h2 className="uw-h1 mt-0.5">Equal-exposure Calmar proof</h2>
              </div>
              <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] uppercase" style={{ letterSpacing: "0.16em", color: "var(--paper-45)", border: "1px solid var(--rule)" }}>2022 BNB bear</span>
            </div>
            <p className="mb-2 text-[13px]" style={{ color: "var(--paper-70)" }}>Three arms, the same average exposure. The raw line bleeds; the envelope barely moves.</p>
            <AblationExhibit variant="chart" />
            <Link href="/proof" className="uw-link mt-4 inline-flex text-[12.5px] font-semibold" style={{ letterSpacing: "0.03em" }}>Verify every figure on-chain ↗</Link>
          </figure>
        </section>

        {/* ── § I. THE LEDGER ── */}
        <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
          <div className="uw-sec-head mb-7">
            <span className="uw-sec-num">§ I</span>
            <h2 className="uw-sec-h2">The ledger behind the curve</h2>
            <span className="uw-sec-fill" />
            <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>Per-arm performance</span>
          </div>
          <div className="uw-tile p-5">
            <AblationExhibit variant="ledger" />
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
          <div className="uw-sec-head mb-7">
            <span className="uw-sec-num">§ II</span>
            <h2 className="uw-sec-h2">How it works</h2>
            <span className="uw-sec-fill" />
            <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>Four steps</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="uw-tile p-6" style={{ background: "var(--ink-1)" }}>
                <div className="uw-serif text-[15px] font-medium italic" style={{ color: "var(--brand)" }}>{s.n}</div>
                <h3 className="uw-serif mt-2 mb-2.5 text-[18px] font-semibold" style={{ color: "var(--paper)", letterSpacing: "-0.01em" }}>{s.title}</h3>
                <p className="m-0 text-[13.5px]" style={{ color: "var(--paper-70)", lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── WHY IT HOLDS ── */}
        <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
          <div className="uw-sec-head mb-7">
            <span className="uw-sec-num">§ III</span>
            <h2 className="uw-sec-h2">Built to be forked</h2>
            <span className="uw-sec-fill" />
            <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>What you get</span>
          </div>
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
            <div>
              <h3 className="uw-serif m-0 mb-3 text-[20px] font-semibold leading-tight" style={{ letterSpacing: "-0.01em" }}>
                Real data, <em style={{ fontStyle: "italic", color: "var(--brand)" }}>paid for once</em>
              </h3>
              <p className="m-0 text-[14px]" style={{ color: "var(--paper-70)", lineHeight: 1.65 }}>
                Every envelope is priced from a live CoinMarketCap pull, settled in USDC over x402 on Base. We meter the value of one quote and skip the three a naive agent would have bought.
              </p>
            </div>
            <div>
              <h3 className="uw-serif m-0 mb-3 text-[20px] font-semibold leading-tight" style={{ letterSpacing: "-0.01em" }}>
                A verdict, <em style={{ fontStyle: "italic", color: "var(--brand)" }}>not a guess</em>
              </h3>
              <p className="m-0 text-[14px]" style={{ color: "var(--paper-70)", lineHeight: 1.65 }}>
                A trade that fails the reward-to-risk bar is declined and excluded — never quietly shrunk. The drawdown governor makes sure a single stop-out can&apos;t breach your limit.
              </p>
            </div>
            <div>
              <h3 className="uw-serif m-0 mb-3 text-[20px] font-semibold leading-tight" style={{ letterSpacing: "-0.01em" }}>
                Yours in <em style={{ fontStyle: "italic", color: "var(--brand)" }}>one file</em>
              </h3>
              <p className="m-0 text-[14px]" style={{ color: "var(--paper-70)", lineHeight: 1.65 }}>
                The whole skill is a single forkable <span className="uw-mono">SKILL.md</span> in the CoinMarketCap Agent Skills format. Register the MCP server, drop it in, and your agent underwrites every trade it considers.
              </p>
            </div>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/desk" className="uw-btn uw-btn-primary">Open the desk</Link>
            <Link href="/fork" className="uw-btn uw-btn-ghost">Fork the skill</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SiteNav } from "../components/SiteNav";
import { SiteFooter } from "../components/SiteFooter";
import { CopyTile } from "../components/CopyTile";

// Pull the core principle + the MCP-registration JSON straight from the source
// SKILL.md so /fork can never drift from the artifact that actually ships.
function readSkill() {
  const p = join(process.cwd(), "skill", "the-underwriter", "SKILL.md");
  const md = existsSync(p) ? readFileSync(p, "utf8") : "";

  const principle = (() => {
    const m = md.match(/##\s*Core Principle\s*\n+([\s\S]*?)(?:\n##\s)/);
    return m ? m[1].trim() : "A signal tells you WHAT to trade. The Underwriter tells you WHETHER to take it and HOW BIG.";
  })();

  const mcpJson = (() => {
    const fences = [...md.matchAll(/```json\s*([\s\S]*?)```/g)];
    const block = fences.find((f) => f[1].includes("mcpServers"));
    return block ? block[1].trim() : '{ "mcpServers": { "cmc-mcp": { "url": "https://mcp.coinmarketcap.com/mcp", "headers": { "X-CMC-MCP-API-KEY": "your-api-key" } } } }';
  })();

  const tools = (() => {
    const m = md.match(/allowed-tools:\s*\n((?:\s*-\s*mcp__[^\n]+\n?)+)/);
    if (!m) return [] as string[];
    return [...m[1].matchAll(/mcp__cmc-mcp__[a-z_]+/g)].map((x) => x[0]);
  })();

  return { principle, mcpJson, tools };
}

const STEPS = [
  { n: "01", title: "Copy the skill in", body: "The Underwriter is one self-contained file. Drop skill/the-underwriter/SKILL.md into your agent's skills directory — install with cp -r, not a package manager.", code: "cp -r the-underwriter/skill/the-underwriter ~/.your-agent/skills/" },
  { n: "02", title: "Register the data server", body: "Add the CoinMarketCap MCP server so the skill can read live quotes and technical levels. Paste your CMC API key, or run keyless against the x402 surface with a funded Base USDC wallet." },
  { n: "03", title: "Invoke it", body: "Trigger it the moment your agent has a trade idea — \"underwrite this trade\", \"how big should this position be\", or /the-underwriter. It returns a full risk envelope before a single dollar is committed." },
];

const GAINS = [
  { title: "A sizing brain, free", body: "Your agent stops guessing position size. Every idea gets a fixed-fractional size bounded by a drawdown governor, so one bad stop-out can never breach your limit." },
  { title: "Stops it didn't invent", body: "Stops and targets are read from CoinMarketCap support, resistance, and Fibonacci levels — never hallucinated. A trade below the reward-to-risk bar is declined, not quietly shrunk." },
  { title: "Metered data spend", body: "Cheap signals first; the expensive derivatives pull is bought only when the regime is ambiguous. Value-of-information metering keeps the data bill honest." },
];

export default function ForkPage() {
  const { principle, mcpJson, tools } = readSkill();

  return (
    <>
      <div className="uw-grid-bg" />
      <div className="uw-glow" />
      <SiteNav />

      <main className="relative z-10 mx-auto max-w-[1000px] px-6 pb-16 md:px-10">
        <section className="pt-12 lg:pt-16">
          <div className="mb-5 flex items-center gap-3.5 text-[11px]" style={{ color: "var(--paper-45)", letterSpacing: "0.06em" }}>
            <span className="uw-eyebrow">Fork the skill</span>
            <span className="inline-block h-px w-6" style={{ background: "var(--brand-glow)" }} />
            <span>CMC Agent Skill · MIT</span>
          </div>
          <h1 className="uw-serif m-0 mb-4 font-medium" style={{ fontSize: "clamp(30px,3.6vw,44px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: "var(--paper)" }}>
            One file. Every trade <em style={{ fontStyle: "italic", color: "var(--brand)", fontWeight: 500 }}>underwritten</em>.
          </h1>
          <p className="m-0 mb-2 text-[16px]" style={{ lineHeight: 1.65, color: "var(--paper-70)", maxWidth: "56ch" }}>
            The Underwriter has no UI of its own — it&apos;s a forkable CoinMarketCap Agent Skill that any trading agent can consume. Drop it in, register the data server, and your agent risk-checks every position before it acts.
          </p>
        </section>

        {/* ── CORE PRINCIPLE ── */}
        <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
          <div className="uw-sec-head mb-7">
            <span className="uw-sec-num">§ I</span>
            <h2 className="uw-sec-h2">The principle</h2>
            <span className="uw-sec-fill" />
          </div>
          <blockquote className="uw-tile px-7 py-7 text-[18px]" style={{ background: "var(--ink-1)", borderLeft: "2px solid var(--brand)", color: "var(--paper)", lineHeight: 1.55, fontFamily: "var(--font-display)" }}>
            {principle}
          </blockquote>
        </section>

        {/* ── INSTALL ── */}
        <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
          <div className="uw-sec-head mb-7">
            <span className="uw-sec-num">§ II</span>
            <h2 className="uw-sec-h2">Install it</h2>
            <span className="uw-sec-fill" />
            <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>Three steps</span>
          </div>

          <div className="flex flex-col gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className="uw-tile p-6 md:p-7" style={{ background: "var(--ink-1)" }}>
                <div className="flex items-baseline gap-4">
                  <span className="uw-serif text-[18px] font-medium italic" style={{ color: "var(--brand)" }}>{s.n}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="uw-serif m-0 mb-2 text-[19px] font-semibold" style={{ color: "var(--paper)", letterSpacing: "-0.01em" }}>{s.title}</h3>
                    <p className="m-0 text-[14px]" style={{ color: "var(--paper-70)", lineHeight: 1.65, maxWidth: "62ch" }}>{s.body}</p>
                    {s.code && (
                      <pre className="uw-mono mt-4 overflow-x-auto rounded-[3px] px-4 py-3 text-[12.5px]" style={{ background: "var(--ink-0)", border: "1px solid var(--rule)", color: "var(--paper-70)", margin: "16px 0 0" }}>
                        {s.code}
                      </pre>
                    )}
                    {s.n === "02" && (
                      <div className="mt-4">
                        <CopyTile label="Register the CoinMarketCap MCP server" code={mcpJson} />
                        <p className="m-0 mt-3 text-[12.5px]" style={{ color: "var(--paper-45)", lineHeight: 1.6 }}>
                          Get an API key from <a className="uw-link" href="https://pro.coinmarketcap.com/login" target="_blank" rel="noreferrer">pro.coinmarketcap.com ↗</a>. For keyless pay-per-call data, the skill falls back to the CMC x402 surface with a funded Base USDC wallet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CMC AGENT HUB TOOLS ── */}
        {tools.length > 0 && (
          <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
            <div className="uw-sec-head mb-7">
              <span className="uw-sec-num">§ III</span>
              <h2 className="uw-sec-h2">The CMC Agent Hub tools it calls</h2>
              <span className="uw-sec-fill" />
              <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>{tools.length} tools</span>
            </div>
            <p className="m-0 mb-5 text-[14px]" style={{ color: "var(--paper-70)", lineHeight: 1.65, maxWidth: "62ch" }}>
              Every level, regime read, and quote comes from the CoinMarketCap MCP server — the skill declares exactly these tools in its frontmatter, nothing hidden.
            </p>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {tools.map((t) => (
                <li key={t} className="uw-tile flex items-center gap-3 px-4 py-3" style={{ background: "var(--ink-1)" }}>
                  <span aria-hidden="true" className="uw-dot" style={{ flex: "none" }} />
                  <code className="uw-mono min-w-0 break-all text-[12.5px]" style={{ color: "var(--brand)" }}>{t}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── WHAT A FORK GETS YOU ── */}
        <section className="border-t py-12" style={{ borderColor: "var(--rule)" }}>
          <div className="uw-sec-head mb-7">
            <span className="uw-sec-num">§ IV</span>
            <h2 className="uw-sec-h2">What a fork gets you</h2>
            <span className="uw-sec-fill" />
            <span className="uw-eyebrow hidden sm:inline" style={{ color: "var(--paper-45)" }}>Out of the box</span>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {GAINS.map((g) => (
              <div key={g.title} className="uw-tile p-6" style={{ background: "var(--ink-1)" }}>
                <h3 className="uw-serif m-0 mb-2.5 text-[18px] font-semibold" style={{ color: "var(--paper)", letterSpacing: "-0.01em" }}>{g.title}</h3>
                <p className="m-0 text-[13.5px]" style={{ color: "var(--paper-70)", lineHeight: 1.6 }}>{g.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-7 text-[13px]" style={{ color: "var(--paper-45)", lineHeight: 1.65, maxWidth: "64ch" }}>
            The skill provides risk discipline, not financial advice. Backtest your own trade log through the engine before trusting it live — the same equal-exposure ablation you can read on the <a className="uw-link" href="/proof">proof page</a>.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

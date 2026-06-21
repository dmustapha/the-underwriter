// Fix 3 probe (do FIRST, closes DEV-003). Talks to the CoinMarketCap MCP server, lists tools, reads
// the technical-analysis tool's REAL input schema, calls it for one token, and dumps the raw result so
// we can pin the (undocumented, beta) field names BEFORE wiring it into the live underwrite path.
//   pnpm probe:mcp
const MCP_URL = "https://mcp.coinmarketcap.com/mcp";
const KEY = process.env.CMC_MCP_API_KEY || "";

let sessionId = "";
async function rpc(body: unknown, isNotification = false): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "X-CMC-MCP-API-KEY": KEY,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const res = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(body) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  if (isNotification) return { status: res.status };
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (ct.includes("text/event-stream")) {
    // parse the last `data:` line of the SSE frame
    const lines = text.split("\n").filter((l) => l.startsWith("data:"));
    const last = lines[lines.length - 1]?.slice(5).trim();
    return last ? JSON.parse(last) : { raw: text };
  }
  try { return JSON.parse(text); } catch { return { status: res.status, raw: text.slice(0, 400) }; }
}

async function main(): Promise<void> {
  if (!KEY) { console.error("CMC_MCP_API_KEY missing"); process.exit(1); }
  console.log("1) initialize");
  const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "the-underwriter-probe", version: "1.0.0" } } });
  console.log("   session:", sessionId || "(none)", "· protocol:", (init as any)?.result?.protocolVersion);
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, true);

  console.log("2) tools/list");
  const tools = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const list: any[] = (tools as any)?.result?.tools ?? [];
  const names = list.map((t) => t.name);
  console.log("   tools:", names.join(", ") || "(none)");
  const ta = list.find((t) => /technical|analysis|indicator/i.test(t.name));
  if (!ta) { console.error("   NO technical-analysis tool found — Fix 3 not feasible with this account/tier."); process.exit(2); }
  console.log("   TA tool:", ta.name);
  console.log("   inputSchema:", JSON.stringify(ta.inputSchema, null, 2));

  console.log(`3) tools/call ${ta.name} (BNB)`);
  // try a few common argument shapes; the schema above tells us which is real
  const args = ta.inputSchema?.properties?.symbol ? { symbol: "BNB" }
    : ta.inputSchema?.properties?.slug ? { slug: "bnb" }
    : ta.inputSchema?.properties?.id ? { id: 1839 } : { symbol: "BNB" };
  const t0 = Date.now();
  const call = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: ta.name, arguments: args } });
  console.log(`   latency: ${Date.now() - t0}ms`);
  const content = (call as any)?.result?.content ?? call;
  const raw = JSON.stringify(content);
  console.log("   raw result (first 1600 chars):\n", raw.slice(0, 1600));
  // surface anything that looks like a level / indicator field
  const hits = (raw.match(/"(support|resistance|pivot|fib\w*|rsi|macd|sma|ema|level)\w*"/gi) || []);
  console.log("   level/indicator field names seen:", Array.from(new Set(hits)).join(", ") || "(none — inspect raw above)");
}
main().catch((e) => { console.error("PROBE_FAILED:", e?.message || e); process.exit(1); });

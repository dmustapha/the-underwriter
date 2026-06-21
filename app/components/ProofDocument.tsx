import { Fragment, type ReactNode } from "react";

// Lightweight, dependency-free markdown renderer for submission/proof.md.
// Scope is deliberately narrow: headings, tables, bullet lists, blockquotes,
// horizontal rules, and inline links/bold/code — enough to render the proof
// document as styled tiles instead of a raw <pre> dump, with every tx hash
// preserved as a clickable BaseScan link.

type Block =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "code"; text: string }
  | { kind: "hr" };

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // [FIX #10a] fenced code block — gather verbatim lines until the closing ```
    if (/^```/.test(trimmed)) {
      i++; // skip opening fence
      const buf: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++; // skip closing fence
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }

    if (/^---+$/.test(trimmed)) { blocks.push({ kind: "hr" }); i++; continue; }

    if (trimmed.startsWith("### ")) { blocks.push({ kind: "h3", text: trimmed.slice(4) }); i++; continue; }
    if (trimmed.startsWith("## ")) { blocks.push({ kind: "h2", text: trimmed.slice(3) }); i++; continue; }
    if (trimmed.startsWith("# ")) { blocks.push({ kind: "h1", text: trimmed.slice(2) }); i++; continue; }

    if (trimmed.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = cells(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // paragraph — gather until blank line or a block starter
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i].trim()) &&
      !/^>/.test(lines[i].trim()) &&
      !/^[-*]\s/.test(lines[i].trim()) &&
      !/^---+$/.test(lines[i].trim()) &&
      !isTableRow(lines[i])
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "p", text: buf.join(" ") });
  }

  return blocks;
}

// inline: links, bold, code spans, emoji-checks. Returns React nodes.
function inline(text: string, keyBase: string): ReactNode {
  // tokenize on the three inline forms we support
  const re = /(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(`[^`]+`)|(https?:\/\/[^\s)]+)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={`${keyBase}-t${k++}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];

    if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!;
      out.push(<Anchor key={`${keyBase}-l${k++}`} href={lm[2]} label={lm[1]} />);
    } else if (tok.startsWith("**")) {
      out.push(<strong key={`${keyBase}-b${k++}`} style={{ color: "var(--paper)", fontWeight: 600 }}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(
        <code key={`${keyBase}-c${k++}`} className="uw-mono" style={{ color: "var(--brand)", background: "var(--brand-dim)", padding: "1px 6px", borderRadius: 3, fontSize: "0.92em" }}>
          {tok.slice(1, -1)}
        </code>
      );
    } else {
      out.push(<Anchor key={`${keyBase}-u${k++}`} href={tok} label={shortUrl(tok)} />);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={`${keyBase}-t${k++}`}>{text.slice(last)}</Fragment>);
  return out;
}

function shortUrl(url: string): string {
  if (/basescan\.org\/tx\/(0x[0-9a-fA-F]+)/.test(url)) {
    const h = url.match(/0x[0-9a-fA-F]+/)![0];
    return `BaseScan ${h.slice(0, 10)}…${h.slice(-6)} ↗`;
  }
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "") + " ↗";
}

// [FIX #10b] only allow http(s):, mailto:, or relative hrefs — drop javascript: etc.
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\//i.test(h) || /^mailto:/i.test(h)) return h;
  // relative links: no scheme (no "scheme:" prefix), no protocol-relative "//"
  if (!/^[a-z][a-z0-9+.-]*:/i.test(h) && !h.startsWith("//")) return h;
  return null;
}

function Anchor({ href, label }: { href: string; label: string }) {
  const safe = safeHref(href);
  // a blocked scheme renders as inert text rather than a clickable link
  if (!safe) return <span style={{ color: "var(--paper-70)" }}>{label}</span>;
  return <a className="uw-link" href={safe} target="_blank" rel="noreferrer">{label}</a>;
}

export function ProofDocument({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="uw-tile px-6 py-7 md:px-9 md:py-9" style={{ background: "var(--ink-1)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
      <div className="flex min-w-0 flex-col gap-px">
        {blocks.map((b, idx) => {
          const key = `b${idx}`;
          switch (b.kind) {
            case "h1":
              return <h2 key={key} className="uw-serif mb-3 mt-1 text-[26px] font-semibold" style={{ color: "var(--paper)", letterSpacing: "-0.015em" }}>{inline(b.text, key)}</h2>;
            case "h2":
              return (
                <h3 key={key} className="uw-serif mb-2.5 mt-8 border-b pb-2.5 text-[20px] font-semibold" style={{ color: "var(--paper)", borderColor: "var(--rule)", letterSpacing: "-0.01em" }}>
                  {inline(b.text, key)}
                </h3>
              );
            case "h3":
              return <h4 key={key} className="uw-label mb-2 mt-6" style={{ fontSize: "11px", color: "var(--brand)" }}>{inline(b.text, key)}</h4>;
            case "code":
              return (
                <pre key={key} className="uw-mono my-5 overflow-x-auto rounded-[3px] px-4 py-3.5 text-[12.5px]" style={{ background: "var(--ink-0)", border: "1px solid var(--rule)", color: "var(--paper-70)", lineHeight: 1.6 }}>
                  <code>{b.text}</code>
                </pre>
              );
            case "hr":
              return <hr key={key} className="my-7 border-0" style={{ height: 1, background: "var(--rule)" }} />;
            case "quote":
              return (
                <blockquote key={key} className="my-4 rounded-r-[3px] px-5 py-4 text-[14px] italic" style={{ background: "var(--brand-dim)", borderLeft: "2px solid var(--brand)", color: "var(--paper-70)", lineHeight: 1.65 }}>
                  {inline(b.text, key)}
                </blockquote>
              );
            case "ul":
              return (
                <ul key={key} className="my-3 flex flex-col gap-2.5">
                  {b.items.map((it, j) => (
                    <li key={`${key}-${j}`} className="flex gap-3 text-[14px]" style={{ color: "var(--paper-70)", lineHeight: 1.6 }}>
                      <span aria-hidden="true" style={{ color: "var(--brand)", flex: "none" }}>—</span>
                      <span>{inline(it, `${key}-${j}`)}</span>
                    </li>
                  ))}
                </ul>
              );
            case "table":
              return (
                <div key={key} className="my-5 min-w-0 overflow-x-auto">
                  <table className="uw-mono w-full" style={{ fontSize: 13.5, borderCollapse: "collapse", minWidth: 520 }}>
                    <thead>
                      <tr>
                        {b.header.map((h, j) => (
                          <th key={j} className="px-3 pb-2.5 text-left" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--paper-45)", borderBottom: "1px solid var(--rule-strong)" }}>
                            {inline(h, `${key}-h${j}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, c) => (
                            <td key={c} className="px-3 py-3 text-left align-top" style={{ color: "var(--paper-70)", borderBottom: "1px solid var(--rule)" }}>
                              {inline(cell, `${key}-r${r}c${c}`)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            case "p":
            default:
              return (
                <p key={key} className="my-2.5 text-[14px]" style={{ color: "var(--paper-70)", lineHeight: 1.7 }}>
                  {inline(b.text, key)}
                </p>
              );
          }
        })}
      </div>
    </div>
  );
}

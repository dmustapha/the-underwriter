// ProofDocument renderer hardening (FIX #10): fenced code blocks must parse to a code block (not leak
// raw as paragraphs), and unsafe link schemes must be rejected by safeHref. Pure-function tests.
import { describe, it, expect } from "vitest";
import { parseBlocks, safeHref } from "../app/components/ProofDocument";

describe("ProofDocument.parseBlocks — fenced code", () => {
  it("captures a ``` fence as a code block, not raw paragraph text", () => {
    const blocks = parseBlocks("Intro.\n\n```\nconst x = 1;\nconst y = 2;\n```\n\nAfter.");
    const code = blocks.find((b) => b.kind === "code") as { kind: "code"; text: string } | undefined;
    expect(code).toBeTruthy();
    expect(code!.text).toContain("const x = 1;");
    expect(code!.text).toContain("const y = 2;");
    // no paragraph should contain the raw fence markers
    expect(blocks.some((b) => b.kind === "p" && (b as { text: string }).text.includes("```"))).toBe(false);
  });
});

describe("ProofDocument.safeHref — link scheme allowlist", () => {
  it("blocks javascript:", () => expect(safeHref("javascript:alert(1)")).toBeNull());
  it("blocks javascript: with leading space/case", () => expect(safeHref("  JavaScript:alert(1)")).toBeNull());
  it("blocks data:", () => expect(safeHref("data:text/html,<script>1</script>")).toBeNull());
  it("blocks protocol-relative //", () => expect(safeHref("//evil.example/x")).toBeNull());
  it("allows https", () => expect(safeHref("https://basescan.org/tx/0xabc")).toBe("https://basescan.org/tx/0xabc"));
  it("allows http", () => expect(safeHref("http://example.com")).toBe("http://example.com"));
  it("allows mailto", () => expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com"));
  it("allows relative", () => expect(safeHref("/proof")).toBe("/proof"));
});

import { describe, it, expect } from "vitest";
import { escapeHtml, escapeHref } from "@/lib/html-escape";

/**
 * These helpers guard every `document.write` print document (reports, invoices,
 * lab/radiology reports, discharge summaries, OPD slips, patient ID cards) and
 * the public prescription-QR verification page. A regression here is stored
 * XSS.
 */
describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes ampersands before angle brackets to avoid double-encoding", () => {
    // Naive ordering (& last) would turn &lt; into &amp;lt;.
    expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
  });

  it("neutralises a script injection attempt", () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("neutralises an attribute break-out attempt", () => {
    expect(escapeHtml('" onerror="alert(1)')).toBe("&quot; onerror=&quot;alert(1)");
  });

  it("returns an empty string for null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("stringifies non-string input", () => {
    expect(escapeHtml(0)).toBe("0");
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(false)).toBe("false");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeHtml("Zara Ali")).toBe("Zara Ali");
    expect(escapeHtml("PT-0001")).toBe("PT-0001");
  });
});

describe("escapeHref", () => {
  it("allows ordinary URLs", () => {
    expect(escapeHref("https://example.com/a?b=1&c=2")).toBe(
      "https://example.com/a?b=1&amp;c=2"
    );
  });

  it("blocks javascript: URIs regardless of case or padding", () => {
    expect(escapeHref("javascript:alert(1)")).toBe("#");
    expect(escapeHref("JavaScript:alert(1)")).toBe("#");
    expect(escapeHref("   javascript:alert(1)")).toBe("#");
  });

  it("blocks data: URIs", () => {
    expect(escapeHref("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("returns # for null and undefined", () => {
    expect(escapeHref(null)).toBe("#");
    expect(escapeHref(undefined)).toBe("#");
  });

  it("still escapes quotes so an href cannot break out of its attribute", () => {
    expect(escapeHref('/a" onmouseover="x')).toBe("/a&quot; onmouseover=&quot;x");
  });
});
import { describe, test, expect } from "bun:test";
import flattenCss from "../src/fez/utils/flatten_css.js";

// normalise whitespace so tests read against intent, not formatting
const flat = (css) => flattenCss(css).replace(/\s+/g, " ").trim();

describe("flattenCss", () => {
  test("leaves flat CSS alone", () => {
    expect(flat(".a { color: red; }")).toBe(".a{color: red;}");
  });

  test("nests descendants without &", () => {
    expect(flat(".a { .b { color: red; } }")).toBe(".a .b{color: red;}");
  });

  test("substitutes & for the parent", () => {
    expect(flat(".a { &:hover { color: red; } }")).toBe(".a:hover{color: red;}");
  });

  test("expands comma parents cartesian, not with :is()", () => {
    const out = flat(".a, .b { &:hover { color: red; } }");
    expect(out).toBe(".a:hover,.b:hover{color: red;}");
    expect(out).not.toContain(":is(");
  });

  test("expands comma children against comma parents", () => {
    expect(flat(".a, .b { .c, .d { color: red; } }")).toBe(
      ".a .c,.b .c,.a .d,.b .d{color: red;}",
    );
  });

  test("keeps declarations that follow a nested rule", () => {
    // the case native nesting needs CSSNestedDeclarations for
    const out = flat(".a { color: red; .b { color: blue; } background: pink; }");
    expect(out).toContain("color: red");
    expect(out).toContain("background: pink");
    expect(out).toContain(".a .b{color: blue;}");
  });

  test("hoists a nested @media outward around the resolved selector", () => {
    expect(flat(".a { @media (max-width: 5px) { color: red; } }")).toBe(
      "@media (max-width: 5px){.a{color: red;}}",
    );
  });

  test("keeps @keyframes at the top level with its body intact", () => {
    const out = flat(":fez { @keyframes spin { from { opacity: 0; } to { opacity: 1; } } }");
    expect(out).toContain("@keyframes spin{");
    expect(out).toContain("from{opacity: 0;}");
    expect(out).toContain("to{opacity: 1;}");
    // must not be wrapped in the component scope
    expect(out).not.toMatch(/:fez[^{]*\{[^@]*@keyframes/);
  });

  test("handles a single-line @keyframes", () => {
    const out = flat(":fez { @keyframes spin { to { opacity: 1; } } }");
    expect(out).toContain("@keyframes spin{to{opacity: 1;}}");
  });

  test("keeps @keyframes inside @media but out of the selector", () => {
    const out = flat(":fez { @media (max-width: 5px) { @keyframes k { to { opacity: 1; } } } }");
    expect(out).toContain("@media (max-width: 5px){@keyframes k{");
    expect(out).not.toContain(":fez");
  });

  test(":global() escapes the scope", () => {
    expect(flat(":fez { :global(.widget) { color: red; } }")).toBe(
      ".widget{color: red;}",
    );
  });

  test("scopes everything else under the wrapper", () => {
    expect(flat(":fez { .card { color: red; } }")).toBe(":fez .card{color: red;}");
  });

  test("does not trip on braces inside strings", () => {
    const out = flat(`.a { content: "}"; color: red; }`);
    expect(out).toContain('content: "}"');
    expect(out).toContain("color: red");
  });

  test("does not trip on parens holding commas or braces", () => {
    const out = flat(".a { background: url(a{b}); grid: repeat(2, 1fr); }");
    expect(out).toContain("url(a{b})");
    expect(out).toContain("repeat(2, 1fr)");
  });

  test("keeps :is() selector lists as one part", () => {
    expect(flat(":is(.a, .b) { color: red; }")).toBe(":is(.a, .b){color: red;}");
  });

  test("strips comments", () => {
    expect(flat(".a { /* note */ color: red; }")).toBe(".a{color: red;}");
  });

  test("emits @import before other rules", () => {
    const out = flat("@import url(x.css); .a { color: red; }");
    expect(out.indexOf("@import")).toBeLessThan(out.indexOf(".a{"));
  });

  test("survives deep nesting", () => {
    expect(flat(".a { .b { .c { &:hover { color: red; } } } }")).toBe(
      ".a .b .c:hover{color: red;}",
    );
  });

  test("returns empty for empty input", () => {
    expect(flattenCss("")).toBe("");
    expect(flattenCss(null)).toBe("");
  });
});

import { describe, test, expect } from "bun:test";

const getFez = () => globalThis.window.Fez;

// Return just the CSS this call added to the shared stylesheet.
const rewrite = (css, opts) => {
  const Fez = getFez();
  const before = Fez.extractCss().length;
  Fez.globalCss(css, opts);
  return Fez.extractCss().slice(before);
};

describe("Fez.globalCss", () => {
  test("rewrites :fez to the component root selector", () => {
    const out = rewrite(":fez { color: red; }", { name: "ui-btn" });
    expect(out).toContain(".fez.fez-ui-btn");
    expect(out).not.toContain(":fez");
  });

  test("rewrites every :fez occurrence, not just the first", () => {
    const out = rewrite(":fez { color: red; }\n:fez button { color: blue; }", {
      name: "ui-btn",
    });
    expect(out).not.toContain(":fez");
    expect((out.match(/\.fez\.fez-ui-btn/g) || []).length).toBe(2);
  });

  test("leaves a global sheet unscoped when no name is given", () => {
    const out = rewrite(".app-card { border: 1px solid #ddd; }");
    expect(out).toContain(".app-card");
    expect(out).not.toContain(".fez.fez-");
  });

  test("expands style macros at inject time", () => {
    const out = rewrite(":mobile { .card { display: none; } }", {
      name: "ui-btn",
    });
    expect(out).toContain("@media (max-width: 767px)");
    expect(out).not.toContain(":mobile");
  });

  test("wraps in :fez when opts.wrap is set", () => {
    const out = rewrite("outline: 1px dotted;", { name: "ui-btn", wrap: true });
    expect(out).toContain(".fez.fez-ui-btn {");
    expect(out).toContain("outline: 1px dotted;");
  });

  test("injects identical CSS only once", () => {
    const css = ".dedupe-probe { color: hotpink; }";
    expect(rewrite(css)).toContain(".dedupe-probe");
    expect(rewrite(css)).toBe("");
  });
});

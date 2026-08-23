import { describe, test, expect, afterEach } from "bun:test";
import cssMixin from "../src/fez/utils/css_mixin.js";
import flattenCss from "../src/fez/utils/flatten_css.js";

const Fez = {};
cssMixin(Fez);

const DARK_DEFAULT = "&:where(.dark, .dark *)";

// restore the built-in after any test that swaps the strategy - CssMixins is
// module-level state shared by every test in this file
afterEach(() => Fez.cssMixin("dark", DARK_DEFAULT));

const squash = (css) => css.replace(/\s+/g, " ").trim();

// what Fez.globalCss does to a scoped <style> block: wrap, expand mixins,
// resolve :fez to the component selector, flatten
const scoped = (css, name = "demo") =>
  squash(
    flattenCss(
      Fez.cssMixin(`:fez {\n${css}\n}`).replace(/:fez\b/g, `.fez.fez-${name}`),
    ),
  );

// what it does to <style global> - mixins still expand, nothing is wrapped
const global = (css) => squash(flattenCss(Fez.cssMixin(css)));

describe("cssMixin", () => {
  test("expands a registered macro to its at-rule", () => {
    expect(scoped("h1 { :mobile { font-size: 12px; } }")).toBe(
      "@media (max-width: 767px){.fez.fez-demo h1{font-size: 12px;}}",
    );
  });

  test("supports the @include form", () => {
    expect(scoped("h1 { @include mobile { font-size: 12px; } }")).toBe(
      scoped("h1 { :mobile { font-size: 12px; } }"),
    );
  });

  test("leaves an unregistered macro untouched", () => {
    expect(scoped("h1 { :nope { color: red; } }")).toContain(":nope");
  });

  test("needs the trailing space - :mobile{ is not a macro", () => {
    // documented limitation of the textual substitution, not a bug to fix
    // silently: without the space the token stays put and emits dead CSS
    expect(scoped("h1 { :mobile{ font-size: 12px; } }")).not.toContain("@media");
  });
});

describe("cssMixin :dark", () => {
  test("resolves against the parent selector", () => {
    expect(scoped(".btn { background: #eee; :dark { background: #222; } }")).toBe(
      ".fez.fez-demo .btn{background: #eee;} " +
        ".fez.fez-demo .btn:where(.dark, .dark *){background: #222;}",
    );
  });

  test("at block root it targets the component wrapper", () => {
    expect(scoped("color: #111; :dark { color: #eee; }")).toBe(
      ".fez.fez-demo{color: #111;} " +
        ".fez.fez-demo:where(.dark, .dark *){color: #eee;}",
    );
  });

  test("adds no specificity, so it wins on source order alone", () => {
    const out = scoped(".btn { background: #eee; :dark { background: #222; } }");
    // same selector weight as the rule it overrides...
    expect(out).toContain(".btn:where(");
    expect(out).not.toContain(".dark .fez");
    // ...so order is what decides, and the dark rule must come second
    expect(out.indexOf("#eee")).toBeLessThan(out.indexOf("#222"));
  });

  test("dark rule follows the base even when declared above it", () => {
    // flattenCss emits a parent's declarations before its children, so a :dark
    // block cannot accidentally be overridden by the rule it is overriding
    const out = scoped(".btn { :dark { background: #222; } background: #eee; }");
    expect(out.indexOf("#eee")).toBeLessThan(out.indexOf("#222"));
  });

  test("matches the element itself, not only its descendants", () => {
    // the .dark branch - needed for a :root token block, where the class sits
    // on the very element being styled
    expect(global(":root { --bg: #fff; :dark { --bg: #111; } }")).toBe(
      ":root{--bg: #fff;} :root:where(.dark, .dark *){--bg: #111;}",
    );
  });

  test("swaps to the OS strategy without touching component CSS", () => {
    const css = ".btn { background: #eee; :dark { background: #222; } }";
    Fez.cssMixin("dark", "@media (prefers-color-scheme: dark)");
    expect(scoped(css)).toBe(
      ".fez.fez-demo .btn{background: #eee;} " +
        "@media (prefers-color-scheme: dark){.fez.fez-demo .btn{background: #222;}}",
    );
  });

  test("bare :dark in a global block has no parent to bind to", () => {
    // documented caveat: <style global> is not wrapped, so & resolves to
    // nothing. Nest under :root (or write html:dark) instead.
    expect(global(":dark { --bg: #111; }")).toContain("&");
  });
});

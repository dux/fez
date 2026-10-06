import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import createTemplateCompiler from "../src/fez/lib/template-compiler.js";
import closeCustomTags from "../src/fez/lib/close-custom-tags.js";
import RenderSlots from "../src/fez/lib/render-slots.js";
import { buildClassSource, trimTemplateLines } from "../src/fez/lib/class-source.js";
import { compileFileToModule } from "../src/fez/compile-module.js";
import flattenCss from "../src/fez/utils/flatten_css.js";

// Regressions for the template compiler, class assembly and CSS flattening.

const MockFez = {
  htmlEscape: (v) =>
    v == null ? "" : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]),
  jsEscape: (v) => (v == null ? "" : JSON.stringify(String(v)).slice(1, -1).replace(/['`$]/g, "\\$&")),
  toPairs: (c) => (Array.isArray(c) ? c.map((v, i) => [v, i]) : c && typeof c === "object" ? Object.entries(c) : []),
  isTruthy: (v) => (Array.isArray(v) ? v.length > 0 : v && typeof v === "object" ? Object.keys(v).length > 0 : !!v),
  fezAwait: (fez, key, p) => {
    fez.awaitKeys.push(key);
    return { status: "resolved", value: p };
  },
};

let saved;
beforeAll(() => {
  saved = [global.window, global.document, global.Fez];
  const window = new Window();
  global.window = window;
  global.document = window.document;
  global.Fez = MockFez;
});
afterAll(() => {
  [global.window, global.document, global.Fez] = saved;
});

const compile = (template) => createTemplateCompiler(template, { strict: true });
const render = (template, ctx = {}) => {
  const fezGlobals = new RenderSlots();
  fezGlobals.beginRender();
  return compile(template)({ state: {}, props: {}, awaitKeys: [], UID: 7, fezGlobals, ...ctx });
};
const keys = (html) => [...html.matchAll(/fez-key="([^"]*)"/g)].map((m) => m[1]);

describe("loop keys and indexes", () => {
  test("nested loops get distinct keys from per-depth hidden indexes", () => {
    const html = render("{#each state.rows as row}<tr>{#each row.c as cell}<td>{cell.v}</td>{/each}</tr>{/each}", {
      state: { rows: [{ c: [{ v: 1 }, { v: 2 }] }, { c: [{ v: 3 }] }] },
    });
    expect(keys(html)).toEqual(["0-0", "1-0-0", "1-0-1", "0-1", "1-1-0"]);
  });

  test("an inner two-param loop does not hide the outer implicit i", () => {
    const html = render("{#each state.a as x}{#each state.b as n, j}<b onclick={() => pick(i, j)}></b>{/each}{/each}", {
      state: { a: [1, 2], b: [1, 2] },
    });
    expect([...html.matchAll(/fez\.pick\((\d), (\d)\)/g)].map((m) => m[1] + m[2])).toEqual(["00", "01", "10", "11"]);
  });

  test("{#await} inside a loop gets one id per iteration", () => {
    const ctx = { state: { ps: ["a", "b"] }, awaitKeys: [] };
    render("{#each state.ps as p}{#await p}wait{:then v}<i>{v}</i>{/await}{/each}", ctx);
    expect(ctx.awaitKeys).toEqual(["0-0", "0-1"]);
  });

  test('" as " inside the collection expression', () => {
    const html = render('{#each state.m.get(" as ") as x}<i>{x}</i>{/each}', {
      state: { m: new Map([[" as ", ["ok"]]]) },
    });
    expect(html).toContain(">ok</i>");
  });
});

describe("attributes", () => {
  test("namespaced attributes are not :prop slots", () => {
    const html = render('<svg><use xlink:href="#star"></use></svg><p xml:lang="en"></p>');
    expect(html).toContain('xlink:href="#star"');
    expect(html).toContain('xml:lang="en"');
  });

  test("class: directives with > in the expression, merged with class={expr}", () => {
    const html = render("<div class={state.a} class:big={state.n > 1} class:on={state.l.find(i => i > 1)}>x</div>", {
      state: { a: "base", n: 2, l: [1, 2] },
    });
    expect(html).toMatch(/^<div class="base big on" fez-key="0">/);
  });

  test("a } inside a string attribute expression does not end the tag scan", () => {
    const html = render('<div title={state.ok ? "a}b" : "c"}>x</div>', { state: { ok: true } });
    expect(html).toBe('<div title="a}b" fez-key="0">x</div>');
  });

  test("static fez-this gets an id even after an attribute holding >", () => {
    const html = render('<input title={state.n > 1} fez-this="name" />', { state: { n: 2 } });
    expect(html).toContain('id="fez-7-name"');
  });

  test("an arrow in a non-event attribute is passed as quoted source", () => {
    const html = render("<input fez-use={el => el.focus()} />");
    expect(html).toContain('fez-use="el => el.focus()"');
  });

  test("template values in quoted handler code are escaped for JS", () => {
    const html = render(`<b onclick="fez.rm('{state.q}')">x</b>`, { state: { q: "');alert(1);//" } });
    // what the HTML parser hands to JS: entities decoded
    const handler = html
      .match(/onclick="([^"]*)"/)[1]
      .replace(/&(apos|quot|amp|lt|gt);/g, (_, e) => ({ apos: "'", quot: '"', amp: "&", lt: "<", gt: ">" })[e]);
    expect(handler).toBe("fez.rm('\\');alert(1);//')");
  });
});

describe("arrow handlers", () => {
  test("strings and property names are left alone", () => {
    const html = render("{#each state.l as n, idx}<b onclick={(e) => log('idx', idx, e.idx, state.e)}></b>{/each}", {
      state: { l: [1] },
    });
    expect(html).toContain(`onclick="fez.log('idx', 0, event.idx, fez.state.e)"`);
  });

  test("state assignment runs on the component", () => {
    expect(render("<b onclick={() => state.open = !state.open}></b>")).toContain(
      'onclick="fez.state.open = !fez.state.open"',
    );
  });
});

describe("blocks", () => {
  test("{:elseif} and {:elsif}", () => {
    expect(render("{#if state.a}a{:elseif state.b}b{:else}c{/if}", { state: { b: 1 } })).toBe("b");
    expect(render("{#if state.a}a{:elsif state.b}b{/if}", { state: { b: 1 } })).toBe("b");
  });

  test("mismatched and unclosed blocks name the problem", () => {
    expect(() => compile("{#if a}x{/each}")).toThrow("{/each} closes {#if}");
    expect(() => compile("{#each l as x}x{/if}")).toThrow("{/if} closes {#each}");
    expect(() => compile("{#if a}x")).toThrow("{#if} is never closed");
    expect(() => compile("<p>{:then v}</p>")).toThrow("{:then} without matching {#await}");
  });

  test("escaped braces are literal", () => {
    expect(render("<p>a \\{lit\\} b</p>")).toBe('<p fez-key="0">a {lit} b</p>');
  });
});

describe("closeCustomTags", () => {
  test("a > inside a quoted attribute does not stop self-close expansion", () => {
    expect(closeCustomTags('<x-c title="a > b" />')).toBe('<x-c title="a > b"></x-c>');
    expect(closeCustomTags('<x-c :on="() => go()" /><br />')).toBe('<x-c :on="() => go()"></x-c><br />');
  });
});

describe("class source", () => {
  test("backslashes survive into the compiled module", () => {
    const code = compileFileToModule("/x/x-pre.fez", "<p>C:\\users\\x</p>");
    expect(() => new Function(code.replace(/^export default .*$/m, "").replace("const Fez = window.Fez;", "const Fez = () => {};"))).not.toThrow();
    expect(code).toContain("C:\\\\users\\\\x");
  });

  test("a style without a colon (@import) is kept", () => {
    expect(buildClassSource({ styleGlobal: '@import "/css/app.css";' })).toContain('CSS_GLOBAL = `@import "/css/app.css";`');
  });

  test("$& in a field never acts as a replacement pattern", () => {
    expect(buildClassSource({ html: "<p>$&</p>" })).toContain("HTML = `<p>\\$&</p>`");
  });

  test("line trimming keeps <pre> and <textarea> indentation", () => {
    expect(trimTemplateLines("  <p>\n    x</p>\n<pre>\n    kept\n</pre>")).toBe("<p>\nx</p>\n<pre>\n    kept\n</pre>");
  });
});

describe("flattenCss", () => {
  test(":global() with nested parens", () => {
    expect(flattenCss(".fez.fez-x { :global(:is(.a, .b) .c) { x: 1; } }")).toContain(":is(.a, .b) .c{x: 1;}");
  });

  test("& inside an attribute string is not the parent", () => {
    expect(flattenCss('.p { a[title="x&y"] { x: 1; } }')).toContain('.p a[title="x&y"]{x: 1;}');
  });
});

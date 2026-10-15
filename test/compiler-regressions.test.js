import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import createTemplateCompiler from "../src/fez/lib/template-compiler.js";
import { htmlAttr, styleProp } from "../src/fez/lib/attrs.js";
import closeCustomTags from "../src/fez/lib/close-custom-tags.js";
import RenderSlots from "../src/fez/lib/render-slots.js";
import { buildClassSource, trimTemplateLines } from "../src/fez/lib/class-source.js";
import { compileFileToModule } from "../src/fez/compile-module.js";
import flattenCss from "../src/fez/utils/flatten_css.js";

// Regressions for the template compiler, class assembly and CSS flattening.

const MockFez = {
  htmlAttr: (name, value) => htmlAttr(name, value, MockFez.htmlEscape),
  styleProp,
  fnv1: (t) => String(t),
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
    expect(flattenCss(".fez.x-fez { :global(:is(.a, .b) .c) { x: 1; } }")).toContain(":is(.a, .b) .c{x: 1;}");
  });

  test("& inside an attribute string is not the parent", () => {
    expect(flattenCss('.p { a[title="x&y"] { x: 1; } }')).toContain('.p a[title="x&y"]{x: 1;}');
  });
});

describe("flattenCss - selector lists, :global and at-rules", () => {
  const P = ".fez.ui-x-fez";

  test("a comma inside a quoted attribute value does not split the selector", () => {
    expect(flattenCss(`${P}{ [data-x="a,b"] { x: 1 } }`)).toBe(`${P} [data-x="a,b"]{x: 1;}`);
  });

  test(":global(...) followed by more keeps the rest scoped", () => {
    expect(flattenCss(`${P}{ :global(.dark) .btn { x: 1 } }`)).toBe(`.dark ${P} .btn{x: 1;}`);
    expect(flattenCss(`${P}{ :global(html.dark) & .btn { x: 1 } }`)).toBe(`html.dark ${P} .btn{x: 1;}`);
    expect(flattenCss(`${P}{ :global(.solo) { x: 1 } }`)).toBe(".solo{x: 1;}");
  });

  test("a list inside :global() expands instead of splitting the selector", () => {
    expect(flattenCss(`${P}{ .x :global(.a,.b) { x: 1 } }`)).toBe(`${P} .x .a,${P} .x .b{x: 1;}`);
    expect(flattenCss(`${P}{ :global(.a, .b) .c { x: 1 } }`)).toBe(`.a ${P} .c,.b ${P} .c{x: 1;}`);
  });

  test("statement at-rules leave a scoped block and lead the sheet", () => {
    const css = flattenCss(`${P}{ .y { x: 1 } @import url(a.css); @layer base, ui; }`);
    expect(css.split("\n")).toEqual(["@import url(a.css);", "@layer base, ui;", `${P} .y{x: 1;}`]);
  });

  test("@starting-style nests like @media, @position-try stays verbatim", () => {
    expect(flattenCss(`${P}{ .y { @starting-style { opacity: 0 } } }`)).toBe(`@starting-style{${P} .y{opacity: 0;}}`);
    expect(flattenCss("@position-try --x { top: 0 }")).toBe("@position-try --x{top: 0;}");
  });
});

describe("template compiler - attribute and handler forms", () => {
  test(":prop works braced, hyphenated and with an object literal", () => {
    const fezGlobals = new RenderSlots();
    fezGlobals.beginRender();
    const html = compile('<x-c :a={state.t} :data-b="state.t" :c="{v: state.t}" />')({ state: { t: "a b" }, props: {}, UID: 7, fezGlobals });
    expect(html).toBe('<x-c :a=Fez(7).fezGlobals.value(0) :data-b=Fez(7).fezGlobals.value(1) :c=Fez(7).fezGlobals.value(2) fez-key="0"></x-c>');
    expect(fezGlobals.value(2)).toEqual({ v: "a b" });
  });

  test("onclick={method} calls the method with the event", () => {
    expect(render("<b onclick={save}>x</b>")).toContain('onclick="fez.save(event)"');
  });

  test("async arrows and any event parameter name compile to a handler", () => {
    expect(render("<b onclick={async () => save()}>x</b>")).toContain('onclick="fez.save()"');
    expect(render("<b onclick={(evt) => go(evt.target)}>x</b>")).toContain('onclick="fez.go(event.target)"');
  });

  test("{#each obj as key, value}: an object value is captured, an array index interpolated", () => {
    const objectRows = render("{#each state.o as k, v}<b onclick={() => pick(v)}>x</b>{/each}", { state: { o: { a: { n: 1 } } } });
    expect(objectRows).toContain("fezGlobals.handler(0)(event)");
    const arrayRows = render("{#each state.a as it, i}<b onclick={() => rm(i)}>x</b>{/each}", { state: { a: ["x"] } });
    expect(arrayRows).toContain('onclick="fez.rm(0)"');
  });

  test("a backtick in text is a plain character", () => {
    expect(render("<p>it`s {state.t}</p><i>{state.t}</i>", { state: { t: "T" } })).toBe('<p fez-key="0">it`s T</p><i fez-key="1">T</i>');
  });

  test("<script> and <style> bodies in a template are not evaluated", () => {
    const html = render("<div><script>if (1) { y() }</script><style>.a{ --x: 1 }</style>{state.t}</div>", { state: { t: "T" } });
    expect(html).toContain("<script fez-key=\"1\">if (1) { y() }</script>");
    expect(html).toContain("<style fez-key=\"2\">.a{ --x: 1 }</style>T");
  });

  test("Svelte syntax fails with a hint instead of rendering garbage", () => {
    const strict = (t) => () => createTemplateCompiler(t, { name: "x-y", strict: true });
    expect(strict("{@debug x}")).toThrow("Unknown template directive {@debug x}");
    expect(strict("<b on:click|preventDefault={go}>x</b>")).toThrow("write onclick={...}");
    expect(strict('<input bind:value="x">')).toThrow("fez:bind");
  });

  test("static fez:this in a loop gets one id per row", () => {
    expect(render('{#each state.r as x}<input fez-this="row">{/each}', { state: { r: [1, 2] } })).toContain('id="fez-7-row-1"');
  });
});

describe("compileFileToModule - imports, scopes and errors", () => {
  const two = `<xmp fez="ui-one">
<script>
  import {
    a,
  } from './dep.js'
  const helper = 1
  class { x = helper + a }
</script>
<p>1</p>
</xmp>
<xmp fez="ui-two">
<script>
  import {
    a,
  } from './dep.js'
  const helper = 2
  class { x = helper + a }
</script>
<p>2</p>
</xmp>`;

  test("multi-line imports are hoisted once and each component gets its own scope", () => {
    const out = compileFileToModule("/x/two.fez", two);
    expect(out.match(/from '\.\/dep\.js'/g).length).toBe(1);
    expect(out.indexOf("import {")).toBe(0);
    // two `const helper` declarations would be a SyntaxError in one scope
    expect(() => new Function(out.replace(/^import[\s\S]*?;?\n\n/, "").replace("export default", "return"))).not.toThrow();
  });

  test("an unclosed definition is an error, not a silent component", () => {
    expect(() => compileFileToModule("/x/bad.fez", '<xmp fez="ui-x"><p>x</p>')).toThrow("Unclosed");
  });

  test("a <head> block is emitted as a Fez.head call", () => {
    const out = compileFileToModule("/x/ui-h.fez", '<head>\n  <link rel="stylesheet" href="/a.css">\n</head>\n<p>x</p>');
    expect(out).toContain('Fez.head("<link rel=\\"stylesheet\\" href=\\"/a.css\\">");');
  });
});

describe("template compiler - Svelte parity blocks", () => {
  const items = [{ id: "a1", n: 1 }, { id: "b2", n: 2 }];

  test("keyed each puts the key on the first element of the body", () => {
    expect(render("{#each state.a as it (it.id)}<li>{it.n}</li>{/each}", { state: { a: items } })).toBe(
      '<li key="a1">1</li><li key="b2">2</li>',
    );
    // an index binding and a key that is a call
    expect(render("{#each state.a as it, i (String(it.id))}<li>{i}</li>{/each}", { state: { a: items } })).toBe(
      '<li key="a1">0</li><li key="b2">1</li>',
    );
  });

  test("{@const} is a local for the rest of its branch", () => {
    expect(render("{#each state.a as it}{@const d = it.n * 2}<b>{d}</b>{:else}none{/each}", { state: { a: items } })).toBe(
      '<b fez-key="0-0">2</b><b fez-key="0-1">4</b>',
    );
    expect(render("{#if state.a.length}{@const {n} = state.a[0]}<i>{n}</i>{:else}<u>{state.x}</u>{/if}", { state: { a: [], x: "e" } })).toBe(
      '<u fez-key="1">e</u>',
    );
    expect(render("{@const total = state.a.length}<p>{total}</p>", { state: { a: items } })).toBe('<p fez-key="0">2</p>');
  });

  test("a {@const} name used in a handler is captured at render time", () => {
    expect(render("{@const d = state.a[0]}<b onclick={() => pick(d)}>x</b>", { state: { a: items } })).toContain(
      "fezGlobals.handler(0)(event)",
    );
  });

  test("{#key} puts the value into the key of its body", () => {
    const a = render("{#key state.k}<p>x</p>{/key}", { state: { k: 1 } });
    const b = render("{#key state.k}<p>x</p>{/key}", { state: { k: 2 } });
    expect(a).toBe('<p key="0-k1">x</p>');
    expect(b).toBe('<p key="0-k2">x</p>');
  });

  test("style:prop merges into style and drops unset values", () => {
    expect(render('<p style="margin: 0" style:color={state.c} style:--x={state.none} style:width={state.w + "px"}>x</p>', { state: { c: "red", w: 5 } })).toBe(
      '<p style="margin: 0;color: red;width: 5px;" fez-key="0">x</p>',
    );
  });
});

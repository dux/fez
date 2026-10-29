import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileFileToModule } from '../src/fez/compile-module.js';
import { precompileTemplate } from '../src/fez/lib/template-precompile.js';
import RenderSlots from '../src/fez/lib/render-slots.js';
import Fez from '../src/fez/root.js';
import { createFezPlugin } from '../src/fez/plugin.js';

const compile = (source, options = {}) => compileFileToModule('ui-test.fez', source, options);

const valid = `<script>
  const GREETING = 'hi'
  class {
    color() { return GREETING }
  }
</script>
<div>{state.name}</div>`;

describe('compile-module', () => {
  test('compiles a component to an ES module', () => {
    const code = compile(valid);
    expect(code).toContain('const Fez = window.Fez;');
    expect(code).toContain("Fez('ui-test'");
    expect(code).toContain('export default __fez_component_0;');
  });

  test('keeps module-level preamble bindings', () => {
    const code = compile(valid);
    expect(code).toContain("const GREETING = 'hi'");
  });

  test('rejects a component name without a dash', () => {
    expect(() => compileFileToModule('thing.fez', valid)).toThrow(/must contain a dash/);
  });

  test('rejects invalid script syntax', () => {
    expect(() => compile('<script>class { const = }</script><div></div>')).toThrow(/script error/);
  });

  test('rejects body styles on a scoped block', () => {
    expect(() => compile('<style>body { color: red; }</style><div></div>')).toThrow(/style error/);
  });

  test('rejects an invalid template', () => {
    expect(() => compile('<script>class {}</script><div>{state.}</div>')).toThrow(
      /template compile error/i,
    );
  });

  test('drops <info>/<demo> metadata when minify is true', () => {
    const source = `<info>docs</info>
<demo><ui-test></ui-test></demo>
<script>class {}</script>
<div></div>`;
    expect(compile(source)).toContain("Fez.index.ensure('ui-test').info");
    expect(compile(source, { minify: true })).not.toContain('Fez.index.ensure');
  });

  test('compiles every definition of a multi-component file', () => {
    const source = `<xmp fez="ui-one">
<script>class {}</script>
<div>one</div>
</xmp>
<xmp fez="ui-two">
<script>class {}</script>
<div>two</div>
</xmp>`;
    const code = compile(source);
    expect(code).toContain("Fez('ui-one'");
    expect(code).toContain("Fez('ui-two'");
  });

  test('strips TypeScript types from <script lang="ts">', () => {
    const source = [
      '<script lang="ts">',
      "  import type { User } from './types'",
      '  interface Props { name: string }',
      '  const LIMIT: number = 3',
      '  class {',
      '    count: number = 0',
      '    greet(name: string): string { return `hi ${name}` }',
      '  }',
      '</script>',
      '<div>{state.count}</div>',
    ].join('\n');

    const code = compile(source);
    expect(code).not.toContain('interface Props');
    expect(code).not.toContain('import type');
    expect(code).toContain('const LIMIT = 3');
    expect(code).toContain('count = 0');
    expect(code).toContain('greet(name)');
  });

  test('accepts type="text/typescript"', () => {
    const code = compile(
      '<script type="text/typescript">class { n: number = 1 }</script><div></div>',
    );
    expect(code).toContain('n = 1');
  });

  test('reports a TypeScript syntax error with its location', () => {
    expect(() => compile('<script lang="ts">class { n: number = }</script><div></div>')).toThrow(
      /TypeScript error.*line 1/,
    );
  });
});

describe('fez plugin', () => {
  test('load() compiles .fez files from disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-plugin-'));
    const file = path.join(dir, 'ui-thing.fez');
    fs.writeFileSync(file, valid);
    const result = createFezPlugin().load(file);
    expect(result.code).toContain("Fez('ui-thing'");
    expect(result.map).toBe(null);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('load() registers the .fez file with the watcher', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-plugin-watch-'));
    const file = path.join(dir, 'ui-thing.fez');
    fs.writeFileSync(file, valid);
    const watched = [];
    createFezPlugin().load.call({ addWatchFile: (id) => watched.push(id) }, file);
    expect(watched).toEqual([file]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('ignores non-fez modules', () => {
    expect(createFezPlugin().load('/tmp/app.js')).toBe(null);
  });

  test('load() compiles a TypeScript component', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-plugin-ts-'));
    const file = path.join(dir, 'ui-typed.fez');
    fs.writeFileSync(file, '<script lang="ts">class { n: number = 1 }</script><div></div>');
    const result = createFezPlugin().load(file);
    expect(result.code).toContain("Fez('ui-typed'");
    expect(result.code).toContain('n = 1');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('compiles a <slim> template', () => {
    const code = compile('<script>\nclass {}\n</script>\n<slim>\n  div.p-0.5\n    p= state.name\n</slim>');
    expect(code).toContain(
      '<div class="p-0.5" fez-key="0"><p fez-key="1">${Fez.htmlEscape(fez.state.name)}</p></div>',
    );
  });

  test('slim errors carry the line', () => {
    expect(() => compile('<slim>\n  div\n    - end\n</slim>')).toThrow('<slim> line 3:5:');
  });

  test('slim template compiler errors carry the line', () => {
    expect(() => compile('<slim>\n  div\n    p= foo(\n</slim>')).toThrow(/^<slim> line 3: /);
  });
});

// The emitted render function, run against a plain component-like object
const render = (html, ctx) => {
  const { code } = precompileTemplate(html, { name: 'ui-test' });
  const fn = Function('Fez', `return (${code})`)(Fez);
  ctx.UID ??= 7;
  ctx.state ??= {};
  ctx.props ??= {};
  ctx.fezGlobals ??= new RenderSlots();
  ctx.fezGlobals.beginRender();
  return fn.call(ctx);
};

describe('precompiled templates', () => {
  test('the module carries the render function, not the template source', () => {
    const code = compile(valid);
    expect(code).toContain('const __fez_template_0 = function () {');
    expect(code).toContain('__fez_component_0.FEZ_TEMPLATE = { render: __fez_template_0, slotUnwrap: false };');
    expect(code).not.toContain('HTML = ');
    expect(code).not.toMatch(/\bwith \(|new Function/);
  });

  test('the template does not see the script module names', () => {
    const code = compile(valid.replace('{state.name}', '{GREETING}'));
    expect(code.indexOf('const __fez_template_0')).toBeLessThan(code.indexOf("const GREETING = 'hi'"));
    expect(code).toContain('("GREETING" in fez ? fez.GREETING : GREETING)');
  });

  test('names resolve like `with (component)`: own property first, then global', () => {
    globalThis.__fezGlobalName = 'global';
    try {
      const html = '<p>{__fezGlobalName} {label()} {typeof nowhere} {Math.max(1, 2)}</p>';
      const ctx = { state: { name: 'x' }, label() { return this.state.name + '!'; } };
      expect(render(html, ctx)).toBe('<p fez-key="0">global x! undefined 2</p>');
      expect(render(html, { ...ctx, __fezGlobalName: 'own' })).toContain('own x!');
    } finally {
      delete globalThis.__fezGlobalName;
    }
  });

  test('loop variables, {@const} and arrow params stay local', () => {
    const html =
      '{#each state.items as item, n}{@const label = item.toUpperCase()}<i>{n}{label}{[1].map((n) => n + 1)}</i>{/each}';
    expect(render(html, { state: { items: ['a'] } })).toContain('>0A2</i>');
  });

  test('handlers become render-slot closures listed in fez-on, never attribute code', () => {
    const picked = [];
    const ctx = {
      state: { items: [{ id: 'a' }, { id: 'b' }], q: '' },
      pick(id, i) {
        picked.push([id, i, this === ctx]);
      },
    };
    const html =
      '{#each state.items as item}<button onclick="fez.pick(\'{item.id}\', {i})">x</button>{/each}' +
      '<input oninput={(e) => state.q = e.target.value} onkeydown="return false" />';
    const out = render(html, ctx);
    expect(out).not.toMatch(/\son[a-z]+=/);
    expect(out).toContain('fez-on="7 click:0"');
    expect(out).toContain('fez-on="7 click:1"');
    expect(out).toContain('fez-on="7 input:2 keydown:3"');

    const el = { value: 'typed' };
    ctx.fezGlobals.handler(1).call(el, {});
    expect(picked).toEqual([['b', 1, true]]);
    expect(ctx.fezGlobals.handler(2).call(el, { target: el })).toBeUndefined();
    expect(ctx.state.q).toBe('typed');
    expect(ctx.fezGlobals.handler(3).call(el, {})).toBe(false);
  });

  test('a handler body sees the element as this and the event', () => {
    const html = '<a onclick="this.seen = event.type">x</a><b onclick={save}>y</b>';
    const saved = [];
    const ctx = { save: (e) => saved.push(e.type) };
    render(html, ctx);
    const el = {};
    ctx.fezGlobals.handler(0).call(el, { type: 'click' });
    ctx.fezGlobals.handler(1).call(el, { type: 'click' });
    expect(el.seen).toBe('click');
    expect(saved).toEqual(['click']);
  });

  test('fez:use={fn} is parked like a handler', () => {
    const ctx = {};
    const out = render('<div fez:use={(node) => node.used = true}></div>', ctx);
    expect(out).toContain('fez-use="@7:0"');
    const node = {};
    ctx.fezGlobals.handler(0)(node);
    expect(node.used).toBe(true);
  });
});


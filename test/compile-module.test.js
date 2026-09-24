import { describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compileFileToModule } from '../src/fez/compile-module.js';
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
});

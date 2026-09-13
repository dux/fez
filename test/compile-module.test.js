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
    expect(code).toContain("import { Fez } from '@dinoreic/fez';");
    expect(code).toContain("Fez('ui-test'");
    expect(code).toContain('export default __fez_component_0;');
  });

  test('keeps module-level preamble bindings', () => {
    const code = compile(valid);
    expect(code).toContain("const GREETING = 'hi'");
  });

  test('honours the runtime option', () => {
    const code = compile(valid, { runtime: './fez.js' });
    expect(code).toContain("import { Fez } from './fez.js';");
  });

  test('rejects a component name without a dash', () => {
    expect(() => compileFileToModule('thing.fez', valid)).toThrow(/must contain a dash/);
  });

  test('rejects invalid script syntax', () => {
    expect(() => compile('<script>class { const = }</script><div></div>')).toThrow(
      /script error/,
    );
  });

  test('rejects body styles on a scoped block', () => {
    expect(() => compile('<style>body { color: red; }</style><div></div>')).toThrow(
      /style error/,
    );
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

  test('ignores non-fez modules', () => {
    expect(createFezPlugin().load('/tmp/app.js')).toBe(null);
  });
});

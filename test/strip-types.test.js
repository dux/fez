import { describe, expect, test } from 'bun:test';
import { stripTypeScript } from '../src/fez/lib/strip-types.js';

const TYPED = [
  "import type { Item } from './types'",
  'interface Config { maxItems: number }',
  'const CONFIG: Config = { maxItems: 10 }',
  'class {',
  '  count: number = 0',
  '  addItem(item: string): void {',
  '    if (this.state.items.length < CONFIG.maxItems) {',
  '      this.state.items.push(item as Item)',
  '    }',
  '  }',
  '}',
].join('\n');

describe('stripTypeScript', () => {
  test('strips types and produces runnable JavaScript', () => {
    const out = stripTypeScript(TYPED);

    expect(out).not.toContain('interface');
    expect(out).not.toContain('import type');
    expect(out).not.toContain('count: number');
    expect(out).not.toContain('as Item');
    expect(out).toContain('const CONFIG = { maxItems: 10 }');
    expect(out).toContain('class {');

    const named = out.replace(/class\s*\{/, 'class __C__ {');
    const C = new Function(`${named}; return __C__;`)();
    const instance = new C();
    expect(instance).toBeInstanceOf(C);
    expect(instance.addItem).toBeTypeOf('function');
  });

  test('elides a value import used only as a type', () => {
    const out = stripTypeScript("import { Item } from './types'\nclass { n: Item = null }");
    expect(out).not.toContain("from './types'");
    expect(out).not.toContain('Item');
    expect(out).toContain('n = null');
  });

  test('keeps a value import that is used at runtime', () => {
    const out = stripTypeScript(
      "import { Item } from './types'\nclass { use(): Item { return Item } }",
    );
    expect(out).toMatch(/import\s*\{\s*Item\s*\}\s*from\s*["']\.\/types["']/);
    expect(out).toContain('return Item');
  });

  test('handles the implicit class-body form', () => {
    const out = stripTypeScript('greet(name: string): string { return `hi ${name}` }');
    expect(out).toContain('class {');
    expect(out).toContain('greet(name)');
    expect(out).not.toContain(': string');
  });

  test('does not split on `class {` inside a string literal', () => {
    const out = stripTypeScript('const s = "class {"\nclass { n: number = 1 }');
    expect(out).toContain('const s = "class {"');
    expect(out).toContain('n = 1');
  });

  test('reports the error line and column', () => {
    let caught;
    try {
      stripTypeScript('class {\n  n: number = 1\n  broken: number = }\n}');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toContain('Fez TypeScript error');
    expect(caught.location.line).toBe(3);
  });
});

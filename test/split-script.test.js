import { describe, expect, test } from 'bun:test';
import { splitScript } from '../src/fez/lib/validate.js';

describe('splitScript', () => {
  test('finds the class after a regex literal that contains quotes', () => {
    const script = `const esc = (s) => s.replace(/[&<>"']/g, '')\nclass {\n  init() {}\n}`;
    const { preamble, body, hasClass } = splitScript(script);
    expect(hasClass).toBe(true);
    expect(preamble).toContain(`/[&<>"']/g`);
    expect(body).toContain('init() {}');
  });

  test('finds the class after a regex that follows a keyword', () => {
    const script = "const has = (s) => { return /'/.test(s) }\nclass {\n}";
    expect(splitScript(script).hasClass).toBe(true);
  });

  test('a regex with a backtick inside a template expression does not end the template', () => {
    const script = 'const t = `${s.replace(/`/g, "")} class {`\nclass {\n  init() {}\n}';
    const { preamble, hasClass } = splitScript(script);
    expect(hasClass).toBe(true);
    expect(preamble).toContain('class {`');
  });

  test('division is not read as a regex', () => {
    const script = `const half = total / 2, q = "'"\nconst r = (a + b) / 2 / c\nclass {\n}`;
    const { preamble, hasClass } = splitScript(script);
    expect(hasClass).toBe(true);
    expect(preamble).toContain('/ 2 / c');
  });

  test('does not split on `class {` inside a regex literal', () => {
    const script = 'const re = /class {/\nclass {\n  init() {}\n}';
    expect(splitScript(script).preamble).toContain('/class {/');
  });
});

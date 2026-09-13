import { test, expect } from 'bun:test';

const Fez = globalThis.window.Fez;

test('nameFromPath strips only the final extension', () => {
  expect(Fez.nameFromPath('/a/b/my.component.fez')).toBe('my.component');
  expect(Fez.nameFromPath('ui-card.fez')).toBe('ui-card');
  expect(Fez.nameFromPath('https://x/y/z.txt?q=1#h')).toBe('z');
});

test('fnv1 is deterministic and stays a positive base36 string', () => {
  const a = Fez.fnv1('hello');
  expect(Fez.fnv1('hello')).toBe(a);
  expect(a).not.toContain('-');
  expect(Fez.fnv1('hello world')).not.toBe(a);
});

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

test('getFunction compiles zero-param and async arrows', async () => {
  expect(Fez.getFunction('() => 42')()).toBe(42);
  expect(await Fez.getFunction('async (a, b) => a + b')(1, 2)).toBe(3);
  expect(Fez.getFunction('x => x * 2')(4)).toBe(8);
});

test('jsEscape keeps data inside a quoted JS string', () => {
  const value = `');alert(1);//\`\${x}\\\n`;
  expect(new Function(`return '${Fez.jsEscape(value)}'`)()).toBe(value);
  expect(new Function(`return \`${Fez.jsEscape(value)}\``)()).toBe(value);
  expect(Fez.jsEscape(null)).toBe('');
});

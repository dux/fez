import { test, expect } from 'bun:test';
import { installMockXHR } from './mock-xhr.js';

const Fez = globalThis.window.Fez;

test('nameFromPath strips only the final extension', () => {
  expect(Fez._.nameFromPath('/a/b/my.component.fez')).toBe('my.component');
  expect(Fez._.nameFromPath('ui-card.fez')).toBe('ui-card');
  expect(Fez._.nameFromPath('https://x/y/z.txt?q=1#h')).toBe('z');
});

test('fnv1 is deterministic and stays a positive base36 string', () => {
  const a = Fez.util.fnv1('hello');
  expect(Fez.util.fnv1('hello')).toBe(a);
  expect(a).not.toContain('-');
  expect(Fez.util.fnv1('hello world')).not.toBe(a);
});

test('getFunction compiles zero-param and async arrows', async () => {
  expect(Fez.getFunction('() => 42')()).toBe(42);
  expect(await Fez.getFunction('async (a, b) => a + b')(1, 2)).toBe(3);
  expect(Fez.getFunction('x => x * 2')(4)).toBe(8);
});

test('jsEscape keeps data inside a quoted JS string', () => {
  const value = `');alert(1);//\`\${x}\\\n`;
  expect(new Function(`return '${Fez.util.jsEscape(value)}'`)()).toBe(value);
  expect(new Function(`return \`${Fez.util.jsEscape(value)}\``)()).toBe(value);
  expect(Fez.util.jsEscape(null)).toBe('');
});

test('htmlEscape escapes every value as text and renders null/undefined as nothing', () => {
  expect(Fez.util.htmlEscape(['<b>', 'x'])).toBe('&lt;b&gt;,x');
  expect(Fez.util.htmlEscape(null)).toBe('');
  expect(Fez.util.htmlEscape(undefined)).toBe('');
  expect(Fez.util.htmlEscape(0)).toBe('0');
  // CSS text is content like any other, nothing is stripped
  expect(Fez.util.htmlEscape('font-family: Arial; color: red;')).toBe('font-family: Arial; color: red;');
});

test('htmlAttr drops null and false booleans, keeps false on other attributes', () => {
  expect(Fez.util.htmlAttr('hidden', false)).toBe('');
  expect(Fez.util.htmlAttr('hidden', true)).toBe(' hidden=""');
  expect(Fez.util.htmlAttr('disabled', '')).toBe('');
  expect(Fez.util.htmlAttr('checked', 'false')).toBe('');
  expect(Fez.util.htmlAttr('disabled', 'disabled')).toBe(' disabled=""');
  expect(Fez.util.htmlAttr('title', null)).toBe('');
  expect(Fez.util.htmlAttr('aria-expanded', false)).toBe(' aria-expanded="false"');
  expect(Fez.util.htmlAttr('title', 'a "b"')).toBe(' title="a &quot;b&quot;"');
});

test('component list entries get .fez whether relative or absolute', async () => {
  const net = installMockXHR();
  const { compile } = Fez;
  Fez.compile = () => {};
  Fez.req.clearCache();
  try {
    const done = new Promise((resolve) => Fez.head({ fez: '/lists/components.txt' }, resolve));
    net.requests[0].respond(200, '# comment\nui-a\nforms/ui-b.fez\n/shared/ui-c\n');
    await new Promise((resolve) => setTimeout(resolve, 0));
    net.requests.slice(1).forEach((req) => req.respond(200, '<p>x</p>'));
    await done;
    expect(net.requests.map((req) => req.url)).toEqual([
      '/lists/components.txt',
      '/lists/ui-a.fez',
      '/lists/forms/ui-b.fez',
      '/shared/ui-c.fez',
    ]);
  } finally {
    net.restore();
    Fez.compile = compile;
  }
});

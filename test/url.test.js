import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { setupPjaxEnv, teardownPjaxEnv } from './pjax-env.js';
import attachUrl from '../src/fez/lib/url.js';
import createPjax from '../src/fez/pjax/pjax.js';

const Fez = {};
attachUrl(Fez);

const FULL = 'https://app.example.com:8443/foo/bar/baz:789?baz=123#/some/hpath?baz=455';

beforeAll(() => {
  setupPjaxEnv();
});

afterAll(() => {
  teardownPjaxEnv();
});

beforeEach(() => {
  window.history.replaceState({}, '', '/catalog/pri:2?page=3#/traffic?app=x');
});

describe('Fez.url parsing', () => {
  test('reads every part of a full URL', () => {
    const url = Fez.url(FULL);
    expect(url.proto()).toBe('https');
    expect(url.host()).toBe('app.example.com');
    expect(url.port()).toBe('8443');
    expect(url.path()).toBe('/foo/bar');
    expect(url.pqs('baz')).toBe('789');
    expect(url.qs('baz')).toBe('123');
    expect(url.hpath()).toBe('/some/hpath');
    expect(url.hqs('baz')).toBe('455');
    expect(url.anchor()).toBe('');
    expect(url.pqs()).toEqual({ baz: '789' });
    expect(url.qs()).toEqual({ baz: '123' });
    expect(url.hqs()).toEqual({ baz: '455' });
  });

  test('round-trips untouched URLs verbatim', () => {
    for (const href of [
      '/foo/bar/baz:789?baz=123#/some/hpath?baz=455',
      '/a?x=1&x=2&flag&empty=',
      '/?q=a+b&r=a%20b,c',
      '/#tab=x&y=1',
      '/page#section',
      '/a/b/',
      '/catalog#ns/traffic?app=x',
      '/',
    ]) {
      expect(String(Fez.url(href))).toBe(href);
    }
    expect(String(Fez.url(FULL))).toBe(FULL);
    expect(Fez.url('/x?a=1').href()).toBe('http://localhost/x?a=1');
  });

  test('tells the three fragment forms apart', () => {
    const route = Fez.url('/#/logs?app=x');
    expect([route.hpath(), route.hqs('app'), route.anchor()]).toEqual(['/logs', 'x', '']);

    const params = Fez.url('/#tab=x&y=1');
    expect([params.hpath(), params.hqs('tab'), params.anchor()]).toEqual(['', 'x', '']);

    const anchor = Fez.url('/#section');
    expect([anchor.hpath(), anchor.hqs('section'), anchor.anchor()]).toEqual(['', undefined, 'section']);
  });

  test('a /key:value segment counts only at the end of the path', () => {
    const url = Fez.url('/a:1/foo/b:2/c:3');
    expect(url.path()).toBe('/a:1/foo');
    expect(url.pqs()).toEqual({ b: '2', c: '3' });
  });
});

describe('Fez.url building', () => {
  test('chains writes across every part', () => {
    const href = Fez.url('/')
      .path('/x')
      .pqs('pri', 3)
      .qs({ page: 2, q: null })
      .hpath('/logs')
      .hqs('app', 'shop')
      .toString();
    expect(href).toBe('/x/pri:3?page=2#/logs?app=shop');
  });

  test('a blank value removes a key and null clears the list', () => {
    for (const value of [null, false, '']) {
      expect(String(Fez.url('/?a=1&b=2').qs('a', value))).toBe('/?b=2');
    }
    expect(String(Fez.url('/?a=1&b=2').qs(null))).toBe('/');
    expect(String(Fez.url('/x/a:1/b:2').pqs(null))).toBe('/x');
    expect(String(Fez.url('/#/r?a=1').hqs(null))).toBe('/#/r');
  });

  test('updating a repeated key keeps its place and drops the duplicates', () => {
    expect(String(Fez.url('/?k=1&x=a&k=2').qs('k', 3))).toBe('/?k=3&x=a');
  });

  test('round-trips reserved characters, Unicode, empty-looking values and zero', () => {
    for (const list of ['qs', 'pqs', 'hqs']) {
      for (const value of ['a b+c&d=e#f?%/\u017e', 0, 'x:y']) {
        const href = String(Fez.url('/p')[list]('a &+=#', value));
        expect(Fez.url(href)[list]('a &+=#')).toBe(String(value));
      }
    }
  });

  test('decodes plus as a space in a query, never in a path param', () => {
    const url = Fez.url('/x/q:a+b?q=a+b=c');
    expect(url.qs('q')).toBe('a b=c');
    expect(url.pqs('q')).toBe('a+b');
  });

  test('writing a path param drops the same query key', () => {
    expect(String(Fez.url('/boards/x?pri=1&q=a').pqs('pri', 3))).toBe('/boards/x/pri:3?q=a');
    expect(String(Fez.url('/boards/x?pri=1').pqs({ pri: 3, usr: 'a' }))).toBe('/boards/x/pri:3/usr:a');
  });

  test('a written path merges its trailing params into pqs', () => {
    expect(String(Fez.url('/old/a:1').path('new/b:2'))).toBe('/new/a:1/b:2');
    expect(String(Fez.url('/old/a:1').path(''))).toBe('/a:1');
  });

  test('hpath keeps the route query; a bare name becomes a route', () => {
    expect(String(Fez.url('/c#/traffic?app=x').hpath('logs'))).toBe('/c#/logs?app=x');
    expect(String(Fez.url('/c#ns/traffic?app=x').hqs('app', 'y'))).toBe('/c#ns/traffic?app=y');
    expect(String(Fez.url('/c#/traffic?app=x').hpath(null))).toBe('/c#app=x');
  });

  test('a route or params replace an anchor, and an anchor replaces them', () => {
    expect(String(Fez.url('/c#section').hqs('tab', 'x'))).toBe('/c#tab=x');
    expect(String(Fez.url('/c#section').hpath('/logs'))).toBe('/c#/logs');
    expect(String(Fez.url('/c#/logs?app=x').anchor('#top'))).toBe('/c#top');
  });

  test('a changed origin renders absolute', () => {
    expect(String(Fez.url('/x').host('other.test'))).toBe('http://other.test/x');
    expect(String(Fez.url('/x').proto('https').port(8443))).toBe('https://localhost:8443/x');
    expect(String(Fez.url('https://other.test/x').host('localhost').proto('http'))).toBe('/x');
  });
});

describe('Fez.url on the current page', () => {
  test('reads the current location at call time', () => {
    expect(Fez.url.qs('page')).toBe('3');
    expect(Fez.url.pqs('pri')).toBe('2');
    expect(Fez.url.hpath()).toBe('/traffic');
    window.history.replaceState({}, '', '/other?page=9');
    expect(Fez.url.qs('page')).toBe('9');
    expect(String(Fez.url())).toBe('/other?page=9');
  });

  test('a shortcut write returns a builder and changes nothing until push', () => {
    const length = window.history.length;
    const next = Fez.url.qs('page', 4);
    expect(String(next)).toBe('/catalog/pri:2?page=4#/traffic?app=x');
    expect(location.search).toBe('?page=3');
    next.push();
    expect(location.search).toBe('?page=4');
    expect(window.history.length).toBe(length + 1);
  });

  test('replace rewrites the entry without adding history', () => {
    const length = window.history.length;
    Fez.url.hqs('app', 'y').replace();
    expect(location.hash).toBe('#/traffic?app=y');
    expect(window.history.length).toBe(length);
  });

  test('Fez.load takes a builder as its URL', () => {
    const Pjax = createPjax();
    expect(Pjax.getOpts(Fez.url('/x').qs('a', 1)).href).toBe('/x?a=1');
  });
});

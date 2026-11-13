import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import utility from '../src/fez/lib/utility.js';
import { installMockXHR } from './mock-xhr.js';

// Minimal Fez stub carrying just what Fez.request / Fez.fetch touch.
function makeFez() {
  const Fez = {
    consoleLog: () => {},
    onError: (_scope, err) => {
      throw err;
    },
  };
  utility(Fez);
  return Fez;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let net;
let Fez;
beforeEach(() => {
  net = installMockXHR();
  Fez = makeFez();
  Fez.request.clearCache();
  Fez.request.headers = {};
});
afterEach(() => {
  net.restore();
  delete globalThis.location;
});

describe('Fez.param', () => {
  test('encodes arrays and nested objects with Rails brackets', () => {
    const qs = Fez.param({ refs: ['a', 'b'], user: { name: 'Jo', tags: [1] }, rows: [{ id: 1 }, { id: 2 }], empty: null });
    expect(decodeURIComponent(qs)).toBe(
      'refs[]=a&refs[]=b&user[name]=Jo&user[tags][]=1&rows[0][id]=1&rows[1][id]=2&empty=',
    );
  });
});

describe('Fez.request', () => {
  test('a GET appends data to the query string', () => {
    Fez.request('/search?x=1', { data: { q: 'fez', ids: [1, 2] } });
    expect(decodeURIComponent(net.requests[0].url)).toBe('/search?x=1&q=fez&ids[]=1&ids[]=2');
    expect(net.requests[0].body).toBe(null);
  });

  test('a POST sends nested data urlencoded, and switches to multipart when it holds a file', () => {
    Fez.request({ method: 'POST', url: '/save', data: { refs: ['a', 'b'] } });
    expect(decodeURIComponent(net.requests[0].body)).toBe('refs[]=a&refs[]=b');
    expect(net.requests[0].headers['content-type']).toStartWith('application/x-www-form-urlencoded');

    const file = new Blob(['x'], { type: 'text/plain' });
    Fez.request({ method: 'POST', url: '/upload', data: { asset: { file, name: 'a.txt' } } });
    const body = net.requests[1].body;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('asset[name]')).toBe('a.txt');
    expect(body.get('asset[file]')).toBeInstanceOf(Blob);
    expect(net.requests[1].headers['content-type']).toBeUndefined();
  });

  test('json: true sends a JSON body', () => {
    Fez.request({ method: 'POST', url: '/j', data: { a: [1] }, json: true });
    expect(net.requests[0].body).toBe('{"a":[1]}');
    expect(net.requests[0].headers['content-type']).toBe('application/json');
  });

  test('an error status resolves with the parsed body instead of throwing', async () => {
    const req = Fez.request({ method: 'POST', url: '/api/x' });
    net.requests[0].respond(422, '{"error":{"messages":["Name is required"]}}', { 'Content-Type': 'application/json' });
    const res = await req;
    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
    expect(res.error).toBeUndefined();
    expect(res.data.error.messages).toEqual(['Name is required']);
  });

  test('network failure, timeout and abort resolve with error set', async () => {
    const failed = Fez.request('/a');
    net.requests[0].reject();
    expect(await failed).toMatchObject({ ok: false, status: 0, error: 'network' });

    const slow = Fez.request('/b', { timeout: 5 });
    expect(await slow).toMatchObject({ ok: false, error: 'timeout' });

    const cancelled = Fez.request('/c');
    cancelled.abort();
    expect(await cancelled).toMatchObject({ ok: false, error: 'abort' });
    expect(net.requests[2].aborted).toBe(true);

    const controller = new AbortController();
    const signalled = Fez.request('/d', { signal: controller.signal });
    controller.abort();
    expect(await signalled).toMatchObject({ error: 'abort' });
  });

  test('default headers go to the same origin only', () => {
    globalThis.location = new URL('http://app.test/page');
    Fez.request.headers['x-csrf-token'] = 'tok';

    Fez.request('/local');
    expect(net.requests[0].headers).toMatchObject({ 'x-csrf-token': 'tok', 'x-requested-with': 'XMLHttpRequest' });

    Fez.request({ method: 'PUT', url: 'https://bucket.s3.test/key', data: new Blob(['x']) });
    expect(net.requests[1].headers).toEqual({});

    // a per-call null drops a default header
    Fez.request('/local', { headers: { 'x-csrf-token': null } });
    expect(net.requests[2].headers['x-csrf-token']).toBeUndefined();
  });

  test('onUpload reports progress, and is only attached when asked for', () => {
    const seen = [];
    Fez.request({ method: 'POST', url: '/up', data: new Blob(['abcd']), onUpload: (p) => seen.push(p) });
    net.requests[0].progress(2, 4);
    expect(seen).toEqual([{ loaded: 2, total: 4, percent: 50 }]);

    Fez.request({ method: 'POST', url: '/plain' });
    expect(net.requests[1].xhr.upload.onprogress).toBeUndefined();
  });

  test('GETs are not cached unless cache is given', async () => {
    Fez.request('/n');
    Fez.request('/n');
    expect(net.requests).toHaveLength(2);
  });

  test('a cached GET shares one in-flight request and reuses a success', async () => {
    const a = Fez.request('/c.fez', { cache: 60 });
    const b = Fez.request('/c.fez', { cache: 60 });
    expect(net.requests).toHaveLength(1);
    net.requests[0].respond(200, 'hello');
    expect((await a).data).toBe('hello');
    expect((await b).data).toBe('hello');
    await settle();

    expect((await Fez.request('/c.fez', { cache: 60 })).data).toBe('hello');
    expect(net.requests).toHaveLength(1);

    Fez.request.clearCache();
    Fez.request('/c.fez', { cache: 60 });
    expect(net.requests).toHaveLength(2);
  });

  test('a cached GET that fails is not reused', async () => {
    const a = Fez.request('/flaky', { cache: 60 });
    net.requests[0].reject();
    await a;
    await settle();
    Fez.request('/flaky', { cache: 60 });
    expect(net.requests).toHaveLength(2);
  });
});

describe('Fez.fetch', () => {
  test('caches GETs, never POSTs', async () => {
    const a = Fez.fetch('/x.fez');
    const b = Fez.fetch('/x.fez');
    expect(net.requests).toHaveLength(1);
    net.requests[0].respond(200, 'body');
    expect(await a).toBe('body');
    expect(await b).toBe('body');

    Fez.fetch('POST', '/submit', { name: 'a' });
    Fez.fetch('POST', '/submit', { name: 'a' });
    expect(net.requests).toHaveLength(3);
  });

  test('callback form receives parsed JSON', async () => {
    let got;
    Fez.fetch('/data', { page: 2 }, (data) => (got = data));
    expect(net.requests[0].url).toBe('/data?page=2');
    net.requests[0].respond(200, '{"a":1}', { 'content-type': 'application/json' });
    await settle();
    expect(got).toEqual({ a: 1 });
  });

  test('an error status rejects and is not cached', async () => {
    const first = Fez.fetch('/missing.fez');
    net.requests[0].respond(404, '<h1>404</h1>');
    await expect(first).rejects.toThrow('404 for GET /missing.fez');
    await settle();
    Fez.fetch('/missing.fez').catch(() => {});
    expect(net.requests).toHaveLength(2);
  });
});

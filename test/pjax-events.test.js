// Ported from dux-pjax test/pjax.test.coffee - lifecycle events, debounce and
// form serialization blocks, plus new coverage for fez boot gating.

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import {
  setupPjaxEnv,
  teardownPjaxEnv,
  resetDOM,
  installMockFetch,
  fakeResponse,
  respond,
  settle,
} from './pjax-env.js';
import createPjax from '../src/fez/pjax/pjax.js';
import bootPjax from '../src/fez/pjax/boot.js';
import Fez from '../src/fez/root.js';

let Pjax;

beforeAll(() => {
  setupPjaxEnv();
});

afterAll(async () => {
  // let Pjax.start()'s deferred sendGlobalEvent timers fire while the happy-dom
  // globals still exist, then restore
  await new Promise((resolve) => setTimeout(resolve, 5));
  teardownPjaxEnv();
});

beforeEach(() => {
  resetDOM();
  Pjax = createPjax();
});

describe('Pjax lifecycle events', () => {
  test('emit returns false when listener calls preventDefault', () => {
    const handler = (e) => e.preventDefault();
    document.addEventListener('pjax:before', handler);

    try {
      const result = Pjax.emit('before', { href: '/x' });
      expect(result).toBe(false);
    } finally {
      document.removeEventListener('pjax:before', handler);
    }
  });

  test('emit returns true when no listener prevents', () => {
    expect(Pjax.emit('before', { href: '/x' })).toBe(true);
  });

  test('follows a same-origin redirect in place instead of hard navigating', () => {
    let sent = false;
    let redirected = false;

    const pjax = new Pjax('/dev/login_as?user_hash=abc');
    pjax.sendRequest = () => (sent = true);
    pjax.redirect = () => (redirected = true);
    const res = fakeResponse(302, { Location: '/dev/login_as?_r=1' });
    const html = '';
    pjax.startedAt = Date.now() - 50;
    pjax.handleResponse(res, html);

    expect(sent).toBe(true);
    expect(redirected).toBe(false);
    expect(pjax.href).toBe('/dev/login_as?_r=1');
    expect(pjax.opts.history).toBe('replace');
  });

  test('pjax:render carries error detail on non-200 response', () => {
    let captured = null;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:render', handler);

    try {
      const pjax = new Pjax('/missing');
      const res = fakeResponse(404, {});
      const html = '';
      pjax.startedAt = Date.now() - 50;
      pjax.redirect = () => {};
      pjax.handleResponse(res, html);
      expect(captured.status).toBe(404);
      expect(captured.error).toBe('status');
      expect(captured.to).toBe('/missing');
      expect(captured.mode).toBe('full');
      expect(typeof captured.duration).toBe('number');
    } finally {
      document.removeEventListener('pjax:render', handler);
    }
  });

  test('pjax:render carries ok detail on successful response', () => {
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = () => {};
    window.history.replaceState = () => {};

    let captured = null;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:render', handler);

    try {
      const pjax = new Pjax('/ok');
      pjax.fromHref = '/from-ok';
      const res = fakeResponse(200, {});
      const html = '<main class="pjax" id="pjax"><p>ok</p></main>';
      pjax.startedAt = Date.now() - 50;
      pjax.handleResponse(res, html);
      expect(captured.status).toBe(200);
      expect(captured.error).toBe(null);
      expect(captured.from).toBe('/from-ok');
      expect(captured.to).toBe('/ok');
      expect(captured.mode).toBe('full');
    } finally {
      document.removeEventListener('pjax:render', handler);
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    }
  });

  test('commits history before applying a successful response', () => {
    const originalPush = window.history.pushState;
    window.history.pushState = () => {};

    const calls = [];

    try {
      const pjax = new Pjax('/ordered');
      const res = fakeResponse(200, {});
      const html = '<main class="pjax" id="pjax"><p>ok</p></main>';
      pjax.historyAddCurrent = (href) => calls.push(`history:${href}`);
      pjax.applyLoadedData = () => {
        calls.push('apply');
        return true;
      };

      pjax.handleResponse(res, html);
      expect(calls).toEqual(['history:/ordered', 'apply']);
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('runs response scripts after history has been committed', () => {
    const originalPush = window.history.pushState;
    window.history.pushState = () => {};

    try {
      window.__historyCommittedHref = null;
      window.__scriptSawHistoryHref = null;
      const pjax = new Pjax('/script-path');
      const res = fakeResponse(200, {});
      const html = '<main class="pjax" id="pjax"><script>window.__scriptSawHistoryHref = window.__historyCommittedHref</script><p>ok</p></main>';
      pjax.historyAddCurrent = (href) => (window.__historyCommittedHref = href);

      pjax.handleResponse(res, html);
      expect(window.__scriptSawHistoryHref).toBe('/script-path');
    } finally {
      delete window.__historyCommittedHref;
      delete window.__scriptSawHistoryHref;
      window.history.pushState = originalPush;
    }
  });

  describe('with a mock fetch', () => {
    let mock;
    let captured;
    const onRender = (e) => (captured = e.detail);

    beforeEach(() => {
      mock = installMockFetch();
      captured = null;
      document.addEventListener('pjax:render', onRender);
    });

    afterEach(() => {
      mock.restore();
      document.removeEventListener('pjax:render', onRender);
    });

    test('sendRequest emits pjax:start with from/to/mode/opts', () => {
      let started = null;
      const handler = (e) => (started = e.detail);
      document.addEventListener('pjax:start', handler);

      try {
        Pjax.pastHref = '/from';
        const pjax = new Pjax('/to');
        expect(pjax.sendRequest()).toBe(true);
        expect(started.from).toBe('/from');
        expect(started.to).toBe('/to');
        expect(started.mode).toBe('full');
        expect(started.opts).toBe(pjax.opts);
        expect(started.status).toBe(undefined);
      } finally {
        document.removeEventListener('pjax:start', handler);
      }
    });

    test('pjax:render carries error:network when fetch rejects', async () => {
      const originalError = console.error;
      console.error = () => {};
      Pjax.error = () => {};
      try {
        new Pjax('/dead').sendRequest();
        mock.requests[0].reject(new TypeError('Failed to fetch'));
        await settle();
        expect(captured.error).toBe('network');
        expect(captured.status).toBe(0);
        expect(captured.to).toBe('/dead');
      } finally {
        console.error = originalError;
      }
    });

    test('pjax:render carries error:abort when the request is aborted', async () => {
      new Pjax('/aborted').sendRequest();
      Pjax._abort('full');
      await settle();
      expect(mock.requests[0].aborted).toBe(true);
      expect(captured.error).toBe('abort');
      expect(captured.status).toBe(0);
      expect(captured.to).toBe('/aborted');
    });
  });

  test('commits history before redirecting when response apply fails', () => {
    let pushed = false;
    let redirected = false;
    const originalPush = window.history.pushState;
    window.history.pushState = () => (pushed = true);

    try {
      const pjax = new Pjax('/missing-container');
      const res = fakeResponse(200, {});
      const html = '<main class="pjax" id="other"><p>wrong container</p></main>';
      pjax.redirect = () => (redirected = true);
      pjax.handleResponse(res, html);
      expect(pushed).toBe(true);
      expect(redirected).toBe(true);
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('reports apply error when inline script throws before morph', () => {
    let captured = null;
    let pushed = false;
    let redirected = false;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:render', handler);
    const originalPush = window.history.pushState;
    window.history.pushState = () => (pushed = true);

    const originalError = console.error;
    console.error = () => {};

    try {
      const pjax = new Pjax('/bad-script');
      const res = fakeResponse(200, {});
      const html = '<main class="pjax" id="pjax"><script>throw new Error("boom")</script></main>';
      pjax.redirect = () => (redirected = true);
      pjax.handleResponse(res, html);
      expect(captured.error).toBe('apply');
      expect(captured.status).toBe(200);
      expect(pushed).toBe(true);
      expect(redirected).toBe(true);
    } finally {
      window.history.pushState = originalPush;
      console.error = originalError;
      document.removeEventListener('pjax:render', handler);
    }
  });
});

describe('refresh bypasses debounce', () => {
  test('a same-URL load within 2s is skipped', () => {
    Pjax.before = () => false;
    Pjax._lastLoad = { key: 'full', href: '/same', time: Date.now() };
    const before = Pjax.lastHref;
    expect(new Pjax('/same').load()).toBe(false);
    expect(Pjax.lastHref).toBe(before);
  });

  test('a fresh request ignores the debounce', () => {
    let reachedBefore = false;
    Pjax.before = () => ((reachedBefore = true), false);
    Pjax._lastLoad = { key: 'full', href: '/same', time: Date.now() };
    new Pjax('/same', {}, true).load();
    expect(reachedBefore).toBe(true);
  });

  test('the debounce is keyed per swap node', () => {
    let reachedBefore = false;
    Pjax.before = () => ((reachedBefore = true), false);
    Pjax._lastLoad = { key: 'panel', href: '/', time: Date.now() };
    new Pjax('/').load();
    expect(reachedBefore).toBe(true);
  });
});

describe('Form serialization', () => {
  test('serializes a GET form with native FormData', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <form id="f" action="/submit">
          <input name="name" value="Anna">
          <input name="age" value="33">
        </form>
      </main>
    `;
    const form = document.getElementById('f');
    const { href } = new Pjax('/submit', { form });
    expect(href).toContain('name=Anna');
    expect(href).toContain('age=33');
  });
});

describe('promise result', () => {
  let mock;
  let errors;
  const page = '<main class="pjax" id="pjax"><p>ok</p></main>';

  beforeEach(() => {
    mock = installMockFetch();
    errors = [];
    Pjax.error = (msg) => errors.push(msg);
    Pjax.PjaxOnClick.leave = () => {};
  });

  afterEach(() => {
    mock.restore();
    window.history.replaceState({}, '', '/');
  });

  // redirect() would assign location.href; the instance is not reachable from
  // Pjax.load, so stub it on the prototype for the duration of a test
  const stubRedirect = (fn) => {
    const original = Pjax.prototype.redirect;
    let redirected = 0;
    Pjax.prototype.redirect = () => (redirected++, false);
    return Promise.resolve(fn()).finally(() => (Pjax.prototype.redirect = original)).then(() => redirected);
  };

  test('resolves the pjax:render detail on success', async () => {
    const done = Pjax.load('/ok');
    await respond(mock.requests[0], page);
    const detail = await done;
    expect(detail).toMatchObject({ status: 200, error: null, to: '/ok', mode: 'full' });
  });

  for (const [name, finish, error] of [
    ['a non-200 status', (request) => respond(request, 'nope', 500), 'status'],
    ['a network error', (request) => request.reject(new TypeError('down')), 'network'],
    ['a timeout', () => new Promise((resolve) => setTimeout(resolve, 20)), 'timeout'],
    ['an abort', () => Pjax._abort('full'), 'abort'],
  ]) {
    test(`resolves the detail with error ${error} on ${name}`, async () => {
      const originalError = console.error;
      console.error = () => {};
      Pjax.config.timeout = 5;
      try {
        await stubRedirect(async () => {
          const done = Pjax.load('/fail');
          await finish(mock.requests[0]);
          expect((await done).error).toBe(error);
        });
      } finally {
        console.error = originalError;
      }
    });
  }

  test('resolves once across a same-origin redirect', async () => {
    const done = Pjax.load('/start');
    await respond(mock.requests[0], '', 302, { Location: '/landed' });
    expect(mock.requests).toHaveLength(2);
    expect(mock.requests[1].url).toBe('/landed');
    await respond(mock.requests[1], page);
    const detail = await done;
    expect(detail.status).toBe(200);
    expect(detail.to).toBe('/landed');
  });

  test('resolves null when debounced', async () => {
    Pjax.load('/twice');
    expect(await Pjax.load('/twice')).toBeNull();
  });

  test('resolves null when before() cancels', async () => {
    Pjax.before = () => false;
    expect(await Pjax.load('/blocked')).toBeNull();
    expect(mock.requests).toHaveLength(0);
  });

  test('resolves null when paths_to_skip hands off to a full navigation', async () => {
    Pjax.config.paths_to_skip = ['/admin'];
    const redirected = await stubRedirect(async () => {
      expect(await Pjax.load('/admin/users')).toBeNull();
    });
    expect(redirected).toBe(1);
    expect(mock.requests).toHaveLength(0);
  });

  test('resolves null and sends nothing when pjax:start is prevented', async () => {
    const cancel = (e) => e.preventDefault();
    document.addEventListener('pjax:start', cancel);
    try {
      expect(await Pjax.load('/cancelled')).toBeNull();
      expect(mock.requests).toHaveLength(0);
    } finally {
      document.removeEventListener('pjax:start', cancel);
    }
  });

  test('a throwing before() resolves null and never rejects', async () => {
    let rejections = 0;
    const onRejection = () => rejections++;
    process.on('unhandledRejection', onRejection);
    Pjax.before = () => {
      throw new Error('hook broke');
    };
    try {
      expect(await Pjax.load('/hook')).toBeNull();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(rejections).toBe(0);
      expect(errors[0]).toContain('hook broke');
    } finally {
      process.off('unhandledRejection', onRejection);
    }
  });

  test('a throwing after() resolves the apply error detail', async () => {
    const originalError = console.error;
    console.error = () => {};
    Pjax.after = () => {
      throw new Error('after broke');
    };
    try {
      await stubRedirect(async () => {
        const done = Pjax.load('/after');
        await respond(mock.requests[0], page);
        expect((await done).error).toBe('apply');
      });
      expect(errors[0]).toContain('after broke');
    } finally {
      console.error = originalError;
    }
  });
});

describe('fez boot gating', () => {
  test('page without a pjax container gets Fez.pjax but no handlers', () => {
    document.body.innerHTML = '<main id="main"><a href="/somewhere">Link</a></main>';
    bootPjax();

    expect(Fez.pjax).toBeDefined();
    expect(Fez.pjax._booted).toBeUndefined();
    expect(Fez.pjax._clickBound).toBeUndefined();
  });

  test('page with a pjax container boots handlers', () => {
    bootPjax();

    expect(Fez.pjax._booted).toBe(true);
    expect(Fez.pjax._clickBound).toBe(true);
  });

  test('window.Pjax stays undefined', () => {
    delete window.Pjax;
    bootPjax();
    expect(window.Pjax).toBeUndefined();
  });

  test('the Fez shortcuts delegate to the current Fez.pjax', () => {
    bootPjax();
    const calls = [];
    const names = ['load', 'refresh', 'qs', 'hash', 'hpath', 'hqs'];
    const stub = Object.fromEntries(names.map((name) => [name, (...args) => (calls.push([name, ...args]), name)]));
    const original = Fez.pjax;
    Fez.pjax = stub;
    try {
      for (const name of names) {
        expect(Fez[name]('a', { b: 1 })).toBe(name);
      }
    } finally {
      Fez.pjax = original;
    }
    expect(calls).toEqual(names.map((name) => [name, 'a', { b: 1 }]));
  });

  test('Fez.pjax.start can be called manually for late-injected containers', () => {
    document.body.innerHTML = '<main id="main">no container yet</main>';
    bootPjax();
    expect(Fez.pjax._booted).toBeUndefined();

    document.body.innerHTML = '<main class="pjax" id="pjax"></main>';
    Fez.pjax.start();
    expect(Fez.pjax._booted).toBe(true);
  });
});

// Ported from dux-pjax test/pjax.test.coffee - lifecycle events, debounce and
// form serialization blocks, plus new coverage for fez boot gating.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { setupPjaxEnv, teardownPjaxEnv, resetDOM } from './pjax-env.js';
import createPjax from '../src/fez/pjax/pjax.js';
import bootPjax from '../src/fez/pjax/boot.js';

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

    const pjax = new Pjax({ path: '/dev/login_as?user_hash=abc' });
    pjax.sendRequest = () => (sent = true);
    pjax.redirect = () => (redirected = true);
    pjax.req = {
      status: 302,
      getResponseHeader: (name) => (name === 'Location' ? '/dev/login_as?_r=1' : null),
    };
    pjax.opts.req_start_time = Date.now() - 50;
    pjax.handleResponse();

    expect(sent).toBe(true);
    expect(redirected).toBe(false);
    expect(pjax.href).toBe('/dev/login_as?_r=1');
    expect(pjax.opts.replace).toBe(true);
  });

  test('pjax:render carries error detail on non-200 response', () => {
    let captured = null;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:render', handler);

    try {
      const pjax = new Pjax({ path: '/missing' });
      pjax.req = {
        status: 404,
        getResponseHeader: () => null,
      };
      pjax.opts.req_start_time = Date.now() - 50;
      pjax.redirect = () => {};
      pjax.handleResponse();
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
      const pjax = new Pjax({ path: '/ok' });
      pjax.fromHref = '/from-ok';
      pjax.req = {
        status: 200,
        responseText: '<main class="pjax" id="pjax"><p>ok</p></main>',
        getResponseHeader: () => null,
        responseURL: '',
      };
      pjax.opts.req_start_time = Date.now() - 50;
      pjax.handleResponse();
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

  test('pjax:render to uses replacePath when history uses replacePath', () => {
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = () => {};
    window.history.replaceState = () => {};

    let captured = null;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:render', handler);

    try {
      const pjax = new Pjax({ path: '/internal', replacePath: '/visible' });
      pjax.fromHref = '/before';
      pjax.req = {
        status: 200,
        responseText: '<main class="pjax" id="pjax"><p>ok</p></main>',
        getResponseHeader: () => null,
        responseURL: '',
      };
      pjax.opts.req_start_time = Date.now() - 50;
      pjax.handleResponse();
      expect(captured.from).toBe('/before');
      expect(captured.to).toBe('/visible');
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
      const pjax = new Pjax({ path: '/ordered' });
      pjax.req = {
        status: 200,
        responseText: '<main class="pjax" id="pjax"><p>ok</p></main>',
        getResponseHeader: () => null,
        responseURL: '',
      };
      pjax.historyAddCurrent = (href) => calls.push(`history:${href}`);
      pjax.applyLoadedData = () => {
        calls.push('apply');
        return true;
      };

      pjax.handleResponse();
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
      const pjax = new Pjax({ path: '/script-path' });
      pjax.req = {
        status: 200,
        responseText:
          '<main class="pjax" id="pjax"><script>window.__scriptSawHistoryHref = window.__historyCommittedHref</script><p>ok</p></main>',
        getResponseHeader: () => null,
        responseURL: '',
      };
      pjax.historyAddCurrent = (href) => (window.__historyCommittedHref = href);

      pjax.handleResponse();
      expect(window.__scriptSawHistoryHref).toBe('/script-path');
    } finally {
      delete window.__historyCommittedHref;
      delete window.__scriptSawHistoryHref;
      window.history.pushState = originalPush;
    }
  });

  test('sendRequest emits pjax:start with from/to/mode/opts', () => {
    let captured = null;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:start', handler);

    const OrigXHR = global.XMLHttpRequest;
    class MockXHR {
      open() {}
      setRequestHeader() {}
      send() {}
    }
    global.XMLHttpRequest = MockXHR;

    try {
      Pjax.pastHref = '/from';
      const pjax = new Pjax({ path: '/to' });
      pjax.sendRequest();
      expect(captured.from).toBe('/from');
      expect(captured.to).toBe('/to');
      expect(captured.mode).toBe('full');
      expect(captured.opts).toBe(pjax.opts);
      expect(captured.status).toBe(undefined);
    } finally {
      global.XMLHttpRequest = OrigXHR;
      document.removeEventListener('pjax:start', handler);
    }
  });

  test('pjax:render carries error:network when XHR onerror fires', () => {
    let captured = null;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:render', handler);

    const OrigXHR = global.XMLHttpRequest;
    let capturedXHR = null;
    class MockXHR {
      constructor() {
        capturedXHR = this;
      }
      open() {}
      setRequestHeader() {}
      send() {}
    }
    global.XMLHttpRequest = MockXHR;

    const originalError = console.error;
    console.error = () => {};

    try {
      const pjax = new Pjax({ path: '/dead' });
      pjax.sendRequest();
      capturedXHR.onerror(new Error('boom'));
      expect(captured.error).toBe('network');
      expect(captured.status).toBe(0);
      expect(captured.to).toBe('/dead');
    } finally {
      global.XMLHttpRequest = OrigXHR;
      console.error = originalError;
      document.removeEventListener('pjax:render', handler);
    }
  });

  test('pjax:render carries error:abort when XHR onabort fires', () => {
    let captured = null;
    const handler = (e) => (captured = e.detail);
    document.addEventListener('pjax:render', handler);

    const OrigXHR = global.XMLHttpRequest;
    let capturedXHR = null;
    class MockXHR {
      constructor() {
        capturedXHR = this;
      }
      open() {}
      setRequestHeader() {}
      send() {}
    }
    global.XMLHttpRequest = MockXHR;

    try {
      const pjax = new Pjax({ path: '/aborted' });
      pjax.sendRequest();
      capturedXHR.onabort();
      expect(captured.error).toBe('abort');
      expect(captured.status).toBe(0);
      expect(captured.to).toBe('/aborted');
    } finally {
      global.XMLHttpRequest = OrigXHR;
      document.removeEventListener('pjax:render', handler);
    }
  });

  test('commits history before redirecting when response apply fails', () => {
    let pushed = false;
    let redirected = false;
    const originalPush = window.history.pushState;
    window.history.pushState = () => (pushed = true);

    try {
      const pjax = new Pjax({ path: '/missing-container' });
      pjax.req = {
        status: 200,
        responseText: '<main class="pjax" id="other"><p>wrong container</p></main>',
        getResponseHeader: () => null,
        responseURL: '',
      };
      pjax.redirect = () => (redirected = true);
      pjax.handleResponse();
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
      const pjax = new Pjax({ path: '/bad-script' });
      pjax.req = {
        status: 200,
        responseText: '<main class="pjax" id="pjax"><script>throw new Error("boom")</script></main>',
        getResponseHeader: () => null,
        responseURL: '',
      };
      pjax.redirect = () => (redirected = true);
      pjax.handleResponse();
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

  test('opts.replace forces replaceState instead of pushState', () => {
    let pushed = null;
    let replaced = null;
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = (s, t, url) => (pushed = url);
    window.history.replaceState = (s, t, url) => (replaced = url);

    try {
      Pjax._lastHrefCheck = '/something-else';
      const pjax = new Pjax({ path: '/replace-target', replace: true });
      pjax.historyAddCurrent('/replace-target');
      expect(replaced).toBe('/replace-target');
      expect(pushed).toBeNull();
    } finally {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    }
  });
});

describe('Pjax.refresh and Pjax.reload bypass debounce', () => {
  test('instance load skips debounce when opts.force is true', () => {
    Pjax.before = () => false;
    Pjax.lastHref = '/same';
    Pjax._lastLoadTime = Date.now();
    const pjax = new Pjax({ path: '/same', force: true });
    const result = pjax.load();
    expect(result).not.toBe(false);
    expect(Pjax.lastHref).toBe('/same');
  });

  test('instance load still debounces when opts.force is unset', () => {
    Pjax.before = () => false;
    Pjax.lastHref = '/same';
    Pjax._lastLoadTime = Date.now();
    const pjax = new Pjax({ path: '/same' });
    const result = pjax.load();
    expect(result).toBe(false);
  });

  test('refresh adds force flag', () => {
    let fetched = null;
    Pjax.fetch = (opts) => (fetched = opts);
    Pjax.refresh();
    expect(fetched.force).toBe(true);
  });

  test('reload adds force flag', () => {
    let fetched = null;
    Pjax.fetch = (opts) => (fetched = opts);
    Pjax.reload();
    expect(fetched.force).toBe(true);
  });
});

describe('Form serialization', () => {
  test('getOpts serializes form with native FormData', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <form id="f" action="/submit">
          <input name="name" value="Anna">
          <input name="age" value="33">
        </form>
      </main>
    `;
    const form = document.getElementById('f');
    const opts = Pjax.getOpts('/submit', { form });
    expect(opts.path).toContain('name=Anna');
    expect(opts.path).toContain('age=33');
  });
});

describe('fez boot gating', () => {
  beforeEach(() => {
    window.Pjax = undefined;
  });

  test('page without a pjax container gets window.Pjax but no handlers', () => {
    document.body.innerHTML = '<main id="main"><a href="/somewhere">Link</a></main>';
    bootPjax();

    expect(window.Pjax).toBeDefined();
    expect(window.Pjax._booted).toBeUndefined();
    expect(window.Pjax._clickBound).toBeUndefined();
  });

  test('page with a pjax container boots handlers', () => {
    bootPjax();

    expect(window.Pjax).toBeDefined();
    expect(window.Pjax._booted).toBe(true);
    expect(window.Pjax._clickBound).toBe(true);
  });

  test('does not overwrite an existing window.Pjax', () => {
    const existing = { marker: true };
    window.Pjax = existing;
    bootPjax();
    expect(window.Pjax).toBe(existing);
  });

  test('Pjax.start can be called manually for late-injected containers', () => {
    document.body.innerHTML = '<main id="main">no container yet</main>';
    bootPjax();
    expect(window.Pjax._booted).toBeUndefined();

    document.body.innerHTML = '<main class="pjax" id="pjax"></main>';
    window.Pjax.start();
    expect(window.Pjax._booted).toBe(true);
  });
});

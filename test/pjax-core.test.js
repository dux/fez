// Ported from dux-pjax test/pjax.test.coffee - "Pjax module" describe block.

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import {
  setupPjaxEnv,
  teardownPjaxEnv,
  resetDOM,
  installMockFetch,
  respond,
  settle,
} from './pjax-env.js';
import createPjax from '../src/fez/pjax/pjax.js';
import { runScripts, runHeadScripts } from '../src/fez/pjax/scripts.js';
import Fez from '../src/fez/root.js';

let Pjax;

const nodeFrom = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
};

beforeAll(() => {
  setupPjaxEnv();
});

afterAll(() => {
  teardownPjaxEnv();
});

beforeEach(() => {
  resetDOM();
  Pjax = createPjax();
});

describe('Pjax module', () => {
  test('has expected config and a fresh class per createPjax call', () => {
    expect(Pjax.config.ajax_selector).toBe('.ajax');
    expect(createPjax()).not.toBe(Pjax);
  });

  test('source inside a .ajax region resolves the region', () => {
    const ajaxNode = document.getElementById('ajax-node');
    const link = ajaxNode.querySelector('a');
    const pjax = new Pjax('?foo=bar', { source: link });
    expect(pjax.region).toBe(ajaxNode);
    expect(pjax.opts.scroll).toBe(false);
    expect(pjax.href).toBe('/dialog?foo=bar');
    expect(pjax.swapMode()).toBe('ajax');
  });

  test('executes inline scripts through runScripts', () => {
    window.__pjaxTestCounter = 0;
    runScripts(nodeFrom('<div><script>window.__pjaxTestCounter += 1</script></div>'));
    expect(window.__pjaxTestCounter).toBe(1);
  });

  test('compiles fez loaders from a fetched head, outside the pjax region', () => {
    const root = document.createElement('div');

    const loader = document.createElement('script');
    loader.setAttribute('fez', 'fez/ui-clock.fez');
    root.appendChild(loader);

    const definition = document.createElement('template');
    definition.setAttribute('fez', 'ui-inline');
    definition.innerHTML = '<p>inline</p>';
    root.appendChild(definition);

    const inline = document.createElement('script');
    inline.textContent = 'window.__headRan = true';
    root.appendChild(inline);

    const pjaxBody = document.createElement('main');
    pjaxBody.id = 'pjax';
    pjaxBody.innerHTML = '<script fez="fez/ui-in-body.fez"></script>';
    root.appendChild(pjaxBody);

    const compiled = [];
    const original = Fez.compile;
    Fez.compile = (node) => compiled.push(node.getAttribute('fez'));

    try {
      runHeadScripts(root, pjaxBody, Pjax.error);
    } finally {
      Fez.compile = original;
    }

    // the body loader is left to the morph + MutationObserver
    expect(compiled).toEqual(['fez/ui-clock.fez', 'ui-inline']);
    expect(window.__headRan).toBe(true);
    delete window.__headRan;
  });

  test('a failing head component is reported, not thrown at the swap', () => {
    const root = document.createElement('div');
    for (const name of ['ui-bad', 'ui-good']) {
      const template = document.createElement('template');
      template.setAttribute('fez', name);
      root.appendChild(template);
    }

    const original = Fez.compile;
    const originalError = console.error;
    const compileAttempts = [];
    Fez.compile = (node) => {
      compileAttempts.push(node.getAttribute('fez'));
      if (node.getAttribute('fez') === 'ui-bad') {
        throw new Error('boom');
      }
    };
    console.error = () => {};

    try {
      expect(() => runHeadScripts(root, null, () => {})).not.toThrow();
    } finally {
      Fez.compile = original;
      console.error = originalError;
    }

    expect(compileAttempts).toEqual(['ui-bad', 'ui-good']);
  });

  test('refreshes a targeted node when selector passed', () => {
    const target = document.createElement('div');
    target.id = 'some-div';
    target.innerHTML = 'Old content';
    document.getElementById('pjax').appendChild(target);

    const response = `
      <main class="pjax" id="pjax">
        <div id="some-div">New content</div>
      </main>
    `;

    const { href, opts } = Pjax.getOpts('#some-div');
    const pjax = new Pjax(href, opts, true);
    pjax.response = response;
    pjax.applyLoadedData();

    expect(document.getElementById('some-div').innerHTML).toBe('New content');
  });

  test('returns last href or current path from last()', () => {
    const originalPath = Pjax.path;
    Pjax.path = () => '/current';

    try {
      Pjax.lastHref = undefined;
      expect(Pjax.last()).toBe('/current');

      Pjax.lastHref = '/previous';
      expect(Pjax.last()).toBe('/previous');
    } finally {
      Pjax.path = originalPath;
    }
  });

  test('detects page refresh vs navigation via refreshed()', () => {
    expect(Pjax.refreshed()).toBe(false);

    Pjax.pastHref = '/page1';
    Pjax.lastHref = '/page2';
    expect(Pjax.refreshed()).toBe(false);

    Pjax.pastHref = '/page1';
    Pjax.lastHref = '/page1';
    expect(Pjax.refreshed()).toBe(true);
  });

  test('dispatches pjax:render custom event via sendGlobalEvent', () => {
    let fired = false;
    const handler = () => (fired = true);
    document.addEventListener('pjax:render', handler);

    try {
      Pjax.sendGlobalEvent();
      expect(fired).toBe(true);
    } finally {
      document.removeEventListener('pjax:render', handler);
    }
  });

  test('skips external scripts in runScripts', () => {
    window.__externalTest = 0;
    const html = '<div><script src="external.js">window.__externalTest = 1</script></div>';
    runScripts(nodeFrom(html));
    expect(window.__externalTest).toBe(0);
  });

  test('defers scripts with pjax-delay attribute via requestAnimationFrame', () => {
    window.__delayTest = 0;
    const html = '<div><script pjax-delay>window.__delayTest = 1</script></div>';
    runScripts(nodeFrom(html));
    // requestAnimationFrame is sync in test env, so it runs immediately
    expect(window.__delayTest).toBe(1);
  });

  test('handles target as string selector in getOpts', () => {
    const node = document.getElementById('ajax-node');
    const { href, opts } = Pjax.getOpts('/test', { target: '#ajax-node' });
    expect(href).toBe('/test');
    expect(opts.target).toBe(node);
    expect(new Pjax(href, opts).opts.scroll).toBe(false);
  });

  test('binds click handler only once via onDocumentClick', () => {
    Pjax._clickBound = undefined;

    Pjax.onDocumentClick();
    expect(Pjax._clickBound).toBe(true);

    Pjax.onDocumentClick();
    expect(Pjax._clickBound).toBe(true);
  });

  test('pushes state to history via pushState', () => {
    const originalPushState = window.history.pushState;
    let pushed = null;
    window.history.pushState = (state, title, url) => (pushed = url);

    try {
      Pjax.pushState('/new-path');
      expect(pushed).toBe('/new-path');
    } finally {
      window.history.pushState = originalPushState;
    }
  });

  test('setPageBody updates title and container innerHTML', () => {
    const node = document.createElement('div');
    node.innerHTML = '<title>New Title</title><main class="pjax" id="pjax"><p>New body</p></main>';
    let afterCalled = false;
    Pjax.after = () => (afterCalled = true);

    Pjax.setPageBody(node, '/test');

    expect(document.title).toBe('New Title');
    expect(document.getElementById('pjax').innerHTML).toContain('New body');
    expect(afterCalled).toBe(true);
  });

  // --- getOpts additional branches ---

  test('getOpts rejects a function or a plain object as the first argument', () => {
    const errs = [];
    Pjax.error = (msg) => errs.push(msg);
    expect(Pjax.getOpts(() => {})).toBeNull();
    expect(Pjax.getOpts({ path: '/foo' })).toBeNull();
    expect(errs).toHaveLength(2);
    expect(errs[0]).toContain('load expects a URL');
  });

  test('prepends pathname for query-only href without a region', () => {
    expect(new Pjax('?search=hello').href).toBe(location.pathname + '?search=hello');
  });

  test('skips the region when a parent has no_ajax_class', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <div class="no-ajax">
          <div class="ajax" id="inner-ajax">
            <a href="/link" id="skip-link">Link</a>
          </div>
        </div>
      </main>
    `;
    const link = document.getElementById('skip-link');
    const pjax = new Pjax('/test', { source: link });
    expect(pjax.region).toBeUndefined();
    expect(pjax.swapMode()).toBe('full');
  });

  test('uses path attribute as fallback for data-path on the region', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <div class="ajax" id="path-ajax" path="/alt-path">
          <a href="/x" id="path-link">Link</a>
        </div>
      </main>
    `;
    const link = document.getElementById('path-link');
    expect(new Pjax('?q=1', { source: link }).href).toBe('/alt-path?q=1');
  });

  // --- shouldSkipScroll ---

  test('shouldSkipScroll returns true when node matches no_scroll_selector', () => {
    const div = document.createElement('div');
    div.className = 'no-scroll';
    document.body.appendChild(div);
    const span = document.createElement('span');
    div.appendChild(span);

    expect(Pjax.shouldSkipScroll(span)).toBe(true);
  });

  test('shouldSkipScroll returns false when node does not match', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(Pjax.shouldSkipScroll(div)).toBe(false);
  });

  test('shouldSkipScroll handles null node gracefully', () => {
    expect(Pjax.shouldSkipScroll(null)).toBeUndefined();
    expect(Pjax.shouldSkipScroll(undefined)).toBeUndefined();
  });

  // --- scrollLock ---

  test('scrollLock debounces calls within 1 second', () => {
    Pjax._scrollLockTime = undefined;
    Pjax.scrollLock();
    const firstTime = Pjax._scrollLockTime;
    expect(typeof firstTime).toBe('number');

    Pjax.scrollLock();
    expect(Pjax._scrollLockTime).toBe(firstTime);
  });

  // --- runScripts edge cases ---

  test('runScripts skips non-javascript type scripts', () => {
    window.__jsonTest = 0;
    runScripts(nodeFrom('<div><script type="application/json">window.__jsonTest = 1</script></div>'));
    expect(window.__jsonTest).toBe(0);
  });

  test('runScripts removes the scripts it ran and keeps the rest', () => {
    const node = nodeFrom(
      '<p>a</p><script>void 0</script><script type="application/json">{}</script>' +
        '<script src="x.js"></script><script fez="ui-x.fez"></script>',
    );
    expect(runScripts(node)).toBe(node);
    expect(Array.from(node.querySelectorAll('script'), (el) => el.outerHTML)).toEqual([
      '<script type="application/json">{}</script>',
      '<script src="x.js"></script>',
      '<script fez="ui-x.fez"></script>',
    ]);
    expect(node.querySelector('p').textContent).toBe('a');
  });

  for (const method of ['qs', 'hash']) {
    describe(`${method} URL state`, () => {
      beforeEach(() => {
        window.history.replaceState({}, '', '/catalog?keep=query#keep=hash');
        Pjax.load = () => {
          throw new Error('URL state must not fetch');
        };
      });

      afterEach(() => {
        window.history.replaceState({}, '', '/');
      });

      test('reads without changing the URL or history', () => {
        const length = window.history.length;
        expect(Pjax[method]('keep')).toBe(method === 'qs' ? 'query' : 'hash');
        expect(Pjax[method]('missing')).toBeUndefined();
        expect(location.href).toBe('http://localhost/catalog?keep=query#keep=hash');
        expect(window.history.length).toBe(length);
      });

      test('pushes by default and preserves the other URL section and parameters', () => {
        const length = window.history.length;
        Pjax[method]('tab', 'settings');
        expect(location.href).toBe(
          method === 'qs'
            ? 'http://localhost/catalog?keep=query&tab=settings#keep=hash'
            : 'http://localhost/catalog?keep=query#keep=hash&tab=settings',
        );
        expect(window.history.length).toBe(length + 1);
        expect(Pjax[method]('tab')).toBe('settings');
      });

      test('replace updates the URL without adding history', () => {
        const length = window.history.length;
        Pjax[method]('keep', 'updated', { replace: true });
        expect(Pjax[method]('keep')).toBe('updated');
        expect(window.history.length).toBe(length);
      });

      test('href returns a URL without writing, even with replace', () => {
        const length = window.history.length;
        for (const opts of [{ href: true }, { href: true, replace: true }]) {
          expect(Pjax[method]('keep', 'preview', opts)).toBe(
            method === 'qs'
              ? '/catalog?keep=preview#keep=hash'
              : '/catalog?keep=query#keep=preview',
          );
        }
        expect(location.href).toBe('http://localhost/catalog?keep=query#keep=hash');
        expect(window.history.length).toBe(length);
      });

      test('round-trips reserved characters, Unicode, empty strings and zero', () => {
        for (const value of ['a b+c&d=e#f?%/\u017e', '', 0]) {
          Pjax[method]('a &+=#', value);
          expect(Pjax[method]('a &+=#')).toBe(String(value));
        }
      });

      test('decodes encoded keys, plus spaces, and values containing equals', () => {
        window.history.replaceState({}, '', '/?a+b=c+d=e#a+b=c+d=e');
        expect(Pjax[method]('a b')).toBe('c d=e');
      });

      test('updating a repeated key keeps one value and preserves unrelated duplicates', () => {
        window.history.replaceState({}, '', '/?k=1&k=2&x=a&x=b#k=1&k=2&x=a&x=b');
        Pjax[method]('k', '3');
        expect(location[method === 'qs' ? 'search' : 'hash'].slice(1)).toBe('k=3&x=a&x=b');
      });

      for (const value of [null, false]) {
        test(`removes an existing key with ${value}, including the last delimiter`, () => {
          Pjax[method]('keep', value);
          expect(Pjax[method]('keep')).toBeUndefined();
          expect(location.href).toBe(
            method === 'qs'
              ? 'http://localhost/catalog#keep=hash'
              : 'http://localhost/catalog?keep=query',
          );
        });
      }
    });
  }

  describe('hash route state', () => {
    beforeEach(() => {
      window.history.replaceState({}, '', '/catalog#/traffic?app=x&range=24h');
      Pjax.load = () => {
        throw new Error('URL state must not fetch');
      };
    });

    afterEach(() => {
      window.history.replaceState({}, '', '/');
    });

    test('hpath reads the last path segment without changing the URL', () => {
      const length = window.history.length;
      expect(Pjax.hpath()).toBe('traffic');
      expect(location.href).toBe('http://localhost/catalog#/traffic?app=x&range=24h');
      expect(window.history.length).toBe(length);
    });

    test('hpath reads nested segments and treats slashless fragments as non-routes', () => {
      for (const [fragment, expected] of [
        ['#/foo', 'foo'],
        ['#foo/bar', 'bar'],
        ['#/foo/bar', 'bar'],
        ['#/', ''],
        ['#foo', ''],
        ['#a=b', ''],
      ]) {
        window.history.replaceState({}, '', `/catalog${fragment}`);
        expect(Pjax.hpath()).toBe(expected);
      }
    });

    test('hqs reads a route query param only on a route fragment', () => {
      expect(Pjax.hqs('app')).toBe('x');
      expect(Pjax.hqs('missing')).toBeUndefined();
      window.history.replaceState({}, '', '/catalog#anchor');
      expect(Pjax.hqs('app')).toBeUndefined();
      window.history.replaceState({}, '', '/catalog#app=x');
      expect(Pjax.hqs('app')).toBeUndefined();
    });

    test('hpath pushes a canonical route and preserves the query', () => {
      const length = window.history.length;
      Pjax.hpath('logs');
      expect(location.href).toBe('http://localhost/catalog#/logs?app=x&range=24h');
      expect(window.history.length).toBe(length + 1);
      expect(Pjax.hpath()).toBe('logs');
    });

    test('hpath replaces the query and accepts href', () => {
      expect(Pjax.hpath('logs', { qs: { app: 'y' }, href: true })).toBe('/catalog#/logs?app=y');
      expect(location.hash).toBe('#/traffic?app=x&range=24h');
      Pjax.hpath('logs', { qs: { app: 'y' } });
      expect(location.hash).toBe('#/logs?app=y');
    });

    test('hpath clears the route', () => {
      Pjax.hpath('');
      expect(location.hash).toBe('');
    });

    test('hqs pushes and preserves the route path', () => {
      const length = window.history.length;
      Pjax.hqs('app', 'z');
      expect(location.href).toBe('http://localhost/catalog#/traffic?app=z&range=24h');
      expect(window.history.length).toBe(length + 1);
    });

    test('hqs keeps a nested path prefix verbatim', () => {
      window.history.replaceState({}, '', '/catalog#ns/traffic?app=x');
      Pjax.hqs('app', 'y');
      expect(location.hash).toBe('#ns/traffic?app=y');
    });

    test('hqs removes a param and drops the empty query', () => {
      window.history.replaceState({}, '', '/catalog#/traffic?app=x');
      Pjax.hqs('app', null);
      expect(location.hash).toBe('#/traffic');
    });

    test('hqs is a no-op on a non-route fragment', () => {
      window.history.replaceState({}, '', '/catalog#anchor');
      expect(Pjax.hqs('app', 'y')).toBeUndefined();
      expect(location.hash).toBe('#anchor');
    });

    test('hash() is unchanged for parameter fragments', () => {
      window.history.replaceState({}, '', '/catalog#tab=settings');
      expect(Pjax.hash('tab')).toBe('settings');
      expect(Pjax.hpath()).toBe('');
    });
  });

  // --- applyLoadedData ---

  test('applyLoadedData in ajax_node mode replaces container and sets data-path', () => {
    const ajaxNode = document.getElementById('ajax-node');
    const pjax = new Pjax('/new-dialog', { source: ajaxNode });
    pjax.response = '<div id="ajax-node"><p>Updated ajax</p></div>';
    pjax.applyLoadedData();

    expect(ajaxNode.innerHTML).toContain('Updated ajax');
    expect(ajaxNode.getAttribute('data-path')).toBe('/new-dialog');
  });

  test('applyLoadedData in ajax_node mode uses full response when no matching id', () => {
    const ajaxNode = document.getElementById('ajax-node');
    const pjax = new Pjax('/fallback', { source: ajaxNode });
    pjax.response = '<p>Full response fallback</p>';
    pjax.applyLoadedData();

    expect(ajaxNode.innerHTML).toContain('Full response fallback');
  });

  test('applyLoadedData matches target ids containing selector metacharacters', () => {
    const target = document.createElement('div');
    target.id = 'user:42.panel';
    target.innerHTML = 'Old';
    document.getElementById('pjax').appendChild(target);

    const pjax = new Pjax('/special-id', { target });
    pjax.response = '<main class="pjax" id="pjax"><div id="user:42.panel">New</div></main>';
    const result = pjax.applyLoadedData();

    expect(result).toBe(true);
    expect(target.innerHTML).toBe('New');
  });

  test('applyLoadedData in full swap mode stores response by destination href', () => {
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = () => {};
    window.history.replaceState = () => {};

    try {
      const response = '<title>Stored</title><main class="pjax" id="pjax"><p>Cached</p></main>';
      const pjax = new Pjax('/cached-page');
      pjax.response = response;
      pjax.applyLoadedData();
      expect(Pjax.historyData['/cached-page'].html).toBe(response);
    } finally {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    }
  });

  // --- historyAddCurrent ---

  test('historyAddCurrent skips when history is false', () => {
    let pushCalled = false;
    const originalPush = window.history.pushState;
    window.history.pushState = () => (pushCalled = true);

    try {
      const pjax = new Pjax('/skip', { history: false });
      pjax.historyAddCurrent('/skip');
      expect(pushCalled).toBe(false);
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('historyAddCurrent skips for a region swap by default', () => {
    let pushCalled = false;
    const originalPush = window.history.pushState;
    window.history.pushState = () => (pushCalled = true);

    try {
      const ajaxNode = document.getElementById('ajax-node');
      const pjax = new Pjax('/ajax', { source: ajaxNode });
      pjax.historyAddCurrent('/ajax');
      expect(pushCalled).toBe(false);
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('historyAddCurrent replaces when the URL does not change', () => {
    window.history.replaceState({}, '', '/same-page');
    let replaced = null;
    let pushed = null;
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = (s, t, url) => (pushed = url);
    window.history.replaceState = (s, t, url) => (replaced = url);

    try {
      const pjax = new Pjax('/same-page');
      pjax.historyAddCurrent('/same-page');
      expect(replaced).toBe('/same-page');
      expect(pushed).toBeNull();
    } finally {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      window.history.replaceState({}, '', '/');
    }
  });

  test('historyAddCurrent uses pushState on new href', () => {
    let pushed = null;
    const originalPush = window.history.pushState;
    window.history.pushState = (s, t, url) => (pushed = url);

    try {
      const pjax = new Pjax('/new-page');
      pjax.historyAddCurrent('/new-page');
      expect(pushed).toBe('/new-page');
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('history: replace forces replaceState on a new href', () => {
    let pushed = null;
    let replaced = null;
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = (s, t, url) => (pushed = url);
    window.history.replaceState = (s, t, url) => (replaced = url);

    try {
      const pjax = new Pjax('/replace-target', { history: 'replace' });
      pjax.historyAddCurrent('/replace-target');
      expect(replaced).toBe('/replace-target');
      expect(pushed).toBeNull();
    } finally {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    }
  });

  // --- instance load() ---

  test('an empty href loads the current URL', () => {
    expect(new Pjax('').href).toBe(Pjax.path());
  });

  test('instance load sends nothing when before() returns false', () => {
    Pjax.before = () => false;
    const pjax = new Pjax('/blocked');
    expect(pjax.load()).toBe(false);
  });

  test('instance load tracks pastHref and lastHref', () => {
    Pjax.lastHref = '/previous';
    Pjax.before = () => false;
    const pjax = new Pjax('/current');
    pjax.load();
    expect(Pjax.pastHref).toBe('/previous');
    expect(Pjax.lastHref).toBe('/current');
  });

  test('instance load redirects for paths_to_skip string match', () => {
    Pjax.config.paths_to_skip = ['/admin'];
    let redirected = false;
    const pjax = new Pjax('/admin/users');
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load redirects for paths_to_skip regex match', () => {
    Pjax.config.paths_to_skip = [/^\/api/];
    let redirected = false;
    const pjax = new Pjax('/api/v1/data');
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load redirects for paths_to_skip function match', () => {
    Pjax.config.paths_to_skip = [(href) => href.includes('skip')];
    let redirected = false;
    const pjax = new Pjax('/please-skip-this');
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load redirects for URLs with http prefix', () => {
    let redirected = false;
    const pjax = new Pjax('https://example.com');
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  describe('requests', () => {
    let mock;

    beforeEach(() => {
      mock = installMockFetch();
    });

    afterEach(() => {
      mock.restore();
      window.history.replaceState({}, '', '/');
    });

    test('a fresh request sends pjax headers and no-cache', () => {
      new Pjax('/headers-test', {}, true).load();
      expect(mock.requests[0]).toMatchObject({
        url: '/headers-test',
        method: 'GET',
        headers: { 'x-requested-with': 'XMLHttpRequest', 'cache-control': 'no-cache' },
      });
      expect(Pjax.requests.get('full')).toBeInstanceOf(AbortController);
    });

    test('a load sends no cache-control header', () => {
      new Pjax('/cached').load();
      expect(mock.requests[0].headers['cache-control']).toBeUndefined();
    });

    test('ignores a stale window.event with metaKey', () => {
      let opened = false;
      const originalOpen = window.open;
      const originalEvent = Object.getOwnPropertyDescriptor(window, 'event');
      window.open = () => (opened = true);
      Object.defineProperty(window, 'event', { value: { metaKey: true }, configurable: true });

      try {
        new Pjax('/meta').load();
        expect(mock.requests).toHaveLength(1);
        expect(opened).toBe(false);
      } finally {
        window.open = originalOpen;
        if (originalEvent) {
          Object.defineProperty(window, 'event', originalEvent);
        } else {
          delete window.event;
        }
      }
    });

    test('a path with a fragment loads in place and keeps the fragment for history', async () => {
      const pushed = [];
      const originalPush = window.history.pushState;
      window.history.pushState = (s, t, url) => pushed.push(url);
      try {
        const done = Pjax.load('/page#section');
        expect(mock.requests[0].url).toBe('/page');
        await respond(
          mock.requests[0],
          '<main class="pjax" id="pjax"><h2 id="section">S</h2></main>',
        );
        const detail = await done;
        expect(detail.status).toBe(200);
        expect(detail.to).toBe('/page');
        expect(pushed).toEqual(['/page#section']);
      } finally {
        window.history.pushState = originalPush;
      }
    });

    test('a fragment on the current path only scrolls, like the browser', async () => {
      window.history.replaceState({}, '', '/docs');
      const scrolled = [];
      const section = document.createElement('h2');
      section.id = 'install';
      section.scrollIntoView = () => scrolled.push('install');
      document.getElementById('pjax').appendChild(section);

      expect(await Pjax.load('/docs#install')).toBeNull();
      expect(mock.requests).toHaveLength(0);
      expect(scrolled).toEqual(['install']);
      expect(location.hash).toBe('#install');
    });

    test('a fragment on the current path still fetches on refresh', () => {
      window.history.replaceState({}, '', '/docs');
      Pjax.refresh('/docs#install');
      expect(mock.requests[0].url).toBe('/docs');
    });

    test('refresh() keeps the current hash route in history', async () => {
      window.history.replaceState({}, '', '/app#/traffic?range=1h');
      const done = Pjax.refresh();
      expect(mock.requests[0].url).toBe('/app');
      await respond(mock.requests[0], '<main class="pjax" id="pjax"><p>ok</p></main>');
      await done;
      expect(location.pathname + location.hash).toBe('/app#/traffic?range=1h');
    });

    test('a same-path load is no longer swallowed while the URL has a hash', () => {
      window.history.replaceState({}, '', '/docs#install');
      Pjax.load('/docs');
      expect(mock.requests).toHaveLength(1);
    });

    test('a timeout aborts the request and hands off to a full navigation', async () => {
      const originalError = console.error;
      console.error = () => {};
      const originalRedirect = Pjax.prototype.redirect;
      let redirected = 0;
      Pjax.prototype.redirect = () => (redirected++, false);
      Pjax.config.timeout = 5;
      Pjax.error = () => {};
      try {
        const detail = await Pjax.load('/slow');
        expect(detail.error).toBe('timeout');
        expect(mock.requests[0].aborted).toBe(true);
        expect(redirected).toBe(1);
      } finally {
        Pjax.prototype.redirect = originalRedirect;
        console.error = originalError;
      }
    });
  });

  // --- redirect ---

  test('redirect returns false', () => {
    const originalOpen = window.open;
    window.open = () => {};

    try {
      const pjax = new Pjax('https://external.com/page');
      const result = pjax.redirect();
      expect(result).toBe(false);
    } finally {
      window.open = originalOpen;
    }
  });

  // --- setPageBody edge cases ---

  test('setPageBody defaults title when none found in response', () => {
    const node = document.createElement('div');
    node.innerHTML = '<main class="pjax" id="pjax"><p>No title</p></main>';
    Pjax.after = () => {};
    Pjax.setPageBody(node, '/no-title');
    expect(document.title).toBe('no page title (pjax)');
  });

  test('setPageBody morphs new body in', () => {
    const node = document.createElement('div');
    node.innerHTML = '<title>T</title><main class="pjax" id="pjax"><p>Body</p></main>';
    Pjax.after = () => {};
    Pjax.setPageBody(node, '/event-test');
    const pjaxNode = Pjax.node();
    expect(pjaxNode.querySelector('p')?.textContent).toBe('Body');
  });

  test('morphInto preserves a single root child whose tag matches the container', () => {
    // regression: page layout `div.pjax > div.flex > [sidebar, content]` - the
    // lone div.flex wrapper must survive the swap, not be unwrapped into the
    // container (which stacks sidebar and content vertically)
    const target = document.createElement('div');
    target.className = 'pjax';
    target.id = 'div-pjax';
    target.innerHTML = '<div class="flex"><div class="sidebar">old</div></div>';
    document.body.appendChild(target);

    Pjax.morphInto(
      target,
      '<div class="flex"><div class="sidebar">S</div><div class="content">C</div></div>',
    );

    expect(target.children.length).toBe(1);
    expect(target.firstElementChild.className).toBe('flex');
    expect(target.firstElementChild.children.length).toBe(2);
    target.remove();
  });

  test('morphInto keeps a single wrapper child (Fez.nodeMorph)', () => {
    const target = document.getElementById('pjax');
    target.innerHTML = '<div class="old-wrapper"><p>Old</p></div>';

    Pjax.morphInto(target, '<div class="flex"><p>Body</p></div>');
    expect(target.children.length).toBe(1);
    expect(target.firstElementChild.className).toBe('flex');
    expect(target.querySelector('.flex p')?.textContent).toBe('Body');
  });

  // --- push / replace ---

  test('push is an alias for pushState', () => {
    let pushed = null;
    const originalPush = window.history.pushState;
    window.history.pushState = (s, t, url) => (pushed = url);

    try {
      Pjax.push('/alias-test');
      expect(pushed).toBe('/alias-test');
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('replace uses replaceState', () => {
    let replaced = null;
    const originalReplace = window.history.replaceState;
    window.history.replaceState = (s, t, url) => (replaced = url);

    try {
      Pjax.replace('/replaced-path');
      expect(replaced).toBe('/replaced-path');
    } finally {
      window.history.replaceState = originalReplace;
    }
  });

  // --- config defaults ---

  test('has sensible default config values', () => {
    expect(Pjax.config.no_scroll_selector).toEqual(['.no-scroll']);
    expect(Pjax.config.paths_to_skip).toEqual([]);
    expect(Pjax.config.no_pjax_class).toEqual(['no-pjax', 'direct']);
    expect(Pjax.config.no_ajax_class).toEqual(['ajax-skip', 'skip-ajax', 'no-ajax', 'top']);
    expect(Pjax.config.ajax_selector).toBe('.ajax');
    expect(Pjax.config.timeout).toBe(10000);
    expect(Pjax.config.history_max).toBe(20);
  });

  // --- console logging ---

  test('console logs when not silent and suppresses when silent', () => {
    let logged = null;
    const originalLog = console.log;
    console.log = (msg) => (logged = msg);

    try {
      Pjax.config.is_silent = false;
      Pjax.console('test message');
      expect(logged).toBe('test message');

      logged = null;
      Pjax.config.is_silent = true;
      Pjax.console('should not appear');
      expect(logged).toBeNull();
    } finally {
      console.log = originalLog;
    }
  });

  test('Pjax.DEV overrides is_silent', () => {
    let logged = null;
    const originalLog = console.log;
    console.log = (msg) => (logged = msg);

    try {
      Pjax.config.is_silent = true;
      Pjax.DEV = true;
      Pjax.console('forced via DEV');
      expect(logged).toBe('forced via DEV');
    } finally {
      console.log = originalLog;
      Pjax.DEV = undefined;
    }
  });

  // --- history cap ---

  test('_addHistoryEntry caps entries at history_max', () => {
    Pjax.config.history_max = 3;
    let callCount = 0;
    const originalPath = Pjax.path;
    Pjax.path = () => `/page-${++callCount}`;
    try {
      Pjax._addHistoryEntry('page1');
      Pjax._addHistoryEntry('page2');
      Pjax._addHistoryEntry('page3');
      expect(Object.keys(Pjax.historyData).length).toBe(3);
      Pjax._addHistoryEntry('page4');
      expect(Object.keys(Pjax.historyData).length).toBe(3);
      expect(Pjax.historyData['/page-1']).toBeUndefined();
    } finally {
      Pjax.path = originalPath;
    }
  });

  test('_addHistoryEntry stores html and scrollY', () => {
    Pjax._addHistoryEntry('<p>test</p>');
    const entry = Pjax.historyData[Pjax.path()];
    expect(entry.html).toBe('<p>test</p>');
    expect(entry.scrollY).toBe(0);
  });

  // --- scroll position save ---

  test('instance load saves scroll position of current page before navigating', () => {
    Pjax.before = () => false;
    Pjax.historyData[Pjax.path()] = { html: '<p>old</p>', scrollY: 0 };
    Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true });

    try {
      const pjax = new Pjax('/next');
      pjax.load();
      expect(Pjax.historyData[Pjax.path()].scrollY).toBe(150);
    } finally {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    }
  });

  // --- form args ---

  test('keeps POST form data out of the URL', () => {
    document.body.innerHTML =
      '<form id="f" method="post" action="/submit"><input name="a" value="1"></form>';
    const form = document.getElementById('f');

    const pjax = new Pjax('/submit', { form });

    expect(pjax.method).toBe('POST');
    expect(pjax.href).toBe('/submit');
    expect(pjax.body.get('a')).toBe('1');
  });

  test('serializes GET form data into the URL', () => {
    document.body.innerHTML =
      '<form id="f" method="get" action="/search"><input name="q" value="fez"></form>';
    const form = document.getElementById('f');

    const pjax = new Pjax('/search', { form });

    expect(pjax.method).toBeUndefined();
    expect(pjax.href).toBe('/search?q=fez');
  });
});

describe('Pjax.load and Pjax.refresh', () => {
  let mock;
  let requests;
  let starts;
  let errors;
  const onStart = (e) => starts.push(e.detail);
  const page = (panel = 'P', other = 'O') =>
    `<main class="pjax" id="pjax"><div id="panel">${panel}</div><div id="other">${other}</div></main>`;

  beforeEach(() => {
    mock = installMockFetch();
    requests = mock.requests;
    starts = [];
    errors = [];
    Pjax.error = (msg) => errors.push(msg);
    document.addEventListener('pjax:start', onStart);
    document
      .getElementById('pjax')
      .insertAdjacentHTML(
        'beforeend',
        '<div id="panel">old</div><div id="other">old</div><div class="no-id"></div>' +
          '<div class="no-scroll"><a href="/n" id="no-scroll-link">n</a></div>',
      );
  });

  afterEach(() => {
    mock.restore();
    document.removeEventListener('pjax:start', onStart);
    window.history.replaceState({}, '', '/');
  });

  for (const verb of ['load', 'refresh']) {
    describe(`${verb} argument shapes`, () => {
      const trigger = () => document.querySelector('.ajax-trigger');
      const cases = [
        ['nothing', () => [], '/', 'full'],
        ['a path', () => ['/x'], '/x', 'full'],
        ['a query', () => ['?q=1'], '/?q=1', 'full'],
        ['a query from a source region', () => ['?q=1', { source: trigger() }], '/dialog?q=1', 'ajax'],
        ['a source region alone', () => [null, { source: trigger() }], '/dialog', 'ajax'],
        ['a #selector', () => ['#panel'], '/', 'target'],
        ['an element', () => [document.getElementById('panel')], '/', 'target'],
        ['a path with opts.target', () => ['/x', { target: '#panel' }], '/x', 'target'],
      ];

      for (const [name, args, url, mode] of cases) {
        test(name, () => {
          Pjax[verb](...args());
          expect(requests).toHaveLength(1);
          expect(requests[0].url).toBe(url);
          expect(starts[0].mode).toBe(mode);
          expect(errors).toEqual([]);
        });
      }

      test('a positional node together with opts.target is rejected', async () => {
        expect(await Pjax[verb]('#panel', { target: '#other' })).toBeNull();
        expect(requests).toHaveLength(0);
        expect(errors[0]).toContain('target given twice');
      });
    });
  }

  describe('options', () => {
    test('unknown keys are reported and dropped', () => {
      const keys = ['node', 'no_cache', 'done', 'ajax', 'replace'];
      keys.forEach((key, i) => Pjax.load(`/u${i}`, { [key]: '#panel' }));
      expect(errors).toEqual(keys.map((key) => `unknown load option: ${key}`));
      expect(requests).toHaveLength(keys.length);
      for (const detail of starts) {
        expect(detail.mode).toBe('full');
        expect(Object.keys(detail.opts).every((k) => Pjax.LOAD_OPTIONS.includes(k))).toBe(true);
      }
    });

    test('undefined and null values are accepted silently', () => {
      Pjax.load('/x', { target: undefined, history: undefined, source: null });
      expect(errors).toEqual([]);
      expect(requests).toHaveLength(1);
    });

    test("the caller's object is never written to", () => {
      // frozen: any write would throw, fail the call and send nothing
      const opts = Object.freeze({ scroll: false });
      Pjax.load('/a', opts);
      Pjax.refresh('#panel', opts);
      expect(requests).toHaveLength(2);
      expect(opts).toEqual({ scroll: false });
      expect(starts[0].opts.target).toBeUndefined();
      expect(starts[1].opts.target).toBe(document.getElementById('panel'));
    });

    test('pjax:render detail.opts holds only the public keys', async () => {
      const done = Pjax.load('/x', { target: '#panel' });
      await respond(requests[0], page());
      const detail = await done;
      expect(Object.keys(detail.opts).sort()).toEqual(['history', 'scroll', 'target']);
    });
  });

  describe('defaults', () => {
    const panel = () => document.getElementById('panel');
    const rows = [
      ['load', "'/x'", () => ['/x'], { scroll: true, history: 'push', noCache: false }],
      ['load', "'#panel'", () => ['#panel'], { scroll: false, history: false, noCache: false }],
      ['load', 'element', () => [panel()], { scroll: false, history: false, noCache: false }],
      ['load', "'/x', { target }", () => ['/x', { target: panel() }], { scroll: false, history: 'push', noCache: false }],
      [
        'load',
        "'/x', { source }",
        () => ['/x', { source: document.querySelector('.ajax-trigger') }],
        { scroll: false, history: false, noCache: false },
      ],
      ['refresh', '', () => [], { scroll: false, history: 'push', noCache: true }],
      ['refresh', "'/x'", () => ['/x'], { scroll: false, history: 'push', noCache: true }],
      ['refresh', "'#panel'", () => ['#panel'], { scroll: false, history: false, noCache: true }],
    ];

    for (const [verb, label, args, expected] of rows) {
      test(`${verb}(${label})`, () => {
        Pjax[verb](...args());
        expect(starts[0].opts.scroll).toBe(expected.scroll);
        expect(starts[0].opts.history).toBe(expected.history);
        expect(requests[0].headers['cache-control'] === 'no-cache').toBe(expected.noCache);
      });
    }

    test('explicit values override every default', () => {
      Pjax.refresh('#panel', { scroll: true, history: 'push' });
      Pjax.load('/x', { scroll: false, history: false });
      expect(starts[0].opts).toMatchObject({ scroll: true, history: 'push' });
      expect(starts[1].opts).toMatchObject({ scroll: false, history: false });
    });

    test('refresh() of the current URL replaces the history entry', async () => {
      const calls = [];
      const { pushState, replaceState } = window.history;
      window.history.pushState = (s, t, url) => calls.push(`push:${url}`);
      window.history.replaceState = (s, t, url) => calls.push(`replace:${url}`);
      try {
        Pjax.refresh();
        await respond(requests[0], page());
      } finally {
        window.history.pushState = pushState;
        window.history.replaceState = replaceState;
      }
      expect(calls).toEqual(['replace:/']);
    });

    const smoothScrolls = async (fn) => {
      const calls = [];
      const original = window.scrollTo;
      window.scrollTo = (arg) => calls.push(arg);
      try {
        await fn();
      } finally {
        window.scrollTo = original;
      }
      return calls.filter((arg) => arg?.behavior === 'smooth').length;
    };

    test('a full swap scrolls to top, a node swap does not', async () => {
      expect(await smoothScrolls(async () => {
        Pjax.load('/x');
        await respond(requests[0], page());
      })).toBe(1);
      expect(await smoothScrolls(async () => {
        Pjax.load('#panel');
        await respond(requests[1], page());
      })).toBe(0);
    });

    test('a .no-scroll source keeps scroll on a full swap', async () => {
      const link = document.getElementById('no-scroll-link');
      expect(await smoothScrolls(async () => {
        Pjax.load('/x', { source: link });
        await respond(requests[0], page());
      })).toBe(0);
    });

    test('load debounces the same URL and node for 2s, refresh never does', async () => {
      Pjax.load('/x');
      expect(await Pjax.load('/x')).toBeNull();
      expect(requests).toHaveLength(1);
      Pjax.refresh('/y');
      Pjax.refresh('/y');
      expect(requests).toHaveLength(3);
    });
  });

  describe('target checks', () => {
    test('a selector that matches nothing', async () => {
      expect(await Pjax.load('#missing')).toBeNull();
      expect(errors[0]).toContain('target not found');
      expect(requests).toHaveLength(0);
    });

    test('an invalid selector', async () => {
      expect(await Pjax.refresh('#')).toBeNull();
      expect(errors[0]).toContain('target not found');
      expect(requests).toHaveLength(0);
    });

    test('an element without an id', async () => {
      expect(await Pjax.load('/x', { target: document.querySelector('.no-id') })).toBeNull();
      expect(errors[0]).toContain('no id');
      expect(requests).toHaveLength(0);
    });
  });

  describe('swap keys', () => {
    test('loads into different nodes run side by side', async () => {
      const a = Pjax.load('#panel');
      const b = Pjax.load('#other');
      expect(requests).toHaveLength(2);
      await respond(requests[0], page('P1', 'ignored'));
      await respond(requests[1], page('ignored', 'O1'));
      expect((await a).status).toBe(200);
      expect((await b).status).toBe(200);
      expect(document.getElementById('panel').innerHTML).toBe('P1');
      expect(document.getElementById('other').innerHTML).toBe('O1');
    });

    test('a second request for the same node aborts the first', async () => {
      const first = Pjax.refresh('#panel');
      Pjax.refresh('#panel');
      expect(requests[0].aborted).toBe(true);
      expect(requests[1].aborted).toBeUndefined();
      expect((await first).error).toBe('abort');
    });

    test('a full load aborts pending node loads', () => {
      Pjax.load('#panel');
      Pjax.load('#other');
      Pjax.load('/x');
      expect(requests[0].aborted).toBe(true);
      expect(requests[1].aborted).toBe(true);
      expect(requests[2].aborted).toBeUndefined();
    });

    test('a node load leaves a pending full load alone', () => {
      Pjax.load('/x');
      Pjax.load('#panel');
      expect(requests[0].aborted).toBeUndefined();
    });

    test('a late response of a superseded request does not swap', async () => {
      Pjax.refresh('#panel');
      Pjax.refresh('#panel');
      await respond(requests[0], page('stale'));
      expect(document.getElementById('panel').innerHTML).toBe('old');
      await respond(requests[1], page('fresh'));
      expect(document.getElementById('panel').innerHTML).toBe('fresh');
    });
  });
});

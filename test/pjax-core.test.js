// Ported from dux-pjax test/pjax.test.coffee - "Pjax module" describe block.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { setupPjaxEnv, teardownPjaxEnv, resetDOM } from './pjax-env.js';
import createPjax from '../src/fez/pjax/pjax.js';

let Pjax;

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

  test('derives ajax context when DOM node provided', () => {
    const ajaxNode = document.getElementById('ajax-node');
    const opts = Pjax.getOpts('?foo=bar', { ajax: ajaxNode });
    expect(opts.ajax_node).toBe(ajaxNode);
    expect(opts.scroll).toBe(false);
    expect(opts.path).toBe('/dialog?foo=bar');
  });

  test('executes inline scripts through parseScripts', () => {
    window.__pjaxTestCounter = 0;
    const html = '<div><script>window.__pjaxTestCounter += 1</script></div>';
    Pjax.parseScripts(html);
    expect(window.__pjaxTestCounter).toBe(1);
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

    const originalFetch = Pjax.fetch;
    Pjax.fetch = (opts) => {
      const pjax = new Pjax(opts);
      pjax.response = response;
      pjax.applyLoadedData();
    };
    try {
      Pjax.refresh('#some-div');
    } finally {
      Pjax.fetch = originalFetch;
    }

    expect(document.getElementById('some-div').innerHTML).toBe('New content');
  });

  test('normalizes options before fetching when calling load', () => {
    const normalized = { path: '/users' };
    const calls = [];
    const originalGetOpts = Pjax.getOpts;
    const originalFetch = Pjax.fetch;

    Pjax.getOpts = (href, opts) => {
      calls.push('getOpts');
      expect(href).toBe('/users');
      expect(opts.extra).toBe(true);
      return normalized;
    };

    Pjax.fetch = (opts) => {
      calls.push('fetch');
      expect(opts).toBe(normalized);
    };

    try {
      Pjax.load('/users', { extra: true });
      expect(calls).toEqual(['getOpts', 'fetch']);
    } finally {
      Pjax.getOpts = originalGetOpts;
      Pjax.fetch = originalFetch;
    }
  });

  test('forces selector refreshes to skip history and scrolling', () => {
    const target = document.createElement('div');
    target.id = 'panel';
    document.getElementById('pjax').appendChild(target);

    const originalPath = Pjax.path;
    const originalGetOpts = Pjax.getOpts;
    const originalFetch = Pjax.fetch;
    const normalized = {};

    Pjax.path = () => '/current';

    Pjax.getOpts = (func, opts) => {
      expect(func).toBe('/current');
      const result = originalGetOpts.call(Pjax, func, opts);
      expect(result.target).toBe(target);
      expect(result.history).toBe(false);
      return normalized;
    };

    Pjax.fetch = (opts) => {
      expect(opts.scroll).toBe(false);
      expect(opts).toBe(normalized);
    };

    try {
      Pjax.refresh('#panel');
    } finally {
      Pjax.path = originalPath;
      Pjax.getOpts = originalGetOpts;
      Pjax.fetch = originalFetch;
    }
  });

  test('disables cache when calling reload', () => {
    const originalGetOpts = Pjax.getOpts;
    const originalFetch = Pjax.fetch;

    Pjax.getOpts = (arg) => {
      expect(arg).toBeUndefined();
      return {};
    };

    Pjax.fetch = (opts) => {
      expect(opts.cache).toBe(false);
    };

    try {
      Pjax.reload();
    } finally {
      Pjax.getOpts = originalGetOpts;
      Pjax.fetch = originalFetch;
    }
  });

  test('normalizes replacePath with query-only value using pathname', () => {
    const opts = Pjax.getOpts('/users', { replacePath: '?sort=asc' });
    expect(opts.replacePath).toBe(location.pathname + '?sort=asc');
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

  test('skips external scripts in parseScripts', () => {
    window.__externalTest = 0;
    const html = '<div><script src="external.js">window.__externalTest = 1</script></div>';
    Pjax.parseScripts(html);
    expect(window.__externalTest).toBe(0);
  });

  test('defers scripts with pjax-delay attribute via requestAnimationFrame', () => {
    window.__delayTest = 0;
    const html = '<div><script pjax-delay>window.__delayTest = 1</script></div>';
    Pjax.parseScripts(html);
    // requestAnimationFrame is sync in test env, so it runs immediately
    expect(window.__delayTest).toBe(1);
  });

  test('handles target as string selector in getOpts', () => {
    const node = document.getElementById('ajax-node');
    const opts = Pjax.getOpts('/test', { target: '#ajax-node' });
    expect(opts.target).toBe(node);
    expect(opts.node).toBe(node);
    expect(opts.scroll).toBe(false);
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

  test('getOpts treats function arg as done callback', () => {
    const fn = () => {};
    const opts = Pjax.getOpts(fn);
    expect(opts.done).toBe(fn);
    expect(opts.path).toBe(Pjax.path());
  });

  test('getOpts treats plain object arg as opts', () => {
    const opts = Pjax.getOpts({ path: '/foo', scroll: false });
    expect(opts.path).toBe('/foo');
    expect(opts.scroll).toBe(false);
  });

  test('getOpts converts href alias to path', () => {
    const opts = Pjax.getOpts({ href: '/aliased' });
    expect(opts.path).toBe('/aliased');
    expect(opts.href).toBeUndefined();
  });

  test('getOpts treats string second arg as target', () => {
    const node = document.getElementById('ajax-node');
    const opts = Pjax.getOpts('/page', '#ajax-node');
    expect(opts.target).toBe(node);
    expect(opts.node).toBe(node);
  });

  test('getOpts prepends pathname for query-only path without ajax node', () => {
    const opts = Pjax.getOpts('?search=hello');
    expect(opts.path).toBe(location.pathname + '?search=hello');
  });

  test('getOpts skips ajax_node when parent has no_ajax_class', () => {
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
    const opts = Pjax.getOpts('/test', { ajax: link });
    expect(opts.ajax_node).toBeUndefined();
  });

  test('getOpts uses path attribute as fallback for data-path on ajax node', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <div class="ajax" id="path-ajax" path="/alt-path">
          <a href="/x" id="path-link">Link</a>
        </div>
      </main>
    `;
    const link = document.getElementById('path-link');
    const opts = Pjax.getOpts('?q=1', { ajax: link });
    expect(opts.path).toBe('/alt-path?q=1');
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

  // --- parseScripts edge cases ---

  test('parseScripts skips non-javascript type scripts', () => {
    window.__jsonTest = 0;
    const html = '<div><script type="application/json">window.__jsonTest = 1</script></div>';
    Pjax.parseScripts(html);
    expect(window.__jsonTest).toBe(0);
  });

  test('parseScripts accepts DOM node directly', () => {
    window.__domNodeTest = 0;
    const div = document.createElement('div');
    div.innerHTML = '<script>window.__domNodeTest = 5</script>';
    Pjax.parseScripts(div);
    expect(window.__domNodeTest).toBe(5);
  });

  test('parseScripts auto-assigns ids to scripts without one', () => {
    Pjax.script_cnt = 0;
    const div = document.createElement('div');
    div.innerHTML = '<div><script>void 0</script></div>';
    Pjax.parseScripts(div);
    const script = div.querySelector('script');
    expect(script.id).toMatch(/^app-sc-/);
  });

  // --- qs (querystring helper) ---

  test('qs setter with href option returns URL string without navigating', () => {
    const result = Pjax.qs('color', 'blue', { href: true });
    expect(result).toContain('color=blue');
    expect(result).toContain(location.pathname);
  });

  test('qs setter triggers Pjax.load by default', () => {
    let loadedHref = null;
    const originalLoad = Pjax.load;
    Pjax.load = (href) => (loadedHref = href);

    try {
      Pjax.qs('page', '2');
      expect(loadedHref).toContain('page=2');
    } finally {
      Pjax.load = originalLoad;
    }
  });

  test('qs setter with push option calls Pjax.push', () => {
    let pushedHref = null;
    const originalPush = Pjax.push;
    Pjax.push = (href) => (pushedHref = href);

    try {
      Pjax.qs('tab', 'info', { push: true });
      expect(pushedHref).toContain('tab=info');
    } finally {
      Pjax.push = originalPush;
    }
  });

  test('qs removes param when value is null', () => {
    const result = Pjax.qs('remove_me', null, { href: true });
    expect(result).not.toContain('remove_me');
  });

  test('qs removes param when value is false', () => {
    const result = Pjax.qs('gone', false, { href: true });
    expect(result).not.toContain('gone');
  });

  // --- applyLoadedData ---

  test('applyLoadedData in ajax_node mode replaces container and sets data-path', () => {
    const ajaxNode = document.getElementById('ajax-node');
    const pjax = new Pjax({ path: '/new-dialog', ajax_node: ajaxNode });
    pjax.response = '<div id="ajax-node"><p>Updated ajax</p></div>';
    pjax.applyLoadedData();

    expect(ajaxNode.innerHTML).toContain('Updated ajax');
    expect(ajaxNode.getAttribute('data-path')).toBe('/new-dialog');
  });

  test('applyLoadedData in ajax_node mode uses full response when no matching id', () => {
    const ajaxNode = document.getElementById('ajax-node');
    const pjax = new Pjax({ path: '/fallback', ajax_node: ajaxNode });
    pjax.response = '<p>Full response fallback</p>';
    pjax.applyLoadedData();

    expect(ajaxNode.innerHTML).toContain('Full response fallback');
  });

  test('applyLoadedData matches target ids containing selector metacharacters', () => {
    const target = document.createElement('div');
    target.id = 'user:42.panel';
    target.innerHTML = 'Old';
    document.getElementById('pjax').appendChild(target);

    const pjax = new Pjax({ path: '/special-id', target });
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
      const pjax = new Pjax({ path: '/cached-page' });
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
      const pjax = new Pjax({ path: '/skip', history: false });
      pjax.historyAddCurrent('/skip');
      expect(pushCalled).toBe(false);
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('historyAddCurrent skips when ajax_node set without target', () => {
    let pushCalled = false;
    const originalPush = window.history.pushState;
    window.history.pushState = () => (pushCalled = true);

    try {
      const ajaxNode = document.getElementById('ajax-node');
      const pjax = new Pjax({ path: '/ajax', ajax_node: ajaxNode });
      pjax.historyAddCurrent('/ajax');
      expect(pushCalled).toBe(false);
    } finally {
      window.history.pushState = originalPush;
    }
  });

  test('historyAddCurrent uses replaceState on duplicate href', () => {
    let replaced = null;
    let pushed = null;
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = (s, t, url) => (pushed = url);
    window.history.replaceState = (s, t, url) => (replaced = url);

    try {
      Pjax._lastHrefCheck = '/same-page';
      const pjax = new Pjax({ path: '/same-page' });
      pjax.historyAddCurrent('/same-page');
      expect(replaced).toBe('/same-page');
      expect(pushed).toBeNull();
    } finally {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    }
  });

  test('historyAddCurrent uses pushState on new href', () => {
    let pushed = null;
    const originalPush = window.history.pushState;
    window.history.pushState = (s, t, url) => (pushed = url);

    try {
      Pjax._lastHrefCheck = '/old-page';
      const pjax = new Pjax({ path: '/new-page' });
      pjax.historyAddCurrent('/new-page');
      expect(pushed).toBe('/new-page');
      expect(Pjax._lastHrefCheck).toBe('/new-page');
    } finally {
      window.history.pushState = originalPush;
    }
  });

  // --- instance load() ---

  test('instance load returns false when href is empty', () => {
    const pjax = new Pjax({ path: '' });
    const result = pjax.load();
    expect(result).toBe(false);
  });

  test('instance load aborts when before() returns false', () => {
    Pjax.before = () => false;
    const pjax = new Pjax({ path: '/blocked' });
    const result = pjax.load();
    expect(result).toBeUndefined();
  });

  test('instance load tracks pastHref and lastHref', () => {
    Pjax.lastHref = '/previous';
    Pjax.before = () => false;
    const pjax = new Pjax({ path: '/current' });
    pjax.load();
    expect(Pjax.pastHref).toBe('/previous');
    expect(Pjax.lastHref).toBe('/current');
  });

  test('instance load redirects for paths_to_skip string match', () => {
    Pjax.config.paths_to_skip = ['/admin'];
    let redirected = false;
    const pjax = new Pjax({ path: '/admin/users' });
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load redirects for paths_to_skip regex match', () => {
    Pjax.config.paths_to_skip = [/^\/api/];
    let redirected = false;
    const pjax = new Pjax({ path: '/api/v1/data' });
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load redirects for paths_to_skip function match', () => {
    Pjax.config.paths_to_skip = [(href) => href.includes('skip')];
    let redirected = false;
    const pjax = new Pjax({ path: '/please-skip-this' });
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load redirects for URLs with http prefix', () => {
    let redirected = false;
    const pjax = new Pjax({ path: 'https://example.com' });
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load redirects for URLs containing hash', () => {
    let redirected = false;
    const pjax = new Pjax({ path: '/page#section' });
    pjax.redirect = () => (redirected = true);
    pjax.load();
    expect(redirected).toBe(true);
  });

  test('instance load aborts previous in-flight request', () => {
    let aborted = false;
    Pjax.request = { abort: () => (aborted = true) };

    class MockXHR {
      open() {}
      setRequestHeader() {}
      send() {}
    }
    const OrigXHR = global.XMLHttpRequest;
    global.XMLHttpRequest = MockXHR;

    try {
      const pjax = new Pjax({ path: '/new' });
      pjax.load();
      expect(aborted).toBe(true);
    } finally {
      global.XMLHttpRequest = OrigXHR;
    }
  });

  test('instance load sends XHR with correct headers and timeout', () => {
    Pjax.request = null;
    const headers = {};
    class MockXHR {
      open() {}
      setRequestHeader(k, v) {
        headers[k] = v;
      }
      send() {}
    }
    const OrigXHR = global.XMLHttpRequest;
    global.XMLHttpRequest = MockXHR;

    try {
      const pjax = new Pjax({ path: '/headers-test', cache: false });
      pjax.load();
      expect(headers['x-requested-with']).toBe('XMLHttpRequest');
      expect(headers['cache-control']).toBe('no-cache');
      expect(Pjax.request.timeout).toBe(10000);
    } finally {
      global.XMLHttpRequest = OrigXHR;
    }
  });

  // --- redirect ---

  test('redirect returns false', () => {
    const originalOpen = window.open;
    window.open = () => {};

    try {
      const pjax = new Pjax({ path: 'https://external.com/page' });
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

    Pjax.morphInto(target, '<div class="flex"><div class="sidebar">S</div><div class="content">C</div></div>');

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

  // --- refresh without selector ---

  test('refresh without selector uses current path and disables scroll', () => {
    let fetchedOpts = null;
    const originalFetch = Pjax.fetch;

    Pjax.fetch = (opts) => (fetchedOpts = opts);

    try {
      Pjax.refresh();
      expect(fetchedOpts.scroll).toBe(false);
      expect(fetchedOpts.path).toBe(Pjax.path());
    } finally {
      Pjax.fetch = originalFetch;
    }
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
      const pjax = new Pjax({ path: '/next' });
      pjax.load();
      expect(Pjax.historyData[Pjax.path()].scrollY).toBe(150);
    } finally {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    }
  });
});

// Ported from dux-pjax test/pjax.test.coffee - "PjaxOnClick" describe block.

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { setupPjaxEnv, teardownPjaxEnv, resetDOM } from './pjax-env.js';
import createPjax from '../src/fez/pjax/pjax.js';

let Pjax;
let PjaxOnClick;

beforeAll(() => {
  setupPjaxEnv();
});

afterAll(() => {
  teardownPjaxEnv();
});

beforeEach(() => {
  resetDOM();
  Pjax = createPjax();
  PjaxOnClick = Pjax.PjaxOnClick;
});

const createClickEvent = (overrides = {}) => {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true });
  for (const [k, v] of Object.entries(overrides)) {
    Object.defineProperty(e, k, { value: v });
  }
  return e;
};

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PjaxOnClick', () => {
  test('dispatches click attribute as inline JS bound to the element', () => {
    document.body.innerHTML = '<div click="this.dataset.ran = \'yes\'" id="clicker">Click me</div>';
    const node = document.getElementById('clicker');
    const e = createClickEvent({ target: node });
    PjaxOnClick.main(e);
    expect(node.dataset.ran).toBe('yes');
  });

  test('calls Pjax.load with ajax context for regular href clicks', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/clicked-page" id="link">Go</a>
      </main>
    `;
    let loadedArgs = null;
    Pjax.load = (href, opts) => (loadedArgs = { href, opts });

    const link = document.getElementById('link');
    const e = createClickEvent({ target: link });
    PjaxOnClick.main(e);

    expect(loadedArgs).not.toBeNull();
    expect(loadedArgs.href).toBe('/clicked-page');
    expect(loadedArgs.opts.ajax).toBe(link);
  });

  test('uses pjax-target to load into a specific element', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <div id="target-box">Old</div>
        <a href="/target-page" pjax-target="#target-box" id="t-link">Load</a>
      </main>
    `;
    let loadedArgs = null;
    Pjax.load = (href, opts) => (loadedArgs = { href, opts });

    const link = document.getElementById('t-link');
    const e = createClickEvent({ target: link });
    PjaxOnClick.main(e);

    expect(loadedArgs.href).toBe('/target-page');
    expect(loadedArgs.opts.target).toBe(document.getElementById('target-box'));
  });

  test('uses pjax-refresh to refresh a specific element without href', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <div id="target-box">Old</div>
        <button pjax-refresh="#target-box" id="refresh-button">Refresh</button>
      </main>
    `;
    let refreshedTarget = null;
    Pjax.refresh = (target) => (refreshedTarget = target);

    const button = document.getElementById('refresh-button');
    const e = createClickEvent({ target: button });
    PjaxOnClick.main(e);

    expect(refreshedTarget).toBe('#target-box');
  });

  test('aborts and logs error when pjax-refresh selector matches nothing', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <button pjax-refresh="#missing" id="refresh-button">Refresh</button>
      </main>
    `;
    let refreshCalled = false;
    Pjax.refresh = () => (refreshCalled = true);
    const errs = [];
    Pjax.error = (msg) => errs.push(msg);

    const button = document.getElementById('refresh-button');
    const e = createClickEvent({ target: button });
    PjaxOnClick.main(e);

    expect(refreshCalled).toBe(false);
    expect(errs[0]).toContain('pjax-refresh');
  });

  test('aborts and logs error when pjax-target selector matches nothing', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/x" pjax-target="#missing" id="miss-link">Load</a>
      </main>
    `;
    let loadCalled = false;
    Pjax.load = () => (loadCalled = true);
    let opened = null;
    const originalOpen = window.open;
    window.open = (url) => (opened = url);

    const errs = [];
    Pjax.error = (msg) => errs.push(msg);

    try {
      const link = document.getElementById('miss-link');
      const e = createClickEvent({ target: link });
      PjaxOnClick.main(e);
      expect(loadCalled).toBe(false);
      expect(opened).toBeNull();
      expect(errs[0]).toContain('pjax-target');
    } finally {
      window.open = originalOpen;
    }
  });

  test('no-pjax link without target navigates the current tab, not a new window', () => {
    document.body.innerHTML = '<a href="https://example.com" class="no-pjax" id="ext">Ext</a>';

    let opened = null;
    let left = null;
    const originalOpen = window.open;
    window.open = (url) => (opened = url);
    PjaxOnClick.leave = (href, target) => (left = { href, target });

    try {
      const e = createClickEvent({ target: document.getElementById('ext') });
      PjaxOnClick.main(e);
      expect(opened).toBeNull();
      expect(left.href).toBe('https://example.com');
      expect(left.target).toBeNull();
    } finally {
      window.open = originalOpen;
    }
  });

  test('no-pjax link with target opens a new window', () => {
    document.body.innerHTML =
      '<a href="https://example.com" target="_blank" class="no-pjax" id="ext">Ext</a>';

    let opened = null;
    let openedTarget = null;
    const originalOpen = window.open;
    window.open = (url, target) => {
      opened = url;
      openedTarget = target;
    };

    try {
      const e = createClickEvent({ target: document.getElementById('ext') });
      PjaxOnClick.main(e);
      expect(opened).toBe('https://example.com');
      expect(openedTarget).toBe('_blank');
    } finally {
      window.open = originalOpen;
    }
  });

  test('opts out of pjax when an ancestor carries a no-pjax class', () => {
    document.body.innerHTML = `
      <div class="direct">
        <a href="/inner-page" id="nested">Go</a>
      </div>
    `;
    let left = null;
    let loadCalled = false;
    Pjax.load = () => (loadCalled = true);
    PjaxOnClick.leave = (href, target) => (left = { href, target });

    const e = createClickEvent({ target: document.getElementById('nested') });
    PjaxOnClick.main(e);
    expect(loadCalled).toBe(false);
    expect(left.href).toBe('/inner-page');
    expect(left.target).toBeNull();
  });

  test('external scheme link without target stays in the current tab', () => {
    document.body.innerHTML = '<a href="https://other.example/path" id="scheme">Out</a>';

    let opened = null;
    let left = null;
    const originalOpen = window.open;
    window.open = (url) => (opened = url);
    PjaxOnClick.leave = (href, target) => (left = { href, target });

    try {
      const e = createClickEvent({ target: document.getElementById('scheme') });
      PjaxOnClick.main(e);
      expect(opened).toBeNull();
      expect(left.href).toBe('https://other.example/path');
      expect(left.target).toBeNull();
    } finally {
      window.open = originalOpen;
    }
  });

  test('executes javascript: href as inline function', () => {
    window.__jsHrefTest = 0;
    document.body.innerHTML = '<a href="javascript:window.__jsHrefTest=99" id="js-link">Run</a>';

    const link = document.getElementById('js-link');
    const e = createClickEvent({ target: link });
    PjaxOnClick.main(e);
    expect(window.__jsHrefTest).toBe(99);
  });

  test('ignores elements without click or href attributes', () => {
    document.body.innerHTML = '<div id="plain">No action</div>';
    let loadCalled = false;
    Pjax.load = () => (loadCalled = true);

    const div = document.getElementById('plain');
    const e = createClickEvent({ target: div });
    PjaxOnClick.main(e);
    expect(loadCalled).toBe(false);
  });

  test('opens links with target attribute in named window', () => {
    document.body.innerHTML = '<a href="mailto:test@x.com" target="_blank" id="target-link">Mail</a>';

    let opened = null;
    let openedTarget = null;
    const originalOpen = window.open;
    window.open = (url, target) => {
      opened = url;
      openedTarget = target;
    };

    try {
      const link = document.getElementById('target-link');
      const e = createClickEvent({ target: link });
      PjaxOnClick.main(e);
      expect(opened).toBe('mailto:test@x.com');
      expect(openedTarget).toBe('_blank');
    } finally {
      window.open = originalOpen;
    }
  });

  test('treats relative path without scheme as pjax navigation', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="users" id="rel-link">Users</a>
      </main>
    `;
    let loadedArgs = null;
    let opened = null;
    const originalOpen = window.open;
    window.open = (url) => (opened = url);
    Pjax.load = (href, opts) => (loadedArgs = { href, opts });

    try {
      const link = document.getElementById('rel-link');
      const e = createClickEvent({ target: link });
      PjaxOnClick.main(e);
      expect(opened).toBeNull();
      expect(loadedArgs).not.toBeNull();
      expect(loadedArgs.href).toBe('users');
    } finally {
      window.open = originalOpen;
    }
  });

  test('pjax-confirm aborts navigation when confirm returns false', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/danger" pjax-confirm="Sure?" id="confirm-link">Delete</a>
      </main>
    `;
    let loadCalled = false;
    Pjax.load = () => (loadCalled = true);
    const originalConfirm = window.confirm;
    let confirmedWith = null;
    window.confirm = (msg) => {
      confirmedWith = msg;
      return false;
    };

    try {
      const link = document.getElementById('confirm-link');
      const e = createClickEvent({ target: link });
      PjaxOnClick.main(e);
      expect(confirmedWith).toBe('Sure?');
      expect(loadCalled).toBe(false);
    } finally {
      window.confirm = originalConfirm;
    }
  });

  test('pjax-confirm proceeds with navigation when confirm returns true', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/ok" pjax-confirm="Sure?" id="confirm-ok">Go</a>
      </main>
    `;
    let loadedHref = null;
    Pjax.load = (href) => (loadedHref = href);
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    try {
      const link = document.getElementById('confirm-ok');
      const e = createClickEvent({ target: link });
      PjaxOnClick.main(e);
      expect(loadedHref).toBe('/ok');
    } finally {
      window.confirm = originalConfirm;
    }
  });

  test('pjax-replace passes replace flag through to Pjax.load', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/replace-me" pjax-replace id="rep-link">Tab</a>
      </main>
    `;
    let loadedOpts = null;
    Pjax.load = (href, opts) => (loadedOpts = opts);

    const link = document.getElementById('rep-link');
    const e = createClickEvent({ target: link });
    PjaxOnClick.main(e);
    expect(loadedOpts.replace).toBe(true);
  });

  test('main works when invoked as a bare function (addEventListener style)', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/bare" id="bare-link">X</a>
      </main>
    `;
    let loadedHref = null;
    Pjax.load = (href) => (loadedHref = href);

    const fn = PjaxOnClick.main;
    const link = document.getElementById('bare-link');
    const e = createClickEvent({ target: link });
    fn(e);
    expect(loadedHref).toBe('/bare');
  });

  test('Pjax.confirm receives message and trigger node', () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/del" pjax-confirm="Sure?" pjax-yes="Delete" id="hooked">X</a>
      </main>
    `;
    Pjax.load = () => {};
    let captured = null;
    Pjax.confirm = (msg, node) => {
      captured = { msg, yesAttr: node.getAttribute('pjax-yes'), id: node.id };
      return false;
    };

    const link = document.getElementById('hooked');
    const e = createClickEvent({ target: link });
    PjaxOnClick.main(e);
    expect(captured.msg).toBe('Sure?');
    expect(captured.yesAttr).toBe('Delete');
    expect(captured.id).toBe('hooked');
  });

  test('Pjax.confirm Promise resolution defers navigation', async () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/async" pjax-confirm="?" id="async-link">X</a>
      </main>
    `;
    let loadCalledWith = null;
    Pjax.load = (href) => (loadCalledWith = href);

    let resolveFn = null;
    Pjax.confirm = () => new Promise((resolve) => (resolveFn = resolve));

    const link = document.getElementById('async-link');
    const e = createClickEvent({ target: link });
    PjaxOnClick.main(e);
    expect(loadCalledWith).toBeNull();
    resolveFn(true);
    await sleep();
    expect(loadCalledWith).toBe('/async');
  });

  test('Pjax.confirm Promise resolving false drops navigation', async () => {
    document.body.innerHTML = `
      <main class="pjax" id="pjax">
        <a href="/no-go" pjax-confirm="?" id="no-link">X</a>
      </main>
    `;
    let loadCalled = false;
    Pjax.load = () => (loadCalled = true);

    Pjax.confirm = () => Promise.resolve(false);

    const link = document.getElementById('no-link');
    const e = createClickEvent({ target: link });
    PjaxOnClick.main(e);
    await sleep();
    expect(loadCalled).toBe(false);
  });
});

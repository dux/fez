/**
 * Browser regressions for the component runtime: render scheduling, the state
 * store, class fields, cleanup, slot unwrap, global state, fez-inline and
 * fez:bind radios.
 *
 * Run: bun test test/browser/runtime-regressions.test.js
 */

import { test, expect, setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fezCode = readFileSync(join(__dirname, '../../dist/fez.js'), 'utf-8');

setDefaultTimeout(30000);

let browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

// Runs `setup` in a fresh page, waits, then returns `check()` plus page errors
async function run(setup, check, wait = 150) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  try {
    await page.setContent(
      `<!DOCTYPE html><html><head><script>${fezCode}</script></head><body><div id="app"></div></body></html>`,
    );
    await page.waitForFunction(() => window.Fez && document.readyState === 'complete');
    await page.evaluate(setup);
    await page.waitForTimeout(wait);
    return { result: await page.evaluate(check), errors };
  } finally {
    await context.close();
  }
}

test('a throwing render does not freeze later renders', async () => {
  const { result } = await run(
    () => {
      Fez('boom-x', class {
        HTML = '<p class="n">{state.n}</p>';
        init() { this.state.n = 0; this.state.boom = false; }
        beforeRender() { if (this.state.boom) throw new Error('boom'); }
      });
      app.innerHTML = '<boom-x></boom-x>';
      const f = Fez('boom-x');
      f.state.boom = true;
      f.state.n = 1;
      setTimeout(() => { f.state.boom = false; f.state.n = 2; }, 60);
    },
    () => document.querySelector('.n').textContent,
  );
  expect(result).toBe('2');
});

test('a child mounted by the parent render can write parent state', async () => {
  const { result } = await run(
    () => {
      Fez('child-a', class { HTML = '<i>c</i>'; onMount() { this.publish('ready'); } });
      Fez('parent-a', class {
        HTML = '<p class="count">{state.count}</p>{#if state.show}<child-a></child-a>{/if}';
        init() { this.state.count = 0; this.state.show = false; this.subscribe('ready', () => this.state.count++); }
      });
      app.innerHTML = '<parent-a></parent-a>';
      Fez('parent-a').state.show = true;
    },
    () => document.querySelector('.count').textContent,
  );
  expect(result).toBe('1');
});

test('GLOBAL_STATE of a child mounted by the parent render repaints the parent', async () => {
  const { result } = await run(
    () => {
      Fez('child-b', class { HTML = '<i>c</i>'; GLOBAL_STATE = { boardViewB: true }; });
      Fez('parent-b', class {
        HTML = '<p class="gv">{globalState.boardViewB ? "on" : "off"}</p>{#if state.show}<child-b></child-b>{/if}';
        init() { this.state.show = false; }
      });
      app.innerHTML = '<parent-b></parent-b>';
      requestAnimationFrame(() => { Fez('parent-b').state.show = true; });
    },
    () => document.querySelector('.gv').textContent,
  );
  expect(result).toBe('on');
});

test('slot unwrap components keep their children across props, globalState and await', async () => {
  const { result } = await run(
    () => {
      Fez('unwrap-x', class {
        HTML = '<ul class="u"><slot unwrap /></ul><p class="lbl">{props.label}{globalState.unwrapG}</p>';
      });
      Fez('unwrap-host', class {
        HTML = '<unwrap-x label={state.l}><li class="kid">kid</li></unwrap-x>';
        init() { this.state.l = 'a'; }
      });
      app.innerHTML = '<unwrap-host></unwrap-host>';
      setTimeout(() => { Fez('unwrap-host').state.l = 'b'; Fez.state.set('unwrapG', 1); }, 30);
    },
    () => document.querySelectorAll('.kid').length,
  );
  expect(result).toBe(1);
});

test('class fields are initialized per instance', async () => {
  const { result, errors } = await run(
    () => {
      Fez('field-x', class {
        cache = {};
        inc = () => this.state.n++;
        HTML = '<b>{state.n}</b>';
        init() { this.state.n = 0; }
      });
      app.innerHTML = '<field-x id="a"></field-x><field-x id="b"></field-x>';
      Fez('#a').inc();
      Fez('#a').cache.hit = 1;
    },
    () => ({
      a: document.querySelector('#a b').textContent,
      b: document.querySelector('#b b').textContent,
      sharedCache: Fez('#b').cache.hit,
    }),
  );
  expect(errors).toEqual([]);
  expect(result).toEqual({ a: '1', b: '0', sharedCache: undefined });
});

test('an {#await} promise settling after destroy is ignored', async () => {
  const { errors } = await run(
    () => {
      Fez('await-x', class {
        HTML = '{#await state.p}wait{:then v}{v}{/await}{#await state.q}wait{:catch e}err{/await}';
        init() {
          this.state.p = new Promise((r) => setTimeout(() => r(1), 40));
          this.state.q = new Promise((_, r) => setTimeout(() => r(new Error('x')), 40));
        }
      });
      app.innerHTML = '<await-x></await-x>';
      setTimeout(() => { app.innerHTML = ''; }, 10);
    },
    () => null,
  );
  expect(errors).toEqual([]);
});

test('fired timeouts and disposed listeners leave the destroy list', async () => {
  const { result } = await run(
    () => {
      Fez('cleanup-x', class { HTML = '<i></i>'; });
      app.innerHTML = '<cleanup-x></cleanup-x>';
      const f = Fez('cleanup-x');
      for (let i = 0; i < 50; i++) f.setTimeout(() => {}, 0);
      for (let i = 0; i < 50; i++) f.on('click', () => {})();
    },
    () => Fez('cleanup-x')._onDestroyCallbacks.size,
  );
  // the globalState proxy registers one
  expect(result).toBe(1);
});

test('setInterval keeps same-source closures apart, a name replaces', async () => {
  const { result } = await run(
    () => {
      window.ticks = { a: 0, b: 0, named: [] };
      Fez('interval-x', class {
        HTML = '<i></i>';
        onMount() {
          for (const k of ['a', 'b']) this.setInterval(() => window.ticks[k]++, 10);
          this.setInterval(() => window.ticks.named.push(1), 10, 'n');
          this.setInterval(() => window.ticks.named.push(2), 10, 'n');
        }
      });
      app.innerHTML = '<interval-x></interval-x>';
    },
    () => ({ a: window.ticks.a > 0, b: window.ticks.b > 0, named: [...new Set(window.ticks.named)] }),
  );
  expect(result).toEqual({ a: true, b: true, named: [2] });
});

test('a throwing component subscriber does not stop a global publish', async () => {
  const { result } = await run(
    () => {
      window.got = [];
      Fez('sub-x', class {
        HTML = '<i></i>';
        init() { this.subscribe('evt', (v) => { if (this.props.bad) throw new Error('bad'); window.got.push(v); }); }
      });
      app.innerHTML = '<sub-x bad="1"></sub-x><sub-x></sub-x>';
      const orig = console.error;
      console.error = () => {};
      Fez.publish('evt', 'ok');
      console.error = orig;
    },
    () => window.got,
  );
  expect(result).toEqual(['ok']);
});

test('state values written back from the store do not stack proxies', async () => {
  const { result } = await run(
    () => {
      window.changes = 0;
      Fez('stack-x', class {
        HTML = '<b>{state.todos.length}</b>';
        init() { this.state.todos = [{ done: false }]; }
        onStateChange() { window.changes++; }
      });
      app.innerHTML = '<stack-x></stack-x>';
      const f = Fez('stack-x');
      for (let i = 0; i < 50; i++) f.state.todos = [...f.state.todos, { done: false }];
      window.changes = 0;
      f.state.todos[0].done = true;
      f.state.user = { name: 'a' };
      f.state.user = { ...f.state.user, tags: f.state.todos };
    },
    () => ({ changes: window.changes, len: document.querySelector('b').textContent }),
  );
  expect(result).toEqual({ changes: 3, len: '51' });
});

test('a detached global state reader keeps its subscription', async () => {
  const { result } = await run(
    () => {
      Fez('gs-x', class { HTML = '<b>{globalState.gsVal || "none"}</b>'; });
      app.innerHTML = '<div id="host"><gs-x></gs-x></div>';
      const node = document.querySelector('.fez-gs-x');
      setTimeout(() => {
        node.remove();
        Fez.state.set('gsVal', 'a');
        document.getElementById('host').append(node);
        setTimeout(() => Fez.state.set('gsVal', 'b'), 30);
      }, 20);
    },
    () => document.querySelector('.fez-gs-x b').textContent,
  );
  expect(result).toBe('b');
});

test('fez-inline inserted late compiles its source, not mounted children', async () => {
  const { result } = await run(
    () => {
      Fez('inline-child', class { HTML = '<em>{props.v}</em>'; init() { window.childInits = (window.childInits || 0) + 1; } });
      Fez.state.set('inlineN', 5);
      app.innerHTML = '<fez-inline><inline-child v="x"></inline-child> {globalState.inlineN}</fez-inline>';
      setTimeout(() => Fez.state.set('inlineN', 6), 30);
    },
    () => ({
      text: document.querySelector('.fez-fez-inline').textContent,
      live: !!document.querySelector('.fez-inline-child')?.fez,
    }),
  );
  expect(result).toEqual({ text: 'x 6', live: true });
});

test('fez:bind binds a radio group by value', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent(`<script>${fezCode}</script><div id="app"></div>`);
    await page.evaluate(() => {
      Fez('radio-x', class {
        HTML = `{#for s in ['s', 'm', 'l']}<input type="radio" name="size" value={s} fez:bind="state.size" />{/for}<b>{state.size}</b>`;
        init() { this.state.size = 'm'; }
      });
      app.innerHTML = '<radio-x></radio-x>';
    });
    await page.waitForSelector('b');
    expect(await page.$$eval('input', (ns) => ns.map((n) => `${n.value}:${n.checked}`))).toEqual(['s:false', 'm:true', 'l:false']);
    await page.check('input[value=l]');
    await page.waitForFunction(() => document.querySelector('b').textContent === 'l');
    expect(await page.$$eval('input', (ns) => ns.map((n) => n.checked))).toEqual([false, false, true]);
  } finally {
    await context.close();
  }
});

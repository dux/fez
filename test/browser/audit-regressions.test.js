/**
 * Browser regressions for runtime fixes: getters, mount and destroy errors,
 * template errors, onSubmit, fez-component props, pubsub, loop refs, await
 * loops, attribute values and handler forms.
 *
 * Run: bun test test/browser/audit-regressions.test.js
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

// Runs `setup` in a fresh page, waits, then returns `check()` plus console errors
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

test('a getter on the class works as a template value and does not break mount', async () => {
  const { result, errors } = await run(
    () => {
      Fez('getter-x', class {
        HTML = '<p>{total}</p>';
        init() { this.state.items = [1, 2, 3]; }
        get total() { return this.state.items.length; }
      });
      app.innerHTML = '<getter-x></getter-x>';
      setTimeout(() => Fez('getter-x').state.items.push(4), 30);
    },
    () => document.querySelector('.getter-x-fez p')?.textContent,
  );
  expect(errors).toEqual([]);
  expect(result).toBe('4');
});

test('a template runtime error keeps the last rendered DOM', async () => {
  const { result, errors } = await run(
    () => {
      Fez('tpl-err', class {
        HTML = '<p>{state.user.name}</p>';
        init() { this.state.user = { name: 'Ann' }; }
      });
      app.innerHTML = '<tpl-err></tpl-err>';
      setTimeout(() => (Fez('tpl-err').state.user = null), 30);
    },
    () => document.querySelector('.tpl-err-fez p')?.textContent,
  );
  expect(result).toBe('Ann');
  expect(errors.some((e) => e.includes('template runtime error'))).toBe(true);
});

test('a throwing init is reported and leaves no live instance behind', async () => {
  const { result, errors } = await run(
    () => {
      Fez('init-err', class {
        HTML = '<p>x</p>';
        init() { this.setInterval(() => (window.ticks = (window.ticks || 0) + 1), 5); throw new Error('nope'); }
      });
      Fez('init-ok', class { HTML = '<p>ok</p>'; });
      app.innerHTML = '<init-err></init-err><init-ok></init-ok>';
    },
    () => ({
      instances: [...Fez.instances.values()].map((f) => f.fezName),
      ticks: window.ticks || 0,
      ok: document.querySelector('.init-ok-fez p')?.textContent,
    }),
  );
  expect(result).toEqual({ instances: ['init-ok'], ticks: 0, ok: 'ok' });
  expect(errors.some((e) => e.includes('failed to mount: nope'))).toBe(true);
});

test('a throwing onDestroy still releases the GLOBAL handle and the instance', async () => {
  const { result } = await run(
    () => {
      Fez('destroy-err', class {
        GLOBAL = 'DestroyErr';
        HTML = '<p>x</p>';
        onDestroy() { throw new Error('bad cleanup'); }
      });
      app.innerHTML = '<destroy-err></destroy-err>';
      setTimeout(() => (app.innerHTML = ''), 30);
    },
    () => ({ global: 'DestroyErr' in window, instances: Fez.instances.size }),
  );
  expect(result).toEqual({ global: false, instances: 0 });
});

test('onSubmit fires for a form rendered after mount', async () => {
  const { result } = await run(
    () => {
      Fez('late-form', class {
        HTML = '{#if state.show}<form><input name="q" value="hi"><button>go</button></form>{/if}';
        init() { this.state.show = false; }
        onSubmit(data) { window.submitted = data; }
      });
      app.innerHTML = '<late-form></late-form>';
      Fez('late-form').state.show = true;
      setTimeout(() => document.querySelector('.late-form-fez button').click(), 60);
    },
    () => window.submitted,
  );
  expect(result).toEqual({ q: 'hi' });
});

test('fez-component hands the child its props without `name`', async () => {
  const { result } = await run(
    () => {
      Fez('fc-child', class { HTML = '<p>{Object.keys(props).sort().join(",")}</p>'; });
      app.innerHTML = '<fez-component name="fc-child" title="t"></fez-component>';
    },
    () => document.querySelector('.fc-child-fez p')?.textContent,
  );
  expect(result).toBe('title');
});

test('a component moved in the DOM keeps its subscriptions', async () => {
  const { result } = await run(
    () => {
      Fez('sub-a', class {
        HTML = '<p>{state.n}</p>';
        init() { this.state.n = 0; this.subscribe('ping', () => this.state.n++); }
      });
      Fez('sub-b', class { HTML = '<i></i>'; init() { this.subscribe('ping', () => {}); } });
      app.innerHTML = '<div id="box"><sub-a></sub-a></div><sub-b></sub-b>';
      setTimeout(() => {
        const node = document.querySelector('.sub-a-fez');
        node.remove();
        // a subscribe while sub-a is detached must not drop it
        Fez('sub-b').subscribe('ping', () => {});
        document.getElementById('box').appendChild(node);
        Fez.publish('ping');
      }, 30);
    },
    () => document.querySelector('.sub-a-fez p')?.textContent,
  );
  expect(result).toBe('1');
});

test('static fez:this inside a loop gets one id per row and keeps each typed value', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.setContent(`<script>${fezCode}</script><div id="app"></div>`);
    await page.evaluate(() => {
      Fez('loop-refs', class {
        HTML = '{#each state.rows as row}<input fez:this="row" />{/each}<b>{state.n}</b>';
        init() { this.state.rows = [1, 2]; this.state.n = 0; }
      });
      app.innerHTML = '<loop-refs></loop-refs>';
    });
    await page.waitForSelector('b');
    const inputs = await page.$$('input');
    await inputs[0].fill('first');
    await inputs[1].fill('second');
    await page.evaluate(() => Fez('loop-refs').state.n++);
    await page.waitForFunction(() => document.querySelector('b').textContent === '1');
    expect(await page.$$eval('input', (ns) => ns.map((n) => n.value))).toEqual(['first', 'second']);
    const ids = await page.$$eval('input', (ns) => ns.map((n) => n.id));
    expect(new Set(ids).size).toBe(2);
  } finally {
    await context.close();
  }
});

test('an {#await} on a promise built by the template stops and reports instead of looping', async () => {
  const { result, errors } = await run(
    () => {
      window.calls = 0;
      Fez('await-loop', class {
        HTML = '{#await load()}<i>…</i>{:then v}<b>{v}</b>{/await}';
        load() { window.calls++; return Promise.resolve('done'); }
      });
      app.innerHTML = '<await-loop></await-loop>';
    },
    () => ({ calls: window.calls, text: document.querySelector('.await-loop-fez b')?.textContent }),
    400,
  );
  expect(result.text).toBe('done');
  expect(result.calls).toBeLessThan(8);
  expect(errors.some((e) => e.includes('new promise on every render'))).toBe(true);
});

test('Fez.find on a selector that matches nothing returns undefined', async () => {
  const { result, errors } = await run(
    () => {},
    () => Fez.find('#missing') === undefined,
  );
  expect(result).toBe(true);
  expect(errors).toEqual([]);
});

test('attribute values: false booleans drop, :prop={expr} and onclick={method} work', async () => {
  const { result } = await run(
    () => {
      Fez('attr-child', class { HTML = '<em>{props.label}</em>'; });
      Fez('attr-x', class {
        HTML = '<p hidden={state.hide} aria-expanded={state.hide}>p</p><attr-child :label={state.label} /><button onclick={bump}>{state.n}</button>';
        init() { this.state.hide = false; this.state.label = 'Hello World'; this.state.n = 0; }
        bump(event) { this.state.n += event.type === 'click' ? 1 : 100; }
      });
      app.innerHTML = '<attr-x></attr-x>';
      setTimeout(() => document.querySelector('.attr-x-fez button').click(), 30);
    },
    () => {
      const p = document.querySelector('.attr-x-fez p');
      return {
        hidden: p.hidden,
        aria: p.getAttribute('aria-expanded'),
        label: document.querySelector('.attr-child-fez em')?.textContent,
        n: document.querySelector('.attr-x-fez button').textContent,
      };
    },
  );
  expect(result).toEqual({ hidden: false, aria: 'false', label: 'Hello World', n: '1' });
});

test('an array of strings renders escaped text, never HTML', async () => {
  const { result } = await run(
    () => {
      Fez('esc-x', class { HTML = '<p>{state.list}</p>'; init() { this.state.list = ['<img src=x onerror="window.pwned=1">']; } });
      app.innerHTML = '<esc-x></esc-x>';
    },
    () => ({ img: !!document.querySelector('.esc-x-fez img'), pwned: !!window.pwned }),
  );
  expect(result).toEqual({ img: false, pwned: false });
});

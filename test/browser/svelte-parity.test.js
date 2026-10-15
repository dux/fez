/**
 * Browser tests for the Svelte-parity features: keyed each, getters, tick(),
 * context, {@const}, {#key}, style: and the onError boundary.
 *
 * Run: bun test test/browser/svelte-parity.test.js
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

test('keyed each keeps each child instance with its item across a reorder', async () => {
  const { result } = await run(
    () => {
      Fez('kid-row', class { HTML = '<i>{props.label}</i>'; init() { this.state.born = this.props.label; } });
      Fez('keyed-list', class {
        HTML = '{#each state.rows as row (row.id)}<kid-row label={row.id} />{/each}';
        init() { this.state.rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; }
      });
      app.innerHTML = '<keyed-list></keyed-list>';
      setTimeout(() => Fez('keyed-list').state.rows.reverse(), 40);
    },
    () => [...document.querySelectorAll('.kid-row-fez')].map((n) => `${n.textContent}:${n.fez.state.born}`),
  );
  expect(result).toEqual(['c:c', 'b:b', 'a:a']);
});

test('tick() resolves after the pending render reached the DOM', async () => {
  const { result } = await run(
    async () => {
      Fez('tick-x', class { HTML = '<p>{state.n}</p>'; init() { this.state.n = 0; } });
      app.innerHTML = '<tick-x></tick-x>';
      const f = Fez('tick-x');
      f.state.n = 5;
      const before = f.find('p').textContent;
      await f.tick();
      window.tickResult = [before, f.find('p').textContent];
    },
    () => window.tickResult,
  );
  expect(result).toEqual(['0', '5']);
});

test('context is provided by an ancestor and read in a descendant init', async () => {
  const { result } = await run(
    () => {
      Fez('ctx-leaf', class { HTML = '<b>{state.theme.color}</b>'; init() { this.state.theme = this.context('theme'); } });
      Fez('ctx-mid', class { HTML = '<ctx-leaf />'; });
      Fez('ctx-root', class { HTML = '<ctx-mid />'; init() { this.context('theme', { color: 'teal' }); } });
      app.innerHTML = '<ctx-root></ctx-root>';
    },
    () => ({
      leaf: document.querySelector('.ctx-leaf-fez b')?.textContent,
      missing: Fez('ctx-root').context('nope'),
    }),
  );
  expect(result).toEqual({ leaf: 'teal' });
});

test('{#key} recreates its body when the value changes', async () => {
  const { result } = await run(
    () => {
      Fez('key-x', class { HTML = '{#key state.k}<p>{state.k}</p>{/key}'; init() { this.state.k = 1; } });
      app.innerHTML = '<key-x></key-x>';
      setTimeout(() => {
        window.firstP = document.querySelector('.key-x-fez p');
        Fez('key-x').state.k = 2;
      }, 40);
    },
    () => ({ same: document.querySelector('.key-x-fez p') === window.firstP, text: document.querySelector('.key-x-fez p').textContent }),
  );
  expect(result).toEqual({ same: false, text: '2' });
});

test('style: directives and {@const} render in a component', async () => {
  const { result } = await run(
    () => {
      Fez('style-x', class {
        HTML = '{@const w = state.w * 2}<p style:width={w + "px"} style:color={state.off}>{w}</p>';
        init() { this.state.w = 10; this.state.off = false; }
      });
      app.innerHTML = '<style-x></style-x>';
    },
    () => {
      const p = document.querySelector('.style-x-fez p');
      return { width: p.style.width, color: p.style.color, text: p.textContent };
    },
  );
  expect(result).toEqual({ width: '20px', color: '', text: '20' });
});

test('onError on an ancestor catches a descendant mount error and renders a fallback', async () => {
  const { result, errors } = await run(
    () => {
      Fez('bad-kid', class { HTML = '<p>never</p>'; init() { throw new Error('kid failed'); } });
      Fez('boundary-x', class {
        HTML = '{#if state.error}<em>{state.error}</em>{:else}<bad-kid />{/if}';
        init() { this.state.error = null; }
        onError(error, child) { this.state.error = `${child.fezName}: ${error.message}`; }
      });
      app.innerHTML = '<boundary-x></boundary-x>';
    },
    () => document.querySelector('.boundary-x-fez em')?.textContent,
  );
  expect(result).toBe('bad-kid: kid failed');
  expect(errors.filter((e) => e.includes('failed to mount'))).toEqual([]);
});

test('onError also catches a descendant template runtime error', async () => {
  const { result } = await run(
    () => {
      Fez('tpl-kid', class { HTML = '<p>{state.user.name}</p>'; init() { this.state.user = { name: 'a' }; } });
      Fez('boundary-y', class {
        HTML = '<tpl-kid /><em>{state.error || ""}</em>';
        onError(error) { this.state.error = 'caught'; }
      });
      app.innerHTML = '<boundary-y></boundary-y>';
      setTimeout(() => (Fez('tpl-kid').state.user = null), 40);
    },
    () => document.querySelector('.boundary-y-fez em').textContent,
  );
  expect(result).toBe('caught');
});

/**
 * Browser tests for the <fez-component> built-in.
 *
 * It mounts the component named by `name` with `props`, hands later prop
 * changes to the same child (re-render + onRefresh, like a parent re-render),
 * swaps the child when `name` changes, and shows its own children when no
 * component by that name is registered.
 *
 * Run: bun test test/browser/fez-component.test.js
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

async function createTestPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html><head><title>fez-component</title></head>
    <body><div id="app"></div><script>${fezCode}</script></body></html>
  `);
  await page.waitForFunction(() => window.Fez !== undefined, { timeout: 5000 });
  // x-host routes like an app shell: state.page picks the component, state.query is its props
  await page.evaluate(() => {
    window.log = { inits: [], refreshes: [] };

    window.Fez('x-page-a', class {
      init(props) { window.log.inits.push(['a', props.item]); }
      onRefresh(props, changed) { window.log.refreshes.push(['a', props.item, { ...changed }]); }
      HTML = '<b class="page-a">A {props.item}</b>';
    });

    window.Fez('x-page-b', class {
      init() { window.log.inits.push(['b']); }
      HTML = '<b class="page-b">B</b>';
    });

    window.Fez('x-host', class {
      init() {
        this.state.page = 'x-page-a';
        this.state.query = { item: 'one' };
        this.state.tick = 0;
        window.host = this;
      }
      HTML = '<i class="tick">{state.tick}</i><fez-component name={state.page} :props="state.query"><p class="missing">Not found</p></fez-component>';
    });

    document.getElementById('app').innerHTML = '<x-host></x-host>';
  });
  await page.waitForSelector('.page-a');
  page._context = context;
  return page;
}

async function closePage(page) {
  try { await page._context?.close(); } catch (e) {}
}

const text = (page, selector) => page.evaluate((s) => document.querySelector(s)?.textContent, selector);

test('mounts the named component with props, fallback stays hidden', async () => {
  const page = await createTestPage();
  try {
    expect(await text(page, '.page-a')).toBe('A one');
    expect(await page.$('.missing')).toBeNull();
    expect(await page.evaluate(() => window.log.inits)).toEqual([['a', 'one']]);
  } finally {
    await closePage(page);
  }
});

test('a prop change reaches the same child: re-render and onRefresh, no remount', async () => {
  const page = await createTestPage();
  try {
    await page.evaluate(() => { window.host.state.query = { item: 'two' }; });
    await page.waitForFunction(() => document.querySelector('.page-a')?.textContent === 'A two');

    const log = await page.evaluate(() => window.log);
    expect(log.inits).toEqual([['a', 'one']]);
    expect(log.refreshes.at(-1)).toEqual(['a', 'two', { item: 'two' }]);
  } finally {
    await closePage(page);
  }
});

test('onRefresh(props, changed): every prop at mount, only the changed ones later', async () => {
  const page = await createTestPage();
  try {
    expect(await page.evaluate(() => window.log.refreshes)).toEqual([['a', 'one', { item: 'one' }]]);

    // a parent re-render that leaves the props alone still fires onRefresh, with nothing changed
    await page.evaluate(() => { window.host.state.tick = 1; });
    await page.waitForFunction(() => window.log.refreshes.length === 2);
    expect(await page.evaluate(() => window.log.refreshes[1])).toEqual(['a', 'one', {}]);

    await page.evaluate(() => { window.host.state.query = { item: 'two' }; });
    await page.waitForFunction(() => window.log.refreshes.length === 3);
    expect(await page.evaluate(() => window.log.refreshes[2])).toEqual(['a', 'two', { item: 'two' }]);
  } finally {
    await closePage(page);
  }
});

test('a name change swaps the child, an unknown name shows the fallback', async () => {
  const page = await createTestPage();
  try {
    await page.evaluate(() => { window.host.state.page = 'x-page-b'; });
    await page.waitForSelector('.page-b');
    expect(await page.$('.page-a')).toBeNull();

    await page.evaluate(() => { window.host.state.page = 'x-nope'; });
    await page.waitForSelector('.missing');
    expect(await text(page, '.missing')).toBe('Not found');
    expect(await page.$('.page-b')).toBeNull();

    await page.evaluate(() => { window.host.state.page = 'x-page-a'; });
    await page.waitForSelector('.page-a');
    expect(await page.$('.missing')).toBeNull();
    expect(await page.evaluate(() => window.log.inits)).toEqual([['a', 'one'], ['b'], ['a', 'one']]);
  } finally {
    await closePage(page);
  }
});

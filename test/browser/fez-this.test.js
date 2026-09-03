/**
 * Browser tests for fez:this: refs land in this.state without scheduling a
 * render, survive re-renders (input values included) and never shadow methods.
 *
 * Run: bun test test/browser/fez-this.test.js
 */

import { test, expect, setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');

setDefaultTimeout(30000);

const fezCode = readFileSync(join(ROOT_DIR, 'dist/fez.js'), 'utf-8');

let browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function createTestPage(html = '') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html><head><title>Fez fez:this</title></head>
    <body>
      ${html}
      <script>${fezCode}</script>
      <script>window.testResults = {};</script>
    </body></html>
  `);
  await page.waitForFunction(() => window.Fez !== undefined, { timeout: 5000 });
  page._context = context;
  return page;
}

async function closePage(page) {
  try { await page._context?.close(); } catch (e) {}
}

test('fez:this - ref is delivered on this.state, not on the instance, without a state change event', async () => {
  const page = await createTestPage('<x-ref></x-ref>');
  try {
    await page.evaluate(() => {
      window.Fez('x-ref', class {
        // a ref named like a method must not clobber it
        refresh() { return 'method'; }
        onStateChange(k) { (window.testResults.changes ||= []).push(k); }
        onMount() {
          window.testResults.mount = {
            isNode: this.state.box instanceof HTMLElement,
            id: this.state.box.id,
            onInstance: Object.prototype.hasOwnProperty.call(this, 'box'),
            refreshIsMethod: typeof this.refresh === 'function' && this.refresh() === 'method',
            refNamedRefresh: this.state.refresh instanceof HTMLElement,
          };
        }
        HTML = '<div fez:this="box" class="box"></div><i fez:this="refresh"></i>';
      });
    });
    await page.waitForFunction(() => window.testResults.mount, { timeout: 3000 });
    const r = await page.evaluate(() => window.testResults.mount);
    expect(r.isNode).toBe(true);
    expect(r.id).toMatch(/^fez-\d+-box$/);
    expect(r.onInstance).toBe(false);
    expect(r.refreshIsMethod).toBe(true);
    expect(r.refNamedRefresh).toBe(true);
    expect(await page.evaluate(() => window.testResults.changes)).toBeUndefined();
  } finally {
    await closePage(page);
  }
});

test('fez:this - typed input value survives a re-render, ref points at the live node, no render loop', async () => {
  const page = await createTestPage('<x-form></x-form>');
  try {
    await page.evaluate(() => {
      window.Fez('x-form', class {
        init() { this.state.n = 0; }
        afterRender() { window.testResults.renders = (window.testResults.renders || 0) + 1; }
        bump() { this.state.n++; }
        read() { return this.state.nameInput.value; }
        HTML = '<b class="n">{state.n}</b><input fez:this="nameInput" />';
      });
    });
    await page.waitForSelector('input');
    await page.fill('input', 'typed');
    await page.evaluate(() => document.querySelector('.fez-x-form').fez.bump());
    await page.waitForFunction(() => document.querySelector('.n').textContent === '1', { timeout: 3000 });
    await page.waitForTimeout(150);

    expect(await page.inputValue('input')).toBe('typed');
    expect(await page.evaluate(() => document.querySelector('.fez-x-form').fez.read())).toBe('typed');
    expect(await page.evaluate(() => {
      const fez = document.querySelector('.fez-x-form').fez;
      return fez.state.nameInput === document.querySelector('input');
    })).toBe(true);
    // the ref re-assignment on each render must not schedule another render
    expect(await page.evaluate(() => window.testResults.renders)).toBe(2);
  } finally {
    await closePage(page);
  }
});

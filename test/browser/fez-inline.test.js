/**
 * Browser tests for the <fez-inline> built-in.
 *
 * Children of <fez-inline> are compiled as the instance template, so
 * expressions see props / state / globalState and re-render on change.
 *
 * Run: bun test test/browser/fez-inline.test.js
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

// Fez is injected before the markup so <fez-inline> connects as the parser
// reaches it, same as a real page with fez.js in <head>. The rendered root is
// a <span class="fez fez-fez-inline">, the custom tag itself is replaced.
async function createTestPage(html) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><script>${fezCode}</script></head>
    <body>${html}</body>
    </html>
  `);
  await page.waitForFunction(() => window.Fez !== undefined);
  return page;
}

async function closePage(page) {
  await page.context().close();
}

test('renders children as template with props', async () => {
  const page = await createTestPage(`
    <fez-inline name="World">Hello <b class="who">{props.name}</b></fez-inline>
  `);

  try {
    await page.waitForSelector('.who');
    expect(await page.textContent('.who')).toBe('World');
    expect(await page.textContent('.fez-fez-inline')).toContain('Hello World');
  } finally {
    await closePage(page);
  }
});

test('re-renders when a read globalState key changes', async () => {
  const page = await createTestPage(`
    <fez-inline><span class="user">{globalState.user || 'guest'}</span></fez-inline>
  `);

  try {
    await page.waitForSelector('.user');
    expect(await page.textContent('.user')).toBe('guest');

    await page.evaluate(() => Fez.state.set('user', 'Alice'));
    await page.waitForFunction(() => document.querySelector('.user')?.textContent === 'Alice');

    await page.evaluate(() => Fez.state.set('user', 'Bob'));
    await page.waitForFunction(() => document.querySelector('.user')?.textContent === 'Bob');
  } finally {
    await closePage(page);
  }
});

test(':state seeds local state and handlers re-render it', async () => {
  const page = await createTestPage(`
    <fez-inline :state="{n: 1}">
      <button class="inc" onclick="fez.state.n++">{state.n}</button>
    </fez-inline>
  `);

  try {
    await page.waitForSelector('.inc');
    expect(await page.textContent('.inc')).toBe('1');

    await page.click('.inc');
    await page.waitForFunction(() => document.querySelector('.inc')?.textContent === '2');

    await page.click('.inc');
    await page.waitForFunction(() => document.querySelector('.inc')?.textContent === '3');
  } finally {
    await closePage(page);
  }
});

test('{#if} with comparison survives the innerHTML entity round trip', async () => {
  const page = await createTestPage(`
    <fez-inline :state="{n: 0}">
      <button class="inc" onclick="fez.state.n++">+</button>
      {#if state.n > 1}<span class="many">many</span>{:else}<span class="few">few</span>{/if}
    </fez-inline>
  `);

  try {
    await page.waitForSelector('.few');
    expect(await page.$('.many')).toBeNull();

    await page.click('.inc');
    await page.click('.inc');
    await page.waitForSelector('.many');
    expect(await page.$('.few')).toBeNull();
  } finally {
    await closePage(page);
  }
});

test('empty fez-inline renders nothing and does not throw', async () => {
  const page = await createTestPage(`<fez-inline></fez-inline><span class="after">ok</span>`);

  try {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForSelector('.after');
    await page.waitForTimeout(100);
    expect((await page.textContent('.fez-fez-inline')).trim()).toBe('');
    expect(errors).toEqual([]);
  } finally {
    await closePage(page);
  }
});

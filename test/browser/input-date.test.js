/**
 * Browser tests for the local input-date picker (pages_src/root/fez/input-date.fez).
 *
 * Run: bun test test/browser/input-date.test.js
 */

import { test, expect, setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');
const fezCode = readFileSync(join(ROOT_DIR, 'dist/fez.js'), 'utf-8');
const source = readFileSync(join(ROOT_DIR, 'pages_src/root/fez/input-date.fez'), 'utf-8');

setDefaultTimeout(30000);

let browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function createPage(html) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  page.errors = [];
  page.requests = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('request', (r) => page.requests.push(r.url()));
  await page.setContent(`<!DOCTYPE html><html><head><script>${fezCode}</script></head><body></body></html>`);
  await page.evaluate(
    ({ source, html }) => {
      window.changes = [];
      Fez.compile('input-date', source);
      document.body.innerHTML = html;
    },
    { source, html },
  );
  await page.waitForSelector('.input-date-fez .btn');
  return page;
}

const trigger = '.input-date-fez .btn >> nth=0';
const hidden = (page) => page.$eval('.input-date-fez input[type=hidden]', (n) => n.value);

test('picks a date: button, hidden form value and onchange; nothing loads from the network', async () => {
  const page = await createPage(
    '<form><input-date name="d" value="2024-01-15" :onchange="(v) => window.changes.push(v)"></input-date></form>',
  );
  try {
    expect(await page.textContent(trigger)).toBe('15.01.2024');
    expect(await hidden(page)).toBe('15.01.2024');

    await page.click(trigger);
    await page.waitForSelector('.calendar');
    expect(await page.$eval('.day.selected', (n) => n.textContent)).toBe('15');
    expect(await page.$eval('.month', (n) => n.value)).toBe('0');
    expect(await page.$eval('.year', (n) => n.value)).toBe('2024');
    expect(await page.$$eval('.day', (ns) => ns.length)).toBe(42);
    // Jan 2024 starts on a Monday: the grid opens with Sunday Dec 31
    expect(await page.$eval('.day', (n) => [n.textContent, n.classList.contains('other')])).toEqual(['31', true]);

    await page.click('.day:not(.other) >> text="22"');
    await page.waitForSelector('.calendar', { state: 'detached' });
    expect(await page.textContent(trigger)).toBe('22.01.2024');
    expect(await page.evaluate(() => Object.fromEntries(new FormData(document.querySelector('form'))))).toEqual({ d: '22.01.2024' });
    expect(await page.evaluate(() => window.changes)).toEqual(['22.01.2024']);

    await page.click('.close');
    await page.waitForFunction(() => document.querySelector('.input-date-fez .btn').textContent === 'Select date');
    expect(await hidden(page)).toBe('');
    expect(await page.evaluate(() => window.changes)).toEqual(['22.01.2024', '']);

    expect(page.requests.filter((url) => url.startsWith('http'))).toEqual([]);
    expect(page.errors).toEqual([]);
  } finally {
    await page.context().close();
  }
});

test('month navigation: arrows, month select and year input', async () => {
  const page = await createPage('<input-date value="2024-01-15"></input-date>');
  try {
    await page.click(trigger);
    await page.click('.prev');
    await page.waitForFunction(() => document.querySelector('.month').value === '11');
    expect(await page.$eval('.year', (n) => n.value)).toBe('2023');

    await page.click('.next');
    await page.click('.next');
    await page.waitForFunction(() => document.querySelector('.month').value === '1');

    await page.selectOption('.month', '5');
    await page.waitForFunction(() => document.querySelector('.day:not(.other)')?.parentNode.children.length === 42);
    await page.fill('.year', '2030');
    // June 2030 starts on a Saturday
    await page.waitForFunction(() => document.querySelectorAll('.day.other')[5]?.textContent === '31');
    expect(await page.$eval('.day:not(.other)', (n) => n.textContent)).toBe('1');
    expect(await page.$eval('.month', (n) => n.value)).toBe('5');
    expect(page.errors).toEqual([]);
  } finally {
    await page.context().close();
  }
});

test('initial value as a day offset, title fallback, Esc and outside click close', async () => {
  const page = await createPage('<input-date value="-1"></input-date><input-date title="Pick"></input-date><p id="out">out</p>');
  try {
    const expected = await page.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    });
    expect(await page.textContent(trigger)).toBe(expected);
    expect(await page.textContent('.input-date-fez >> nth=1 >> .btn')).toBe('Pick');

    await page.click(trigger);
    await page.waitForSelector('.calendar');
    expect(await page.$$eval('.day.today', (ns) => ns.length)).toBe(1);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.calendar', { state: 'detached' });

    await page.click(trigger);
    await page.waitForSelector('.calendar');
    await page.click('#out');
    await page.waitForSelector('.calendar', { state: 'detached' });
    expect(page.errors).toEqual([]);
  } finally {
    await page.context().close();
  }
});

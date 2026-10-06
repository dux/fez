/**
 * Drives the kitchen-sink demo (pages_src/root/fez/demo-kitchen-sink.fez), which
 * combines most Fez features in one app, and checks they work together.
 *
 * Run: bun test test/browser/kitchen-sink.test.js
 */

import { test, expect, setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');
const fezCode = readFileSync(join(ROOT_DIR, 'dist/fez.js'), 'utf-8');
const demoSource = readFileSync(join(ROOT_DIR, 'pages_src/root/fez/demo-kitchen-sink.fez'), 'utf-8');

setDefaultTimeout(30000);

let browser;
let context;
let page;
const errors = [];

beforeAll(async () => {
  browser = await chromium.launch();
  context = await browser.newContext();
  page = await context.newPage();
  page.setDefaultTimeout(3000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // a real origin, so Fez.localStorage works
  await page.route('http://kitchen.test/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!DOCTYPE html><html><head><script>${fezCode}</script></head>
        <body style="height: 3000px"><div id="demo"></div></body></html>`,
    }),
  );
  await page.goto('http://kitchen.test/');
  await page.evaluate((source) => {
    Fez.compile('demo-kitchen-sink', source);
    Fez.index.apply('demo-kitchen-sink', document.querySelector('#demo'));
  }, demoSource);
  await page.waitForSelector('.remote');
});

afterAll(async () => {
  await browser?.close();
});

const text = (selector) => page.textContent(selector).then((t) => t.trim());
const count = (selector) => page.$$eval(selector, (nodes) => nodes.length);
const until = (fn, arg) => page.waitForFunction(fn, arg);

test('first render: board, await, stats, slots, inline, toast host', async () => {
  expect(await count('.fez-kitchen-card')).toBe(3);
  expect(await count('article.high')).toBe(1);
  expect(await count('article.done')).toBe(1);
  expect(await text('.remote')).toBe('Owner dux has 42 stars');
  expect(await text('.count')).toBe('3');
  expect(await page.$eval('.note', (n) => n.innerHTML)).toBe('Rendered with <b>{@html}</b>');
  expect(await page.$$eval('ul.unwrapped > li', (n) => n.length)).toBe(2);
  expect(await text('.inline')).toBe('Total tasks: 3');
  // mount counts: onRefresh fires with every prop in `changed`
  expect(await text('.home')).toBe('hi (greeting changes: 1)');
  expect(await page.evaluate(() => [!!window.KitchenToast, Fez.state.get('kitchenStatsLabel')])).toEqual([true, 'live']);
  expect(await page.$eval('.fez-kitchen-form input[name=name]', (n) => n.dataset.ready)).toBe('yes');
  // the declaration mixin expanded inside the scoped style
  expect(await page.$eval('article.card', (n) => getComputedStyle(n).paddingLeft)).toBe('10px');
});

test('adding a task updates the board, global state, fez-inline and shows a toast', async () => {
  await page.fill('input.title', 'Fourth');
  await page.click('button.add');
  await until(() => document.querySelectorAll('.fez-kitchen-card').length === 4);
  expect(await text('.count')).toBe('4');
  expect(await text('.inline')).toBe('Total tasks: 4');
  expect(await page.inputValue('input.title')).toBe('');
  expect(await count('.fez-kitchen-toast .toast')).toBe(1);

  // strict click handler on the toast itself dismisses it
  await page.click('.fez-kitchen-toast .toast');
  await until(() => !document.querySelector('.fez-kitchen-toast .toast'));
});

test('cards bubble moves to the board, which bubbles to the app', async () => {
  await page.click('[data-id="1"] .right');
  await until(() => document.querySelector('[data-id="1"]')?.closest('section').dataset.col === 'doing');
  expect(await text('.events')).toBe('moved Write spec');

  await page.click('[data-id="3"] .right');
  await page.waitForSelector('.toast.error');
});

test('function prop, filter through fez:this, delete through an arrow handler', async () => {
  await page.click('[data-id="2"] span');
  await page.waitForSelector('.selected');
  expect(await text('.selected')).toBe('Selected: Build compiler');

  await page.fill('input.filter', 'ship');
  await until(() => document.querySelectorAll('.fez-kitchen-card').length === 1);
  expect(await count('p.empty')).toBe(2);
  expect(await page.inputValue('input.filter')).toBe('ship');
  await page.fill('input.filter', '');
  await until(() => document.querySelectorAll('.fez-kitchen-card').length === 4);

  await page.click('.task:has([data-id="4"]) button.del');
  await until(() => document.querySelectorAll('.fez-kitchen-card').length === 3);
});

test('fez-component outlet keeps the page on prop changes and swaps it on name changes', async () => {
  await page.click('button.greet');
  await until(() => document.querySelector('.home')?.textContent.trim() === 'yo (greeting changes: 2)');

  await page.click('button.go-about');
  await page.waitForSelector('.about');
  expect(await text('.about')).toBe('About page, greeting yo');

  await page.click('button.go-missing');
  await page.waitForSelector('.fallback');

  await page.click('button.go-home');
  await until(() => document.querySelector('.home')?.textContent.trim() === 'yo (greeting changes: 1)');
});

test('fez:bind covers text, select, checkbox, radio and textarea', async () => {
  expect(await page.$eval('.fez-kitchen-form input[value=m]', (n) => n.checked)).toBe(true);

  await page.fill('.fez-kitchen-form input[name=name]', 'Bob');
  await page.selectOption('.fez-kitchen-form select', 'ops');
  await page.uncheck('.fez-kitchen-form input[type=checkbox]');
  await page.check('.fez-kitchen-form input[value=l]');
  await page.fill('.fez-kitchen-form textarea', 'Bio');
  await until(() => document.querySelector('.echo').textContent.trim() === 'Bob | ops | false | l | Bio');

  await page.click('.fez-kitchen-form button[type=submit]');
  await page.waitForSelector('.submitted');
  expect(JSON.parse(await text('.submitted'))).toEqual({ name: 'Bob', role: 'ops', size: 'l', bio: 'Bio' });
});

test('the controller component keeps ticking through parent renders and reads PROPS', async () => {
  const first = await page.evaluate(() => document.querySelector('.fez-kitchen-ticker').fez.state.n);
  expect(first % 2).toBe(0);
  await page.click('button.greet');
  await until((n) => document.querySelector('.fez-kitchen-ticker').fez.state.n > n, first);

  await page.evaluate(() => Fez(document.querySelector('.fez-kitchen-ticker')).setAttribute('step', '3'));
  expect(await page.evaluate(() => document.querySelector('.fez-kitchen-ticker').fez.props.step)).toBe(3);

  await page.mouse.wheel(0, 400);
  await until(() => document.querySelector('.fez-kitchen-ticker').fez.state.scrolls > 0);
});

test('dark mode is scoped to the demo and remembered', async () => {
  await page.click('button.theme');
  await until(() => document.querySelector('.shell').classList.contains('dark'));
  expect(await page.$eval('.shell', (n) => getComputedStyle(n).getPropertyValue('--kitchen-bg').trim())).toBe('#222');
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
  expect(await page.evaluate(() => Fez.localStorage.get('kitchen-dark'))).toBe(true);
  await page.click('button.theme');
});

test('GLOBAL_STATE keys follow the stats component in and out', async () => {
  await page.click('button.stats-toggle');
  await page.waitForSelector('.no-stats');
  expect(await page.evaluate(() => [Fez.state.get('kitchenStatsMounted'), Fez.state.get('kitchenStatsLabel')])).toEqual([undefined, undefined]);

  await page.click('button.stats-toggle');
  await page.waitForSelector('.count');
  expect(await text('.count')).toBe('3');
});

test('removing the app stops its timers and logs no errors', async () => {
  const before = await page.evaluate(() => {
    window.kitchenTicker = document.querySelector('.fez-kitchen-ticker').fez;
    document.querySelector('.fez-kitchen-app').remove();
    return window.kitchenTicker.state.n;
  });
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.kitchenTicker.state.n)).toBe(before);
  expect(errors).toEqual([]);
});

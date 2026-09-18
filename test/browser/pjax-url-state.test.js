import { test, expect, beforeAll, afterAll, setDefaultTimeout } from 'bun:test';
import { chromium } from 'playwright';

setDefaultTimeout(30000);

let browser;
let fezCode;

beforeAll(async () => {
  const build = await Bun.build({
    entrypoints: ['./src/fez.js'],
    target: 'browser',
    format: 'iife',
  });
  if (!build.success) throw new AggregateError(build.logs, 'Failed to build Fez');
  fezCode = await build.outputs[0].text();
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function createPage() {
  const page = await browser.newPage();
  await page.route('https://fez.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><main id="pjax" class="pjax"><input id="draft"></main></body></html>',
    }),
  );
  await page.goto('https://fez.test/catalog?keep=query');
  await page.addScriptTag({ content: fezCode });
  await page.evaluate(() => {
    window.loads = [];
    window.swaps = [];
    window.events = [];
    window.originalMain = document.getElementById('pjax');
    Pjax.load = (...args) => window.loads.push(args);
    Pjax.setPageBody = (...args) => window.swaps.push(args);
    window.addEventListener('popstate', () => window.events.push('popstate'));
    window.addEventListener('hashchange', () => window.events.push('hashchange'));
  });
  return page;
}

async function settleHistory(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

test('hash Back/Forward preserves the mounted page, including return to an empty hash', async () => {
  const page = await createPage();
  try {
    await page.locator('#draft').fill('unsaved text');
    const before = await page.evaluate(() => history.length);
    await page.evaluate(() => {
      Pjax.hash('tab', 'overview');
      Pjax.hash('tab', 'settings');
      Pjax.hash('tab', 'users', { replace: true });
    });
    expect(await page.evaluate(() => history.length)).toBe(before + 2);
    expect(await page.evaluate(() => window.events)).toEqual([]);

    await page.goBack();
    await page.waitForFunction(() => Pjax.hash('tab') === 'overview');
    await page.goBack();
    await page.waitForFunction(() => location.hash === '');
    await page.goForward();
    await page.waitForFunction(() => Pjax.hash('tab') === 'overview');
    await page.goForward();
    await page.waitForFunction(() => Pjax.hash('tab') === 'users');
    await settleHistory(page);

    expect(await page.locator('#draft').inputValue()).toBe('unsaved text');
    expect(
      await page.evaluate(() => ({
        loads: window.loads,
        swaps: window.swaps,
        sameNode: document.getElementById('pjax') === window.originalMain,
      })),
    ).toEqual({ loads: [], swaps: [], sameNode: true });
  } finally {
    await page.close();
  }
});

test('query state has the same history options and preserves hash state', async () => {
  const page = await createPage();
  try {
    const result = await page.evaluate(() => {
      Pjax.hash('tab', 'settings');
      const before = history.length;
      Pjax.qs('page', 2);
      Pjax.qs('page', 3, { replace: true });
      return {
        added: history.length - before,
        value: Pjax.qs('page'),
        hash: Pjax.hash('tab'),
        preview: Pjax.qs('page', 4, { href: true, replace: true }),
        href: location.pathname + location.search + location.hash,
        loads: window.loads,
        events: window.events,
      };
    });
    expect(result).toEqual({
      added: 1,
      value: '3',
      hash: 'settings',
      preview: '/catalog?keep=query&page=4#tab=settings',
      href: '/catalog?keep=query&page=3#tab=settings',
      loads: [],
      events: [],
    });
  } finally {
    await page.close();
  }
});

test('hash traversal after page navigation is skipped, but returning to another path still loads', async () => {
  const page = await createPage();
  try {
    await page.evaluate(() => {
      new Pjax({ path: '/other' }).historyAddCurrent('/other');
      Pjax.hash('tab', 'settings');
    });
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/other' && location.hash === '');
    await settleHistory(page);
    expect(await page.evaluate(() => window.loads)).toEqual([]);

    await page.goBack();
    await page.waitForFunction(() => window.loads.length === 1);
    expect(await page.evaluate(() => window.loads)).toEqual([
      ['/catalog?keep=query', { history: false }],
    ]);
  } finally {
    await page.close();
  }
});

test('query Back/Forward still invokes Pjax page navigation', async () => {
  const page = await createPage();
  try {
    await page.evaluate(() => Pjax.qs('page', 2));
    await page.goBack();
    await page.waitForFunction(() => window.loads.length === 1);
    expect(await page.evaluate(() => window.loads)).toEqual([
      ['/catalog?keep=query', { history: false }],
    ]);
  } finally {
    await page.close();
  }
});

test('hash state demo updates its selected tab on Back/Forward', async () => {
  const page = await createPage();
  try {
    const source = await Bun.file('./pages_src/root/fez/demo-hash-state.fez').text();
    await page.evaluate((source) => {
      Fez.compile('demo-hash-state', source);
      document.getElementById('pjax').append(document.createElement('demo-hash-state'));
    }, source);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('strong')?.textContent === 'settings');
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('strong')?.textContent === 'overview');
    await page.goForward();
    await page.waitForFunction(() => document.querySelector('strong')?.textContent === 'settings');
    expect(
      await page
        .getByRole('button', { name: 'Settings', exact: true })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(await page.evaluate(() => window.loads)).toEqual([]);
  } finally {
    await page.close();
  }
});

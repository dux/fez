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
    Fez.pjax.load = (...args) => window.loads.push(args);
    Fez.pjax.setPageBody = (...args) => window.swaps.push(args);
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
      Fez.hash('tab', 'overview');
      Fez.hash('tab', 'settings');
      Fez.hash('tab', 'users', { replace: true });
    });
    expect(await page.evaluate(() => history.length)).toBe(before + 2);
    expect(await page.evaluate(() => window.events)).toEqual([]);

    await page.goBack();
    await page.waitForFunction(() => Fez.hash('tab') === 'overview');
    await page.goBack();
    await page.waitForFunction(() => location.hash === '');
    await page.goForward();
    await page.waitForFunction(() => Fez.hash('tab') === 'overview');
    await page.goForward();
    await page.waitForFunction(() => Fez.hash('tab') === 'users');
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
      Fez.hash('tab', 'settings');
      const before = history.length;
      Fez.qs('page', 2);
      Fez.qs('page', 3, { replace: true });
      return {
        added: history.length - before,
        value: Fez.qs('page'),
        hash: Fez.hash('tab'),
        preview: Fez.qs('page', 4, { href: true, replace: true }),
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

test('hash route state reads and writes path and query without fetching', async () => {
  const page = await createPage();
  try {
    const result = await page.evaluate(() => {
      Fez.hpath('traffic', { qs: { app: 'x', range: '24h' } });
      const before = history.length;
      Fez.hqs('app', 'y');
      return {
        added: history.length - before,
        path: Fez.hpath(),
        app: Fez.hqs('app'),
        range: Fez.hqs('range'),
        href: location.pathname + location.search + location.hash,
        preview: Fez.hpath('logs', { qs: { app: 'z' }, href: true }),
        loads: window.loads,
        events: window.events,
      };
    });
    expect(result).toEqual({
      added: 1,
      path: 'traffic',
      app: 'y',
      range: '24h',
      href: '/catalog?keep=query#/traffic?app=y&range=24h',
      preview: '/catalog?keep=query#/logs?app=z',
      loads: [],
      events: [],
    });
  } finally {
    await page.close();
  }
});

test('hash route Back/Forward keeps the mounted page', async () => {
  const page = await createPage();
  try {
    await page.locator('#draft').fill('unsaved route text');
    await page.evaluate(() => {
      Fez.hpath('traffic', { qs: { app: 'x' } });
      Fez.hpath('logs');
    });
    await page.goBack();
    await page.waitForFunction(() => Fez.hpath() === 'traffic');
    expect(await page.evaluate(() => Fez.hqs('app'))).toBe('x');
    await page.goBack();
    await page.waitForFunction(() => location.hash === '');
    await page.goForward();
    await page.waitForFunction(() => Fez.hpath() === 'traffic');
    await settleHistory(page);
    expect(await page.locator('#draft').inputValue()).toBe('unsaved route text');
    expect(
      await page.evaluate(() => ({
        loads: window.loads,
        sameNode: document.getElementById('pjax') === window.originalMain,
      })),
    ).toEqual({ loads: [], sameNode: true });
  } finally {
    await page.close();
  }
});

test('hash traversal after page navigation is skipped, but returning to another path still loads', async () => {
  const page = await createPage();
  try {
    await page.evaluate(() => {
      new Fez.pjax('/other').historyAddCurrent('/other');
      Fez.hash('tab', 'settings');
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

test('query Back/Forward still invokes pjax page navigation', async () => {
  const page = await createPage();
  try {
    await page.evaluate(() => Fez.qs('page', 2));
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

test('Fez.load("#panel") swaps only that node and keeps the scroll position', async () => {
  const page = await browser.newPage();
  let served = 0;
  await page.route('https://fez.test/**', (route) => {
    served += 1;
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><main id="pjax" class="pjax"><div style="height:3000px"></div><div id="panel">v${served}</div><p id="outside">o${served}</p></main></body></html>`,
    });
  });
  try {
    await page.goto('https://fez.test/panel');
    await page.addScriptTag({ content: fezCode });
    const result = await page.evaluate(async () => {
      window.scrollTo(0, 1500);
      const before = history.length;
      const detail = await Fez.load('#panel');
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        status: detail.status,
        mode: detail.mode,
        panel: document.getElementById('panel').textContent,
        outside: document.getElementById('outside').textContent,
        scrollY: Math.round(window.scrollY),
        added: history.length - before,
        pjaxGlobal: typeof window.Pjax,
      };
    });
    expect(result).toEqual({
      status: 200,
      mode: 'target',
      panel: 'v2',
      outside: 'o1',
      scrollY: 1500,
      added: 0,
      pjaxGlobal: 'undefined',
    });
  } finally {
    await page.close();
  }
});

test('Fez.load("/page#section") swaps in place and scrolls to the anchor', async () => {
  const page = await browser.newPage();
  await page.route('https://fez.test/**', (route) => {
    const long = route.request().url().includes('/long');
    route.fulfill({
      contentType: 'text/html',
      body: long
        ? '<!doctype html><html><body><main id="pjax" class="pjax"><div style="height:3000px">top</div><h2 id="bottom">Bottom</h2><div style="height:2000px"></div></main></body></html>'
        : '<!doctype html><html><body><main id="pjax" class="pjax"><p id="start">start</p></main></body></html>',
    });
  });
  try {
    await page.goto('https://fez.test/start');
    await page.addScriptTag({ content: fezCode });
    await page.evaluate(() => (window.marker = 'same document'));
    const detail = await page.evaluate(() => Fez.load('/long#bottom').then((d) => d.status));
    expect(detail).toBe(200);
    await page.waitForFunction(
      () => Math.abs(document.getElementById('bottom').getBoundingClientRect().top) < 5,
    );
    expect(
      await page.evaluate(() => ({
        href: location.pathname + location.hash,
        marker: window.marker,
      })),
    ).toEqual({ href: '/long#bottom', marker: 'same document' });
  } finally {
    await page.close();
  }
});

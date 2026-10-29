/**
 * Browser tests for the CSP build: a page whose Content-Security-Policy has a
 * script nonce and no 'unsafe-inline' / 'unsafe-eval' runs precompiled
 * components (bundler plugin) with their handlers, binds and refs, and inline
 * scripts fez inserts, without a single policy violation.
 *
 * Run: bun test test/browser/csp.test.js (after `bun run build`)
 */

import { test, expect, setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { compileFileToModule } from '../../src/fez/compile-module.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');

setDefaultTimeout(30000);

const NONCE = 'test-nonce-123';
const fezCode = readFileSync(join(ROOT_DIR, 'dist/fez.csp.esm.js'), 'utf-8').replace(
  /\/\/# sourceMappingURL=.*$/m,
  '',
);

const component = compileFileToModule(
  'x-csp.fez',
  `<xmp fez="x-csp">
<script>
  class {
    init() {
      this.state.items = [{ id: 'a' }, { id: 'b' }]
      this.state.picked = []
      this.state.text = ''
      this.state.used = 0
    }
    pick(id, i) { this.state.picked = [...this.state.picked, id + i] }
    mark(node) { this.state.used++ }
  }
</script>
<div>
  {#each state.items as item}
    <button class="pick" onclick="fez.pick('{item.id}', {i})">{item.id}</button>
  {/each}
  <a class="cancel" href="/nowhere" onclick="return false">cancel</a>
  <input class="bound" fez:bind="state.text" />
  <span class="ref" fez:this="ref" fez:use={(node) => mark(node)}></span>
  <x-child :data="state.items"></x-child>
  <p class="out">{state.picked.join(',')}|{state.text}|{state.used}</p>
</div>
</xmp>
<xmp fez="x-child">
<script>
  class {}
</script>
<i class="count">{props.data.length}</i>
</xmp>`,
).replace('export default', 'window.XCsp =');

let browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

// waitForFunction compiles its predicate in the page, which this CSP refuses;
// page.evaluate goes through the devtools protocol
async function waitFor(page, fn, timeout = 5000) {
  const end = Date.now() + timeout;
  while (!(await page.evaluate(fn))) {
    if (Date.now() > end) {
      throw new Error(`waitFor timed out: ${fn}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function createCspPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html><head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${NONCE}'; object-src 'none'">
      <script nonce="${NONCE}">
        window.violations = [];
        document.addEventListener('securitypolicyviolation', (e) => window.violations.push(e.violatedDirective + ' ' + e.blockedURI));
      </script>
    </head>
    <body>
      <x-csp></x-csp>
      <script type="module" nonce="${NONCE}">${fezCode}</script>
      <script type="module" nonce="${NONCE}">${component}</script>
    </body></html>
  `);
  await waitFor(page, () => !!document.querySelector('.out'));
  page._context = context;
  return page;
}

test('csp: precompiled components run under a nonce-only CSP', async () => {
  const page = await createCspPage();
  try {
    await page.click('.pick >> nth=1');
    await page.fill('.bound', 'typed');
    await waitFor(page, () => document.querySelector('.out').textContent === 'b1|typed|1');

    expect(await page.textContent('.count')).toBe('2');
    expect(await page.evaluate(() => Fez('x-csp').state.ref?.className)).toBe('ref');

    // `return false` in a handler cancels the default, like inline attribute code
    const href = page.url();
    await page.click('.cancel');
    expect(page.url()).toBe(href);

    // no inline handler attribute reaches the DOM
    expect(await page.evaluate(() => document.querySelectorAll('[onclick], [oninput]').length)).toBe(0);
    expect(await page.evaluate(() => window.violations)).toEqual([]);
  } finally {
    await page._context.close();
  }
});

test('csp: Fez.runScript runs inline code with the page nonce', async () => {
  const page = await createCspPage();
  try {
    await page.evaluate(() => Fez.runScript('window.ranInline = 41 + 1'));
    expect(await page.evaluate(() => window.ranInline)).toBe(42);
    expect(await page.evaluate(() => window.violations)).toEqual([]);
  } finally {
    await page._context.close();
  }
});

test('csp: code from strings is refused with a clear error, not evaluated', async () => {
  const page = await createCspPage();
  try {
    const error = await page.evaluate(() => {
      try {
        Fez.getFunction('window.evaluated = true')();
        return null;
      } catch (e) {
        return e.message;
      }
    });
    expect(error).toContain('fez CSP build');
    expect(await page.evaluate(() => window.evaluated)).toBeUndefined();
    expect(await page.evaluate(() => window.violations)).toEqual([]);
  } finally {
    await page._context.close();
  }
});

/**
 * Browser tests for PROPS schema: coercion lands in this.props on connect,
 * through the attribute observer (onPropsChange) and on keyed refresh.
 *
 * Run: bun test test/browser/props-schema.test.js
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
    <html><head><title>Fez PROPS</title></head>
    <body>
      ${html}
      <script>${fezCode}</script>
      <script>
        window.testResults = {};
        window.propErrors = [];
        Fez.onError = (kind, msg) => { window.propErrors.push({ kind, msg }); };
      </script>
    </body></html>
  `);
  await page.waitForFunction(() => window.Fez !== undefined, { timeout: 5000 });
  page._context = context;
  return page;
}

async function closePage(page) {
  try { await page._context?.close(); } catch (e) {}
}

test('PROPS - coerced values and defaults land in this.props before init', async () => {
  const page = await createTestPage(
    '<x-typed count="3" open size="xl" items=\'[1,2]\' since="2024-05-01" title="hi"></x-typed>',
  );
  try {
    await page.evaluate(() => {
      window.Fez('x-typed', class {
        PROPS = {
          count: { type: Number, default: 0 },
          open: Boolean,
          hidden: Boolean,
          size: { type: String, default: 'md', enum: ['sm', 'md', 'lg'] },
          items: Array,
          since: Date,
          missing: { type: String, required: true },
        };
        init(props) {
          window.testResults.init = {
            count: props.count,
            countType: typeof props.count,
            open: props.open,
            hidden: props.hidden,
            size: props.size,
            items: props.items,
            sinceYear: props.since.getUTCFullYear(),
            title: props.title,
            sameAsThis: props === this.props,
          };
        }
        HTML = '<b>{props.count + 1}</b>';
      });
    });
    await page.waitForFunction(() => window.testResults.init, { timeout: 3000 });

    const r = await page.evaluate(() => window.testResults.init);
    expect(r.count).toBe(3);
    expect(r.countType).toBe('number');
    expect(r.open).toBe(true);
    expect(r.hidden).toBe(false);
    expect(r.size).toBe('md');          // "xl" fails enum -> default
    expect(r.items).toEqual([1, 2]);
    expect(r.sinceYear).toBe(2024);
    expect(r.title).toBe('hi');         // undeclared passes through
    expect(r.sameAsThis).toBe(true);

    // template sees a number, not string concat
    const text = await page.evaluate(() => document.querySelector('.fez b').textContent);
    expect(text).toBe('4');

    const errors = await page.evaluate(() => window.propErrors);
    expect(errors.length).toBe(2);
    expect(errors.every((e) => e.kind === 'props')).toBe(true);
    expect(errors.some((e) => e.msg.includes('"size"'))).toBe(true);
    expect(errors.some((e) => e.msg.includes('"missing"') && e.msg.includes('required'))).toBe(true);
  } finally {
    await closePage(page);
  }
});

test('PROPS - attribute observer delivers coerced values to onPropsChange', async () => {
  const page = await createTestPage('<x-observed count="1"></x-observed>');
  try {
    await page.evaluate(() => {
      window.testResults.changes = [];
      window.Fez('x-observed', class {
        PROPS = { count: Number, open: Boolean };
        onPropsChange(name, value) {
          window.testResults.changes.push([name, value, typeof value]);
        }
        HTML = '<i>x</i>';
      });
    });
    await page.waitForFunction(() => document.querySelector('.fez')?.fez, { timeout: 3000 });

    await page.evaluate(() => {
      window.testResults.changes = [];
      const node = document.querySelector('.fez');
      node.setAttribute('count', '42');
      node.setAttribute('open', '');
    });
    await page.waitForFunction(() => window.testResults.changes.length >= 2, { timeout: 3000 });

    const r = await page.evaluate(() => ({
      changes: window.testResults.changes,
      props: { ...document.querySelector('.fez').fez.props },
    }));
    expect(r.changes).toContainEqual(['count', 42, 'number']);
    expect(r.changes).toContainEqual(['open', true, 'boolean']);
    expect(r.props.count).toBe(42);
    expect(r.props.open).toBe(true);
  } finally {
    await closePage(page);
  }
});

test('PROPS - static PROPS on plain class and keyed refresh from parent re-render', async () => {
  const page = await createTestPage('<x-parent></x-parent>');
  try {
    await page.evaluate(() => {
      window.testResults.childInits = 0;
      window.testResults.childChanges = [];

      window.Fez('x-child', class {
        static PROPS = { n: { type: Number, default: 0 } };
        init(props) {
          window.testResults.childInits++;
          window.testResults.lastN = props.n;
        }
        onPropsChange(name, value) {
          window.testResults.childChanges.push([name, value]);
        }
        HTML = '<span>{props.n * 2}</span>';
      });

      window.Fez('x-parent', class {
        init() { this.state.n = 5; }
        HTML = '<x-child key="only" n={state.n}></x-child>';
      });
    });
    await page.waitForFunction(() => window.testResults.childInits === 1, { timeout: 3000 });

    let text = await page.evaluate(() => document.querySelector('x-child, .fez-child span, .fez span')?.textContent);
    expect(text).toBe('10');

    await page.evaluate(() => {
      window.testResults.childChanges = [];
      document.querySelector('x-parent, .fez').fez.state.n = 7;
    });
    await page.waitForFunction(
      () => document.querySelector('.fez span')?.textContent === '14',
      { timeout: 3000 },
    );

    const r = await page.evaluate(() => window.testResults);
    expect(r.childInits).toBe(1);               // preserved, not recreated
    expect(r.lastN).toBe(5);
    expect(r.childChanges).toContainEqual(['n', 7]);   // coerced on refresh path
  } finally {
    await closePage(page);
  }
});

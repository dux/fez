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

test('PROPS - props are reactive, writing this.props re-renders', async () => {
  const page = await createTestPage('<x-write label="start" count="1"></x-write>');
  try {
    await page.evaluate(() => {
      window.Fez('x-write', class {
        PROPS = { count: { type: Number, default: 0 } };
        bump() { this.props.count = this.props.count + 1; }
        rename() { this.props.label = 'changed'; }
        HTML = '<b class="out">{props.label}</b><i class="n">{props.count}</i>';
      });
    });
    await page.waitForSelector('.out');
    expect(await page.textContent('.out')).toBe('start');
    expect(await page.textContent('.n')).toBe('1');

    await page.evaluate(() => document.querySelector('.fez-x-write').fez.bump());
    await page.waitForFunction(() => document.querySelector('.n').textContent === '2', { timeout: 3000 });

    await page.evaluate(() => document.querySelector('.fez-x-write').fez.rename());
    await page.waitForFunction(() => document.querySelector('.out').textContent === 'changed', { timeout: 3000 });
  } finally {
    await closePage(page);
  }
});

test('PROPS - { state: true } seeds this.state before init, transform splits the raw value', async () => {
  const page = await createTestPage('<x-seed tags="a, b ,c"></x-seed>');
  try {
    await page.evaluate(() => {
      window.Fez('x-seed', class {
        PROPS = {
          tags: {
            type: Array,
            state: true,
            default: (raw) => (raw || '').split(/\s*,\s*/).filter(Boolean),
          },
        };
        init() { window.testResults.seenInInit = [...this.state.tags]; }
        add(tag) { this.state.tags = [...this.state.tags, tag]; }
        push(tag) { this.state.tags.push(tag); }
        HTML = '<ul>{#each state.tags as tag}<li>{tag}</li>{/each}</ul>';
      });
    });
    await page.waitForSelector('li');
    expect(await page.$$eval('li', (els) => els.map((e) => e.textContent))).toEqual(['a', 'b', 'c']);
    expect(await page.evaluate(() => window.testResults.seenInInit)).toEqual(['a', 'b', 'c']);

    // state owns the list from here - props keep the value they were seeded from,
    // in place mutation included (state is seeded with a copy)
    await page.evaluate(() => document.querySelector('.fez-x-seed').fez.add('d'));
    await page.waitForFunction(() => document.querySelectorAll('li').length === 4, { timeout: 3000 });
    expect(await page.evaluate(() => document.querySelector('.fez-x-seed').fez.props.tags)).toEqual(['a', 'b', 'c']);

    await page.evaluate(() => document.querySelector('.fez-x-seed').fez.state.tags.push('e'));
    await page.waitForFunction(() => document.querySelectorAll('li').length === 5, { timeout: 3000 });
    expect(await page.evaluate(() => document.querySelector('.fez-x-seed').fez.props.tags)).toEqual(['a', 'b', 'c']);
  } finally {
    await closePage(page);
  }
});

test('PROPS - { state: "name" } renames the state key, no flag means no copy', async () => {
  const page = await createTestPage('<x-alias items=\'["x","y"]\'></x-alias><x-nocopy items=\'["x"]\'></x-nocopy>');
  try {
    await page.evaluate(() => {
      window.Fez('x-alias', class {
        PROPS = { items: { type: Array, state: 'list', default: () => [] } };
        HTML = '<b class="alias">{state.list.length} / {props.items.length}</b>';
      });
      window.Fez('x-nocopy', class {
        PROPS = { items: { type: Array, default: () => [] } };
        HTML = '<b class="nocopy">{state.items ? "copied" : "clean"}</b>';
      });
    });
    await page.waitForSelector('.alias');
    expect(await page.textContent('.alias')).toBe('2 / 2');
    expect(await page.textContent('.nocopy')).toBe('clean');
  } finally {
    await closePage(page);
  }
});

test('PROPS - { state: true } seeds inside a <slot unwrap /> component, unread keys are writable', async () => {
  const page = await createTestPage('<x-unwrap-seed tags=\'["a","b"]\'><b class="kid">slotted</b></x-unwrap-seed>');
  try {
    await page.evaluate(() => {
      window.errors = [];
      const original = console.error;
      console.error = (...args) => { window.errors.push(args.join(' ')); original(...args); };
      window.Fez('x-unwrap-seed', class {
        PROPS = { tags: { type: Array, state: true } };
        init() { window.testResults.tags = [...this.state.tags]; }
        poke() { this.state.picker = { open: true }; this.state.label = 'b'; }
        HTML = '<i class="lbl">{state.label || "a"}</i><slot unwrap />';
      });
    });
    await page.waitForSelector('.kid');
    expect(await page.evaluate(() => window.testResults.tags)).toEqual(['a', 'b']);

    // picker is never rendered - silent; label is rendered and can never update - reported
    await page.evaluate(() => document.querySelector('.fez-x-unwrap-seed').fez.poke());
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.querySelectorAll('.kid').length)).toBe(1);
    expect(await page.textContent('.lbl')).toBe('a');
    const errors = await page.evaluate(() => window.errors);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('state.label');
  } finally {
    await closePage(page);
  }
});

test('PROPS - Function accepts a string handler, state: true keeps it callable', async () => {
  const page = await createTestPage('<x-handler ping="markPinged()"></x-handler>');
  try {
    await page.evaluate(() => {
      window.markPinged = () => { window.testResults.pinged = true; };
      window.Fez('x-handler', class {
        PROPS = {
          ping: { type: Function, state: true },
          missing: { type: Function, state: true, default: () => {} },
        };
        init() {
          window.testResults.types = [typeof this.state.ping, typeof this.state.missing];
          this.state.ping();
          this.state.missing();
        }
        HTML = '<b class="n">ok</b>';
      });
    });
    await page.waitForSelector('.n');
    expect(await page.evaluate(() => window.testResults.types)).toEqual(['function', 'function']);
    expect(await page.evaluate(() => window.testResults.pinged)).toBe(true);
  } finally {
    await closePage(page);
  }
});

test('state - a write renders only when the last render read that key', async () => {
  const page = await createTestPage('<x-reads></x-reads>');
  try {
    await page.evaluate(() => {
      window.Fez('x-reads', class {
        init() { this.state.shown = 0; this.state.hidden = 0; this.state.list = []; this.state.editor = { calls: 0 }; }
        afterRender() { window.testResults.renders = (window.testResults.renders || 0) + 1; }
        HTML = '<b class="n">{state.shown} / {state.list.length}</b>';
      });
    });
    await page.waitForSelector('.n');
    expect(await page.evaluate(() => window.testResults.renders)).toBe(1);

    const fez = () => document.querySelector('.fez-x-reads').fez;
    // unread keys: plain field, nested object, DOM node ref style value
    await page.evaluate(() => { const f = (() => document.querySelector('.fez-x-reads').fez)(); f.state.hidden++; f.state.editor.calls++; f.state.node = document.body; });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.testResults.renders)).toBe(1);

    // read keys, including a nested write on a rendered array
    await page.evaluate(() => document.querySelector('.fez-x-reads').fez.state.shown++);
    await page.waitForFunction(() => document.querySelector('.n').textContent === '1 / 0', { timeout: 3000 });
    await page.evaluate(() => document.querySelector('.fez-x-reads').fez.state.list.push('a'));
    await page.waitForFunction(() => document.querySelector('.n').textContent === '1 / 1', { timeout: 3000 });
    expect(await page.evaluate(() => window.testResults.renders)).toBe(3);
  } finally {
    await closePage(page);
  }
});
test('PROPS - a prop write does not re-render a <slot unwrap /> component', async () => {
  const page = await createTestPage('<x-unwrap label="a"><b class="kid">slotted</b></x-unwrap>');
  try {
    await page.evaluate(() => {
      window.Fez('x-unwrap', class {
        poke() { this.props.label = 'b'; }
        HTML = '<i class="lbl">{props.label}</i><slot unwrap />';
      });
    });
    await page.waitForSelector('.kid');

    // unwrap dissolves the slot wrapper, so a re-render would drop the children
    await page.evaluate(() => document.querySelector('.fez-x-unwrap').fez.poke());
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => document.querySelector('.kid')?.textContent)).toBe('slotted');
    expect(await page.evaluate(() => document.querySelector('.lbl').textContent)).toBe('a');
    expect(await page.evaluate(() => document.querySelector('.fez-x-unwrap').fez.props.label)).toBe('b');
  } finally {
    await closePage(page);
  }
});

test('PROPS - object props keep their identity across reads', async () => {
  const page = await createTestPage('<x-ident></x-ident>');
  try {
    await page.evaluate(() => {
      window.Fez('x-ident', class {
        PROPS = { items: { type: Array, default: () => [] } };
        HTML = '<b class="n">{props.items.length}</b>';
      });
    });
    await page.waitForSelector('.n');

    const r = await page.evaluate(() => {
      const fez = document.querySelector('.fez-x-ident').fez;
      fez.props.items = [{ id: 1 }];
      const a = fez.props.items;
      const b = fez.props.items;
      const first = fez.props.items[0];
      return {
        sameArray: a === b,
        sameItem: first === fez.props.items[0],
        includes: fez.props.items.includes(first),
      };
    });
    expect(r).toEqual({ sameArray: true, sameItem: true, includes: true });
  } finally {
    await closePage(page);
  }
});

test('PROPS - object props keep plain identity across component boundaries', async () => {
  const page = await createTestPage('<x-parent></x-parent>');
  try {
    await page.evaluate(() => {
      window.Fez('x-kid', class {
        PROPS = { item: Object };
        pick() { window.testResults.picked = this.props.item; }
        HTML = '<span class="kid-name">{props.item.name}</span>';
      });
      window.Fez('x-parent', class {
        PROPS = { items: { type: Array, default: () => [{ name: 'Ann' }] } };
        HTML = '<x-kid key="one" :item="props.items[0]"></x-kid>';
      });
    });
    await page.waitForSelector('.kid-name');

    // the object the child holds is the very object in the parent's array
    const r = await page.evaluate(() => {
      const parent = document.querySelector('.fez-x-parent').fez;
      const kid = document.querySelector('.fez-x-kid').fez;
      kid.pick();
      return {
        same: window.testResults.picked === parent.props.items[0],
        includes: parent.props.items.includes(window.testResults.picked),
      };
    });
    expect(r).toEqual({ same: true, includes: true });
  } finally {
    await closePage(page);
  }
});

test('PROPS - assigning a container prop re-renders and reaches the child', async () => {
  const page = await createTestPage('<x-owner></x-owner>');
  try {
    await page.evaluate(() => {
      window.Fez('x-owned', class {
        HTML = '<span class="owned-name">{props.user.name}</span>';
      });
      window.Fez('x-owner', class {
        PROPS = { user: { type: Object, default: () => ({ name: 'Ann' }) } };
        rename() { this.props.user = { ...this.props.user, name: 'Bob' }; }
        HTML = '<x-owned key="one" :user="props.user"></x-owned>';
      });
    });
    await page.waitForSelector('.owned-name');
    expect(await page.textContent('.owned-name')).toBe('Ann');

    await page.evaluate(() => document.querySelector('.fez-x-owner').fez.rename());
    await page.waitForFunction(() => document.querySelector('.owned-name').textContent === 'Bob', { timeout: 3000 });
  } finally {
    await closePage(page);
  }
});

test('PROPS - { state: true } seeds without firing onStateChange before init()', async () => {
  const page = await createTestPage('<x-hooks tags=\'["a","b"]\'></x-hooks>');
  try {
    await page.evaluate(() => {
      window.Fez('x-hooks', class {
        PROPS = { tags: { type: Array, state: true, default: () => [] } };
        init() { window.testResults.events = []; }
        // would throw if it ran before init() created the list
        onStateChange(name) { window.testResults.events.push(name); }
        add(tag) { this.state.tags = [...this.state.tags, tag]; }
        HTML = '<b class="n">{state.tags.length}</b>';
      });
    });
    await page.waitForSelector('.n');
    expect(await page.textContent('.n')).toBe('2');
    expect(await page.evaluate(() => window.testResults.events)).toEqual([]);

    // hooks work normally once mounted
    await page.evaluate(() => document.querySelector('.fez-x-hooks').fez.add('c'));
    await page.waitForFunction(() => document.querySelector('.n').textContent === '3', { timeout: 3000 });
    expect(await page.evaluate(() => window.testResults.events)).toEqual(['tags']);
  } finally {
    await closePage(page);
  }
});

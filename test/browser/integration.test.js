/**
 * Browser Integration Tests for Fez Framework
 *
 * Tests core functionality in real browser environment using Playwright:
 * - Component lifecycle (init, onMount, onDestroy)
 * - State reactivity and re-rendering
 * - fez:keep preservation
 * - Form binding
 * - Component communication
 *
 * Run: bun test test/browser/integration.test.js
 */

import { test, expect, setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../..');

// Increase timeout for browser tests
setDefaultTimeout(30000);

// Read fez.js source
const fezPath = join(ROOT_DIR, 'dist/fez.js');
const fezCode = readFileSync(fezPath, 'utf-8');

// Shared browser instance - one launch for all tests
let browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

/**
 * Create a test page with Fez injected.
 * Uses a fresh browser context per test for full isolation.
 */
async function createTestPage(html = '') {
  const context = await browser.newContext();
  const page = await context.newPage();

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Fez Test</title></head>
    <body>
      ${html}
      <script>${fezCode}</script>
      <script>
        window.testResults = {};
        window.testLog = [];

        function log(msg) {
          window.testLog.push(msg);
          console.log('[TEST]', msg);
        }
      </script>
    </body>
    </html>
  `;

  await page.setContent(fullHtml);
  await page.waitForFunction(() => window.Fez !== undefined, { timeout: 5000 });

  // Store context reference for cleanup
  page._context = context;

  return page;
}

/**
 * Close test page and its browser context
 */
async function closePage(page) {
  try {
    await page._context?.close();
  } catch (e) {
    // Ignore cleanup errors
  }
}

// =============================================================================
// COMPONENT LIFECYCLE TESTS
// =============================================================================

test('lifecycle - init and onMount are called', async () => {
  const page = await createTestPage('<test-lifecycle></test-lifecycle>');

  try {
    await page.evaluate(() => {
      window.Fez('test-lifecycle', class {
        init(props) {
          window.testResults.initCalled = true;
          window.testResults.initProps = props;
          this.state.value = 'init';
        }

        onMount(props) {
          window.testResults.onMountCalled = true;
          window.testResults.onMountProps = props;
          this.state.value = 'mounted';
        }

        HTML = '<div class="lifecycle">{state.value}</div>';
        FAST = true;
      });
    });

    // Wait for component to render
    await page.waitForFunction(() => {
      const el = document.querySelector('.lifecycle');
      return el && el.textContent === 'mounted';
    }, { timeout: 2000 });

    const results = await page.evaluate(() => window.testResults);
    expect(results.initCalled).toBe(true);
    expect(results.onMountCalled).toBe(true);
  } finally {
    await closePage(page);
  }
});

test('lifecycle - onDestroy is called on DOM removal', async () => {
  const page = await createTestPage('<div id="container"><test-destroy></test-destroy></div>');

  try {
    await page.evaluate(() => {
      window.Fez('test-destroy', class {
        init() {
          this.state.status = 'alive';
        }

        onDestroy() {
          window.testResults.onDestroyCalled = true;
        }

        HTML = '<div class="destroy-test">{state.status}</div>';
        FAST = true;
      });
    });

    // Wait for component to mount
    await page.waitForFunction(() => {
      const el = document.querySelector('.destroy-test');
      return el && el.textContent === 'alive';
    }, { timeout: 2000 });

    // Remove component
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = '';
    });

    // Wait for MutationObserver
    await page.waitForTimeout(100);

    const results = await page.evaluate(() => window.testResults);
    expect(results.onDestroyCalled).toBe(true);
  } finally {
    await closePage(page);
  }
});

// =============================================================================
// STATE REACTIVITY TESTS
// =============================================================================

test('state - changes trigger re-render', async () => {
  const page = await createTestPage('<test-state></test-state>');

  try {
    await page.evaluate(() => {
      window.Fez('test-state', class {
        init() {
          this.state.count = 0;
        }

        increment() {
          this.state.count++;
        }

        HTML = `<button class="counter" onclick="fez.increment()">Count: {state.count}</button>`;
        FAST = true;
      });
    });

    // Wait for initial render
    await page.waitForFunction(() => {
      const el = document.querySelector('.counter');
      return el && el.textContent === 'Count: 0';
    }, { timeout: 2000 });

    // Click to increment
    await page.click('.counter');

    // Wait for re-render
    await page.waitForFunction(() => {
      const el = document.querySelector('.counter');
      return el && el.textContent === 'Count: 1';
    }, { timeout: 2000 });

    const text = await page.textContent('.counter');
    expect(text).toBe('Count: 1');
  } finally {
    await closePage(page);
  }
});

test('state - nested changes are reactive', async () => {
  const page = await createTestPage('<test-nested></test-nested>');

  try {
    await page.evaluate(() => {
      window.Fez('test-nested', class {
        init() {
          this.state.user = { name: 'John', age: 30 };
        }

        updateName() {
          this.state.user.name = 'Jane';
        }

        HTML = `<div class="user">{state.user.name} ({state.user.age})</div>
                <button class="update" onclick="fez.updateName()">Update</button>`;
        FAST = true;
      });
    });

    // Wait for initial render
    await page.waitForFunction(() => {
      const el = document.querySelector('.user');
      return el && el.textContent === 'John (30)';
    }, { timeout: 2000 });

    // Click to update
    await page.click('.update');

    // Wait for re-render
    await page.waitForFunction(() => {
      const el = document.querySelector('.user');
      return el && el.textContent === 'Jane (30)';
    }, { timeout: 2000 });

    const text = await page.textContent('.user');
    expect(text).toBe('Jane (30)');
  } finally {
    await closePage(page);
  }
});

// =============================================================================
// FEZ:KEEP TESTS
// =============================================================================

test('fez:keep - preserves element across re-renders', async () => {
  const page = await createTestPage('<test-keep></test-keep>');

  try {
    await page.evaluate(() => {
      window.Fez('test-keep', class {
        init() {
          this.state.count = 0;
        }

        increment() {
          this.state.count++;
        }

        HTML = `
          <div>
            <span fez:keep="preserved-input">
              <input class="kept-input" type="text" value="original" />
            </span>
            <button class="increment" onclick="fez.increment()">Count: {state.count}</button>
          </div>
        `;
        FAST = true;
      });
    });

    // Wait for initial render
    await page.waitForFunction(() => {
      const btn = document.querySelector('.increment');
      return btn && btn.textContent === 'Count: 0';
    }, { timeout: 2000 });

    // Get input element reference
    const inputValueBefore = await page.inputValue('.kept-input');
    expect(inputValueBefore).toBe('original');

    // Type into input
    await page.fill('.kept-input', 'modified');

    // Trigger re-render
    await page.click('.increment');

    // Wait for re-render
    await page.waitForFunction(() => {
      const btn = document.querySelector('.increment');
      return btn && btn.textContent === 'Count: 1';
    }, { timeout: 2000 });

    // Input should still have modified value (preserved)
    const inputValueAfter = await page.inputValue('.kept-input');
    expect(inputValueAfter).toBe('modified');
  } finally {
    await closePage(page);
  }
});

// =============================================================================
// COMPONENT COMMUNICATION TESTS
// =============================================================================

test('pubsub - component publish/subscribe', async () => {
  // this.publish bubbles UP to parent components
  // this.subscribe in parent receives events from child
  const page = await createTestPage(`
    <test-parent>
      <test-child></test-child>
    </test-parent>
  `);

  try {
    await page.evaluate(() => {
      // Child publishes an event upward
      window.Fez('test-child', class {
        init() {
          this.state.label = 'idle';
        }

        send() {
          this.publish('child-event', 'hello from child');
          this.state.label = 'sent';
        }

        HTML = '<button class="child-btn" onclick="fez.send()">{state.label}</button>';
        FAST = true;
      });

      // Parent subscribes and receives the bubbled event
      window.Fez('test-parent', class {
        init() {
          this.state.received = null;
          this.subscribe('child-event', (data) => {
            this.state.received = data;
            window.testResults.parentReceived = data;
          });
        }

        HTML = `
          <div class="parent">
            <div class="parent-data">{state.received || "nothing"}</div>
            <slot></slot>
          </div>
        `;
        FAST = true;
      });
    });

    // Wait for render
    await page.waitForFunction(() => {
      return document.querySelector('.child-btn') !== null;
    }, { timeout: 2000 });

    // Child clicks send
    await page.click('.child-btn');

    // Wait for parent to receive the bubbled event
    await page.waitForFunction(() => {
      const el = document.querySelector('.parent-data');
      return el && el.textContent === 'hello from child';
    }, { timeout: 2000 });

    const results = await page.evaluate(() => window.testResults);
    expect(results.parentReceived).toBe('hello from child');
  } finally {
    await closePage(page);
  }
});

test('pubsub - Fez.publish global broadcast', async () => {
  // Fez.publish broadcasts globally, reaching all this.subscribe listeners
  const page = await createTestPage(`
    <test-listener></test-listener>
  `);

  try {
    await page.evaluate(() => {
      window.Fez('test-listener', class {
        init() {
          this.state.received = null;
          this.subscribe('global-event', (data) => {
            this.state.received = data;
            window.testResults.listenerReceived = data;
          });
        }

        HTML = '<div class="listener-data">{state.received || "nothing"}</div>';
        FAST = true;
      });
    });

    await page.waitForFunction(() => {
      return document.querySelector('.listener-data') !== null;
    }, { timeout: 2000 });

    // Broadcast globally from outside any component
    await page.evaluate(() => {
      Fez.publish('global-event', 'hello from global');
    });

    await page.waitForFunction(() => {
      const el = document.querySelector('.listener-data');
      return el && el.textContent === 'hello from global';
    }, { timeout: 2000 });

    const results = await page.evaluate(() => window.testResults);
    expect(results.listenerReceived).toBe('hello from global');
  } finally {
    await closePage(page);
  }
});

test('global state - cross-component reactivity', async () => {
  const page = await createTestPage(`
    <test-writer></test-writer>
    <test-reader></test-reader>
  `);

  try {
    await page.evaluate(() => {
      // Writer component
      window.Fez('test-writer', class {
        init() {
          this.state.value = 'initial';
        }

        write() {
          this.globalState.sharedValue = 'updated';
        }

        HTML = '<button class="write" onclick="fez.write()">Write</button>';
        FAST = true;
      });

      // Reader component - reads globalState directly in template so it
      // re-renders and shows the latest value when globalState changes
      window.Fez('test-reader', class {
        HTML = '<div class="reader-value">{globalState.sharedValue || "initial"}</div>';
        FAST = true;
      });
    });

    // Wait for render
    await page.waitForFunction(() => {
      const el = document.querySelector('.reader-value');
      return el !== null;
    }, { timeout: 2000 });

    // Click write
    await page.click('.write');

    // Wait for reader to update
    await page.waitForFunction(() => {
      const el = document.querySelector('.reader-value');
      return el && el.textContent === 'updated';
    }, { timeout: 2000 });

    const text = await page.textContent('.reader-value');
    expect(text).toBe('updated');
  } finally {
    await closePage(page);
  }
});

// =============================================================================
// TEMPLATE TESTS
// =============================================================================

test('template - conditionals work', async () => {
  const page = await createTestPage('<test-if></test-if>');

  try {
    await page.evaluate(() => {
      window.Fez('test-if', class {
        init() {
          this.state.show = false;
        }

        toggle() {
          this.state.show = !this.state.show;
        }

        HTML = `
          <button class="toggle" onclick="fez.toggle()">Toggle</button>
          {#if state.show}
            <div class="visible">Shown!</div>
          {/if}
        `;
        FAST = true;
      });
    });

    // Initially hidden
    await page.waitForFunction(() => {
      const btn = document.querySelector('.toggle');
      const visible = document.querySelector('.visible');
      return btn && !visible;
    }, { timeout: 2000 });

    // Toggle to show
    await page.click('.toggle');

    // Wait for visible
    await page.waitForFunction(() => {
      const el = document.querySelector('.visible');
      return el && el.textContent === 'Shown!';
    }, { timeout: 2000 });

    const text = await page.textContent('.visible');
    expect(text).toBe('Shown!');
  } finally {
    await closePage(page);
  }
});

test('template - loops work', async () => {
  const page = await createTestPage('<test-loop></test-loop>');

  try {
    await page.evaluate(() => {
      window.Fez('test-loop', class {
        init() {
          this.state.items = ['a', 'b', 'c'];
        }

        HTML = `
          <div class="loop-container">
            {#each state.items as item}
              <span class="loop-item">{item}</span>
            {/each}
          </div>
        `;
        FAST = true;
      });
    });

    // Wait for render
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('.loop-item');
      return items.length === 3;
    }, { timeout: 2000 });

    const items = await page.$$('.loop-item');
    expect(items.length).toBe(3);

    const texts = await Promise.all(items.map(el => el.textContent()));
    expect(texts).toEqual(['a', 'b', 'c']);
  } finally {
    await closePage(page);
  }
});

// =============================================================================
// FORM BINDING TESTS
// =============================================================================

test('fez:bind - two-way input binding', async () => {
  const page = await createTestPage('<test-bind></test-bind>');

  try {
    await page.evaluate(() => {
      window.Fez('test-bind', class {
        init() {
          this.state.name = 'initial';
        }

        HTML = `
          <input fez:bind="state.name" class="bound-input" />
          <div class="bound-value">{state.name}</div>
        `;
        FAST = true;
      });
    });

    // Wait for render
    await page.waitForFunction(() => {
      const input = document.querySelector('.bound-input');
      const value = document.querySelector('.bound-value');
      return input && value && value.textContent === 'initial';
    }, { timeout: 2000 });

    // Type into input
    await page.fill('.bound-input', 'updated');

    // fez:bind uses onkeyup - dispatch keyup to trigger the binding
    await page.dispatchEvent('.bound-input', 'keyup');

    // Wait for value to update
    await page.waitForFunction(() => {
      const el = document.querySelector('.bound-value');
      return el && el.textContent === 'updated';
    }, { timeout: 2000 });

    const text = await page.textContent('.bound-value');
    expect(text).toBe('updated');
  } finally {
    await closePage(page);
  }
});

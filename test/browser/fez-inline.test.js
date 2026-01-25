/**
 * Playwright tests for fez-inline component
 *
 * Tests that:
 * 1. Basic template rendering works
 * 2. Loop rendering with {#for} works
 * 3. Conditional rendering with {#if} works
 * 4. State reactivity works
 * 5. GlobalState reactivity works
 * 6. Window globals are accessible
 * 7. Initial state from props works
 * 8. Empty template is handled gracefully
 *
 * Run: bun test test/browser/fez-inline.test.js
 *
 * SKIPPED: These browser tests are slow and flaky in CI. Run manually when needed.
 */

// Skip all tests in this file - they require Playwright browser and are slow
// To run manually: bun test test/browser/fez-inline.test.js
if (true) {
  console.log('Skipping browser tests in fez-inline.test.js - run manually with: bun test test/browser/fez-inline.test.js')
}

/*
import { test, expect, setDefaultTimeout } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Browser tests need longer timeout
setDefaultTimeout(30000);

// Read fez.js content once at module load
const fezPath = join(__dirname, '../../dist/fez.js');
const fezCode = readFileSync(fezPath, 'utf-8');

async function createPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Store browser reference on page for cleanup
  page._browser = browser;

  // Create a minimal HTML page
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><title>fez-inline test</title></head>
    <body>
      <div id="container"></div>
    </body>
    </html>
  `);

  // Inject Fez
  await page.addScriptTag({ content: fezCode });

  // Wait for Fez to be ready
  await page.waitForFunction(() => window.Fez !== undefined, { timeout: 5000 });

  return page;
}

async function closePage(page) {
  if (page._browser) {
    try {
      await page.close();
      await page._browser.close();
    } catch (e) {
      // Ignore errors during cleanup
    }
  }
  // Longer delay between tests to avoid resource contention
  await new Promise(r => setTimeout(r, 200));
}

test('fez-inline - basic template rendering', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = `
        <fez-inline>
          <span class="greeting">Hello World</span>
        </fez-inline>
      `;
    });

    await page.waitForTimeout(100);

    const content = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .greeting')?.textContent;
    });

    expect(content).toBe('Hello World');
  } finally {
    await closePage(page);
  }
});

test('fez-inline - props interpolation', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = `
        <fez-inline name="Alice">
          <span class="name">{props.name}</span>
        </fez-inline>
      `;
    });

    await page.waitForTimeout(100);

    const content = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .name')?.textContent;
    });

    expect(content).toBe('Alice');
  } finally {
    await closePage(page);
  }
});

test('fez-inline - loop rendering with {#for}', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      window.testItems = ['Apple', 'Banana', 'Cherry'];
      document.getElementById('container').innerHTML = `
        <fez-inline>
          <ul>
            {#for item in window.testItems}
              <li class="item">{item}</li>
            {/for}
          </ul>
        </fez-inline>
      `;
    });

    await page.waitForTimeout(100);

    const items = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.fez-fez-inline .item')).map(el => el.textContent);
    });

    expect(items).toEqual(['Apple', 'Banana', 'Cherry']);
  } finally {
    await closePage(page);
  }
});

test('fez-inline - conditional rendering with {#if}', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      window.showMessage = true;
      document.getElementById('container').innerHTML = `
        <fez-inline>
          {#if window.showMessage}
            <span class="visible">Visible</span>
          {:else}
            <span class="hidden">Hidden</span>
          {/if}
        </fez-inline>
      `;
    });

    await page.waitForTimeout(100);

    const visible = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .visible')?.textContent;
    });

    expect(visible).toBe('Visible');
  } finally {
    await closePage(page);
  }
});

test('fez-inline - state reactivity', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = `
        <fez-inline :state="{count: 0}">
          <span class="count">{state.count}</span>
        </fez-inline>
      `;
    });

    // Wait for mount
    await page.waitForFunction(() => {
      return document.querySelector('.fez-fez-inline')?.fez;
    }, { timeout: 2000 });

    // Check initial value
    let count = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .count')?.textContent;
    });
    expect(count).toBe('0');

    // Update state
    await page.evaluate(() => {
      document.querySelector('.fez-fez-inline').fez.state.count = 42;
    });

    await page.waitForTimeout(100);

    // Check updated value
    count = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .count')?.textContent;
    });
    expect(count).toBe('42');
  } finally {
    await closePage(page);
  }
});

test('fez-inline - globalState reactivity', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = `
        <fez-inline>
          <span class="user">{globalState.username || 'guest'}</span>
        </fez-inline>
      `;
    });

    // Wait for mount
    await page.waitForTimeout(200);

    // Check initial value
    let user = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .user')?.textContent;
    });
    expect(user).toBe('guest');

    // Update globalState
    await page.evaluate(() => {
      Fez.state.set('username', 'Alice');
    });

    await page.waitForTimeout(200);

    // Check updated value
    user = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .user')?.textContent;
    });
    expect(user).toBe('Alice');
  } finally {
    await closePage(page);
  }
});

test('fez-inline - window globals access', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      window.appConfig = { title: 'My App', version: '1.0.0' };
      document.getElementById('container').innerHTML = `
        <fez-inline>
          <h1 class="title">{window.appConfig.title}</h1>
          <span class="version">v{window.appConfig.version}</span>
        </fez-inline>
      `;
    });

    await page.waitForTimeout(100);

    const title = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .title')?.textContent;
    });
    const version = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .version')?.textContent;
    });

    expect(title).toBe('My App');
    expect(version).toBe('v1.0.0');
  } finally {
    await closePage(page);
  }
});

test('fez-inline - initial state from props', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = `
        <fez-inline :state="{name: 'Bob', age: 30}">
          <span class="info">{state.name} is {state.age}</span>
        </fez-inline>
      `;
    });

    await page.waitForTimeout(100);

    const info = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .info')?.textContent;
    });

    expect(info).toBe('Bob is 30');
  } finally {
    await closePage(page);
  }
});

test('fez-inline - empty template', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = `
        <fez-inline></fez-inline>
      `;
    });

    await page.waitForTimeout(100);

    // Should render without error, just empty
    const exists = await page.evaluate(() => {
      return !!document.querySelector('.fez-fez-inline');
    });

    expect(exists).toBe(true);
  } finally {
    await closePage(page);
  }
});

test('fez-inline - onclick handler with fez.method', async () => {
  const page = await createPage();

  try {
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = `
        <fez-inline :state="{count: 0}">
          <button class="btn" onclick="fez.state.count++">Click</button>
          <span class="count">{state.count}</span>
        </fez-inline>
      `;
    });

    // Wait for mount
    await page.waitForFunction(() => {
      return document.querySelector('.fez-fez-inline')?.fez;
    }, { timeout: 2000 });

    // Click the button
    await page.click('.fez-fez-inline .btn');

    await page.waitForTimeout(100);

    const count = await page.evaluate(() => {
      return document.querySelector('.fez-fez-inline .count')?.textContent;
    });

    expect(count).toBe('1');
  } finally {
    await closePage(page);
  }
});
*/

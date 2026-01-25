/**
 * Playwright tests for onDestroy cleanup
 *
 * Tests that:
 * 1. onDestroy is called immediately when element is removed from DOM
 * 2. Intervals are cleared on destroy
 * 3. Window event listeners are removed on destroy
 * 4. Custom cleanup callbacks are called
 * 5. Nested components are cleaned up properly
 * 6. Double-cleanup is prevented
 *
 * NOTE: Run these tests separately for best results:
 *   bun test test/browser/ondestroy.test.js
 *
 * When run with all tests, browser resource contention may cause timeouts.
 */

import { test, expect, setDefaultTimeout } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Browser tests need longer timeout due to browser launch overhead
setDefaultTimeout(30000);

// Read fez.js content once at module load
const fezPath = join(__dirname, '../../dist/fez.js');
const fezCode = readFileSync(fezPath, 'utf-8');

async function createPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const testPagePath = join(__dirname, 'ondestroy.html');

  // Store browser reference on page for cleanup
  page._browser = browser;

  await page.goto(`file://${testPagePath}`);

  // Inject Fez script content directly
  await page.addScriptTag({ content: fezCode });

  // Wait for Fez to be ready
  await page.waitForFunction(() => window.Fez !== undefined, { timeout: 5000 });

  // Define test components
  await page.evaluate(() => {
    window.defineTestComponents();
  });

  // Wait for components to be ready
  await page.waitForFunction(() => window.componentsReady === true, { timeout: 5000 });

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
  // Small delay to ensure browser is fully closed
  await new Promise(r => setTimeout(r, 100));
}

test('onDestroy - interval cleanup', async () => {
  const page = await createPage();

  try {
    // Add component
    await page.evaluate(() => {
      window.cleanupLog = [];
      document.getElementById('container').innerHTML = '<test-interval></test-interval>';
    });

    // Wait for component to mount and interval to tick
    await page.waitForFunction(() => window.cleanupLog.length >= 2, { timeout: 500 });

    // Remove component
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = '';
    });

    // Wait a bit for MutationObserver to fire
    await page.waitForTimeout(50);

    // Check onDestroy was called
    const log = await page.evaluate(() => window.cleanupLog);
    expect(log).toContain('interval-destroyed');

    // Wait and verify interval stopped (no more ticks after destroy)
    const ticksBefore = log.filter(l => l.startsWith('interval-tick')).length;
    await page.waitForTimeout(200);
    const logAfter = await page.evaluate(() => window.cleanupLog);
    const ticksAfter = logAfter.filter(l => l.startsWith('interval-tick')).length;

    // Should not have more ticks after destroy
    expect(ticksAfter).toBe(ticksBefore);
  } finally {
    await closePage(page);
  }
});

test('onDestroy - window event cleanup', async () => {
  const page = await createPage();

  try {
    // Add component
    await page.evaluate(() => {
      window.cleanupLog = [];
      document.getElementById('container').innerHTML = '<test-event></test-event>';
    });

    // Wait for mount
    await page.waitForTimeout(50);

    // Trigger resize
    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(50);

    // Check resize was captured
    let log = await page.evaluate(() => window.cleanupLog);
    expect(log).toContain('resize-fired');

    // Remove component
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = '';
    });
    await page.waitForTimeout(50);

    // Check onDestroy was called
    log = await page.evaluate(() => window.cleanupLog);
    expect(log).toContain('event-destroyed');

    // Clear log and trigger resize again
    await page.evaluate(() => {
      window.cleanupLog = window.cleanupLog.filter(l => l !== 'resize-fired');
    });

    await page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForTimeout(50);

    // Resize should NOT be captured anymore
    log = await page.evaluate(() => window.cleanupLog);
    expect(log.filter(l => l === 'resize-fired').length).toBe(0);
  } finally {
    await closePage(page);
  }
});

test('onDestroy - custom callback cleanup', async () => {
  const page = await createPage();

  try {
    // Add component
    await page.evaluate(() => {
      window.cleanupLog = [];
      document.getElementById('container').innerHTML = '<test-custom></test-custom>';
    });

    await page.waitForTimeout(50);

    // Remove component
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = '';
    });

    await page.waitForTimeout(50);

    // Check both custom callback and onDestroy were called
    const log = await page.evaluate(() => window.cleanupLog);
    expect(log).toContain('custom-callback');
    expect(log).toContain('custom-destroyed');

    // Custom callback should be called before onDestroy
    const callbackIndex = log.indexOf('custom-callback');
    const destroyIndex = log.indexOf('custom-destroyed');
    expect(callbackIndex).toBeLessThan(destroyIndex);
  } finally {
    await closePage(page);
  }
});

test('onDestroy - nested components cleanup', async () => {
  const page = await createPage();

  try {
    // Add parent component (which contains child)
    await page.evaluate(() => {
      window.cleanupLog = [];
      document.getElementById('container').innerHTML = '<test-parent></test-parent>';
    });

    // Wait for parent and child to mount
    await page.waitForFunction(() => {
      const parent = document.querySelector('.fez-test-parent');
      const child = document.querySelector('.fez-test-child');
      return parent && parent.fez && child && child.fez;
    }, { timeout: 2000 });

    // Wait for child interval to tick
    await page.waitForFunction(() => window.cleanupLog.includes('child-interval'), { timeout: 2000 });

    // Remove parent
    await page.evaluate(() => {
      document.getElementById('container').innerHTML = '';
    });

    await page.waitForTimeout(100);

    // Both parent and child should be destroyed
    const log = await page.evaluate(() => window.cleanupLog);
    expect(log).toContain('parent-destroyed');
    expect(log).toContain('child-destroyed');

    // Child interval should have stopped
    const ticksBefore = log.filter(l => l === 'child-interval').length;
    await page.waitForTimeout(200);
    const logAfter = await page.evaluate(() => window.cleanupLog);
    const ticksAfter = logAfter.filter(l => l === 'child-interval').length;
    expect(ticksAfter).toBe(ticksBefore);
  } finally {
    await closePage(page);
  }
});

test('onDestroy - double cleanup prevention', async () => {
  const page = await createPage();

  try {
    // Add component
    await page.evaluate(() => {
      window.cleanupLog = [];
      document.getElementById('container').innerHTML = '<test-custom></test-custom>';
    });

    // Wait for component to mount (use class selector as custom element becomes div)
    await page.waitForFunction(() => {
      const el = document.querySelector('.fez-test-custom');
      return el && el.fez;
    }, { timeout: 2000 });

    // Get component reference and manually call fezOnDestroy twice
    const destroyCount = await page.evaluate(() => {
      const el = document.querySelector('.fez-test-custom');
      if (!el || !el.fez) return -1;

      const fez = el.fez;

      // First destroy (normal)
      fez.fezOnDestroy();

      // Try to destroy again
      fez.fezOnDestroy();

      // Count how many times custom-destroyed appears
      return window.cleanupLog.filter(l => l === 'custom-destroyed').length;
    });

    // Should only be destroyed once
    expect(destroyCount).toBe(1);
  } finally {
    await closePage(page);
  }
});

test('onDestroy - immediate cleanup on DOM removal', async () => {
  const page = await createPage();

  try {
    // Add component with interval
    await page.evaluate(() => {
      window.cleanupLog = [];
      window.destroyTime = null;
      window.removeTime = null;
      document.getElementById('container').innerHTML = '<test-interval></test-interval>';
    });

    // Wait for component to mount (use class selector)
    await page.waitForFunction(() => {
      const el = document.querySelector('.fez-test-interval');
      return el && el.fez;
    }, { timeout: 3000 });

    // Remove and track timing
    await page.evaluate(() => {
      // Override onDestroy to track timing
      const el = document.querySelector('.fez-test-interval');
      if (!el || !el.fez) return;

      const originalOnDestroy = el.fez.onDestroy.bind(el.fez);
      el.fez.onDestroy = function() {
        window.destroyTime = performance.now();
        originalOnDestroy();
      };

      window.removeTime = performance.now();
      document.getElementById('container').innerHTML = '';
    });

    // Wait for MutationObserver
    await page.waitForTimeout(100);

    // Check timing - destroy should happen very quickly after removal
    const timing = await page.evaluate(() => ({
      removeTime: window.removeTime,
      destroyTime: window.destroyTime
    }));

    expect(timing.destroyTime).not.toBeNull();
    // Destroy should happen within 50ms of removal (MutationObserver is async but fast)
    expect(timing.destroyTime - timing.removeTime).toBeLessThan(50);
  } finally {
    await closePage(page);
  }
});

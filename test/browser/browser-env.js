// Shared by the browser regression suites: one Chromium per test file and
// `run`, which evaluates one test in a fresh page.
import { setDefaultTimeout, beforeAll, afterAll } from 'bun:test';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const fezCode = readFileSync(join(__dirname, '../../dist/fez.js'), 'utf-8');

// Call once at the top of a test file
export function useBrowser() {
  let browser;

  setDefaultTimeout(30000);

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  const newContext = () => browser.newContext();

  // Runs `setup(arg)` in a fresh page, waits, then returns `check()` plus page errors
  async function run(setup, check, wait = 150, arg) {
    const context = await newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    try {
      await page.setContent(
        `<!DOCTYPE html><html><head><script>${fezCode}</script></head><body><div id="app"></div></body></html>`,
      );
      await page.waitForFunction(() => window.Fez && document.readyState === 'complete');
      // renders are frame-batched, and a cold Chromium delivers its first frame
      // late (800ms measured), past a short `wait`
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await page.evaluate(setup, arg);
      await page.waitForTimeout(wait);
      return { result: await page.evaluate(check), errors };
    } finally {
      await context.close();
    }
  }

  return { run, newContext };
}

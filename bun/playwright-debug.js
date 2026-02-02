#!/usr/bin/env bun

import { chromium } from "playwright";

const url = process.argv[2];

if (!url) {
  console.error("Usage: bun bun/playwright-debug.js <url>");
  console.error("Example: bun bun/playwright-debug.js http://localhost:3333");
  process.exit(1);
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(url);

// LLM agent debugging session
// This script is designed for AI/LLM agents to programmatically inspect and debug web pages
console.log("\n--- Playwright Debug Session (for LLM agents) ---");
console.log(`Page loaded: ${url}`);
console.log("\nGlobals exposed for programmatic access:");
console.log("  page     - Playwright page object");
console.log("  browser  - Playwright browser object");
console.log("  context  - Playwright browser context");
console.log("\nCommon operations:");
console.log('  await page.screenshot({ path: "tmp/screenshot.png" })');
console.log("  await page.content()");
console.log("  await page.evaluate(() => document.title)");
console.log('  await page.locator("selector").click()');
console.log('  await page.$eval("selector", el => el.textContent)');
console.log("  await browser.close()  - to exit");
console.log("\nPress Ctrl+C to exit and close browser\n");

// Keep the script running
globalThis.page = page;
globalThis.browser = browser;
globalThis.context = context;

// Handle cleanup on exit
process.on("SIGINT", async () => {
  console.log("\nClosing browser...");
  await browser.close();
  process.exit(0);
});

// Keep process alive
await new Promise(() => {});

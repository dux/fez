import { test, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const run = (script) =>
  Bun.spawnSync({
    cmd: [process.execPath, '-e', script],
    stdout: 'pipe',
    stderr: 'pipe',
  });

// The entry must evaluate outside a browser (Node/SSR): no module may reach for
// document/window/MutationObserver at import time. Bun has no DOM by default,
// so a child process is a clean, DOM-less environment.
test('src/fez.js imports without a DOM', () => {
  const entry = pathToFileURL(path.join(root, 'src/fez.js')).href;
  const script = `import(${JSON.stringify(entry)}).then((m) => {
    if (!m.Fez || !m.FezBase || !m.default) process.exit(2);
  }).catch((e) => { console.error(e); process.exit(1); });`;

  const result = run(script);
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});

test('dist esm and cjs bundles import without a DOM', () => {
  const esm = path.join(root, 'dist', 'fez.esm.js');
  const cjs = path.join(root, 'dist', 'fez.cjs');
  if (!existsSync(esm) || !existsSync(cjs)) {
    return;
  }

  const script = `(async () => {
    const esm = await import(${JSON.stringify(pathToFileURL(esm).href)});
    if (!esm.Fez || !esm.FezBase) process.exit(2);
    const cjs = require(${JSON.stringify(cjs)});
    if (!cjs.Fez || !cjs.FezBase) process.exit(3);
  })().catch((e) => { console.error(e); process.exit(1); });`;

  const result = run(script);
  expect(result.stderr.toString()).toBe('');
  expect(result.exitCode).toBe(0);
});

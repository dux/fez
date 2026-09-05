// Runs every browser test file in its own bun process. One process sharing
// Playwright across files hangs mid-file under contention (a dozen tests time
// out at 30s each), while each file alone finishes in seconds.
//
//   bun test/browser/run.js
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => relative(process.cwd(), join(dir, name)));

let failed = 0;
for (const file of files) {
  const proc = Bun.spawnSync(['bun', 'test', file], { stdio: ['inherit', 'inherit', 'inherit'] });
  if (proc.exitCode !== 0) failed++;
}

if (failed) {
  console.error(`\n${failed} browser test file(s) failed`);
  process.exit(1);
}

import { afterEach, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { buildDocsSite, writeDocsIndex } from '../lib/site.js';
import { startDev } from '../lib/dev.js';

const fixtures = [];
const servers = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
  for (const root of fixtures.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const temporaryRoot = path.resolve(import.meta.dir, '../tmp');
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(temporaryRoot, 'site-test-'));
  fixtures.push(root);
  for (const directory of ['pages_src/root/fez', 'src', 'lib']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  fs.writeFileSync(
    path.join(root, 'fez-static.yaml'),
    'source_dir: pages_src\ntarget_dir: tmp/fez-pages\ncopy:\n  dist: dist\n',
  );
  fs.writeFileSync(
    path.join(root, 'pages_src/root/index.html'),
    '---\nlayout: false\n---\n<h1>Docs</h1>\n',
  );
  fs.writeFileSync(path.join(root, 'pages_src/root/fez/ui-z.fez'), '<p>Z</p>\n');
  fs.writeFileSync(path.join(root, 'pages_src/root/fez/ui-a.fez'), '<p>A</p>\n');
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { build: 'bun build.js' } }),
  );
  fs.writeFileSync(path.join(root, 'src/value.js'), 'first');
  fs.writeFileSync(
    path.join(root, 'build.js'),
    `
import fs from 'node:fs';
fs.mkdirSync('dist', { recursive: true });
fs.copyFileSync('src/value.js', 'dist/fez.js');
`,
  );
  return root;
}

async function until(check) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(25);
  }
  throw new Error('Timed out waiting for rebuild');
}

test('shared indexer sorts components, excludes directories and links, and avoids rewriting identical output', () => {
  const root = fixture();
  const components = path.join(root, 'pages_src/root/fez');
  fs.mkdirSync(path.join(components, 'directory.fez'));
  fs.symlinkSync(path.join(components, 'ui-z.fez'), path.join(components, 'link.fez'));
  expect(writeDocsIndex(root)).toBe(2);
  const index = path.join(root, 'pages_src/root/fez.txt');
  expect(fs.readFileSync(index, 'utf8')).toBe('fez/ui-a\nfez/ui-z\n');
  const modified = fs.statSync(index).mtimeMs;
  expect(writeDocsIndex(root)).toBe(2);
  expect(fs.statSync(index).mtimeMs).toBe(modified);
});

test('site build generates the component list before copying it to output', async () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(path.join(root, 'dist/fez.js'), 'library');
  await buildDocsSite(root);
  expect(fs.readFileSync(path.join(root, 'tmp/fez-pages/fez.txt'), 'utf8')).toBe(
    'fez/ui-a\nfez/ui-z\n',
  );
});

test('dev serves with live reload and rebuilds the library, pages and component index', async () => {
  const root = fixture();
  const dev = await startDev({ root, port: 0 });
  servers.push(dev);
  const initial = await fetch(dev.server.url).then((response) => response.text());
  expect(initial).toContain('<h1>Docs</h1>');
  expect(initial).toContain('/__fez_static/reload.js');
  fs.writeFileSync(path.join(root, 'src/value.js'), 'second');
  await until(
    async () =>
      (await fetch(new URL('dist/fez.js', dev.server.url)).then((r) => r.text())) === 'second',
  );
  fs.writeFileSync(path.join(root, 'pages_src/root/fez/ui-new.fez'), '<p>New</p>\n');
  await until(async () =>
    (await fetch(new URL('fez.txt', dev.server.url)).then((r) => r.text())).includes('fez/ui-new'),
  );
  fs.unlinkSync(path.join(root, 'pages_src/root/fez/ui-new.fez'));
  await until(
    async () =>
      !(await fetch(new URL('fez.txt', dev.server.url)).then((r) => r.text())).includes(
        'fez/ui-new',
      ),
  );
});

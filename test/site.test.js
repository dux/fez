import { afterEach, expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { buildDocsSite, writeDocsIndex } from '../lib/site.js';

const fixtures = [];

afterEach(() => {
  for (const root of fixtures.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const temporaryRoot = path.resolve(import.meta.dir, '../tmp');
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(temporaryRoot, 'site-test-'));
  fixtures.push(root);
  fs.mkdirSync(path.join(root, 'pages_src/root/fez'), { recursive: true });
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
  return root;
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

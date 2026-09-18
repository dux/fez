import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildStaticSite } from '../src/static.js';

export function writeDocsIndex(root = process.cwd()) {
  const directory = path.join(root, 'pages_src/root/fez');
  const names = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith('.fez') && !entry.name.includes('.tmp.'),
    )
    .map((entry) => 'fez/' + entry.name.slice(0, -4))
    .sort();
  const file = path.join(root, 'pages_src/root/fez.txt');
  const content = names.join('\n') + '\n';
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
    fs.writeFileSync(file, content);
  }
  return names.length;
}

export function buildLibrary(root = process.cwd()) {
  execFileSync(process.execPath, ['run', 'build'], { cwd: root, stdio: 'inherit' });
}

export async function buildDocsSite(root = process.cwd()) {
  writeDocsIndex(root);
  const result = await buildStaticSite({ root });
  process.stdout.write(
    `Built ${result.pages} pages and ${result.assets} assets -> ${result.outputDir}\n`,
  );
  return result;
}

if (import.meta.main) {
  await buildDocsSite();
}

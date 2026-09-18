import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildLibrary } from './site.js';
import { serveStaticSite, reloadStaticSiteClients } from '../src/static/serve.js';

export function startDev({ root = process.cwd(), port = 8000 } = {}) {
  // Load the site compiler afresh so its own source edits take effect too.
  const buildSite = () =>
    execFileSync(process.execPath, [path.join(import.meta.dir, 'site.js')], {
      cwd: root,
      stdio: 'inherit',
    });
  buildLibrary(root);
  buildSite();
  const server = serveStaticSite({ root, port, liveReload: true });
  const watchers = [];
  let timer;
  let libraryChanged = false;
  let closed = false;

  const rebuild = () => {
    if (closed) {
      return;
    }
    try {
      if (libraryChanged) {
        buildLibrary(root);
        libraryChanged = false;
      }
      buildSite();
      if (!closed) {
        reloadStaticSiteClients(server);
      }
    } catch (error) {
      console.error(`dev: ${error.message}`);
    }
  };

  const schedule = (filename, rebuildLibrary) => {
    const name = String(filename || '').replaceAll('\\', '/');
    if (closed || name.includes('.tmp.') || name === 'root/fez.txt') {
      return;
    }
    libraryChanged ||= rebuildLibrary;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 80);
  };

  for (const directory of ['src', 'pages_src', 'lib']) {
    watchers.push(
      fs.watch(path.join(root, directory), { recursive: true }, (_event, name) => {
        schedule(name, directory !== 'pages_src');
      }),
    );
  }
  const rootFiles = new Set([
    'package.json',
    'build.js',
    'README.md',
    'fez-static.yaml',
    'fez-static.json',
  ]);
  watchers.push(
    fs.watch(root, (_event, name) => {
      if (rootFiles.has(String(name))) {
        schedule(name, name === 'package.json' || name === 'build.js');
      }
    }),
  );

  process.stdout.write(`Serving ${server.url}\n`);
  return {
    server,
    close() {
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers) {
        watcher.close();
      }
      server.stop(true);
    },
  };
}

if (import.meta.main) {
  const dev = await startDev();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      dev.close();
      process.exit(0);
    });
  }
}

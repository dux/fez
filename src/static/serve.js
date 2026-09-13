// Dev server and file watcher for `fez static dev`.
//
// Kept apart from the build pipeline so static.js stays a build/render module.
// Imports the build entry points one way (this module -> static.js); static.js
// never imports back.

import fs from 'node:fs';
import path from 'node:path';
import {
  buildStaticSite,
  resolveStaticPaths,
  staticWatchTargets,
  resolveServeRoot,
  findServedFile,
  stripStaticBaseUrl,
} from '../static.js';

const LIVE_RELOAD_CHANNEL = 'fez-static-reload';
const LIVE_RELOAD_SCRIPT_PATH = '/__fez_static/reload.js';
const LIVE_RELOAD_SOCKET_PATH = '/__fez_static/reload';

export async function watchStaticSite(options = {}, callbacks = {}) {
  const onBuild = callbacks.onBuild || (() => {});
  const onError = callbacks.onError || (() => {});
  let watchers = [];
  let closed = false;
  let timer = null;
  let building = false;
  let queued = false;

  const schedule = (_event, filename, watchedFile = null, watchDir = null) => {
    const changedName = String(filename || '');
    if (closed || changedName.includes('.tmp.')) {
      return;
    }
    if (
      watchedFile &&
      changedName &&
      path.resolve(watchDir, changedName) !== path.resolve(watchedFile)
    ) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => void run(), 60);
  };

  const syncWatchers = () => {
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];

    for (const target of staticWatchTargets(resolveStaticPaths(options))) {
      const watcher = fs.watch(
        target.directory,
        { recursive: target.recursive },
        (event, filename) => schedule(event, filename, target.file, target.directory),
      );
      watchers.push(watcher);
    }
  };

  const run = async () => {
    if (closed) {
      return;
    }
    if (building) {
      queued = true;
      return;
    }

    building = true;
    try {
      const result = await buildStaticSite(options);
      syncWatchers();
      onBuild(result);
    } catch (error) {
      onError(error);
    } finally {
      building = false;
      if (queued && !closed) {
        queued = false;
        void run();
      }
    }
  };

  const initial = await buildStaticSite(options);
  syncWatchers();
  onBuild(initial);

  return {
    initial,
    close() {
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers) {
        watcher.close();
      }
      watchers = [];
    },
  };
}

export function serveStaticSite(options = {}) {
  const paths = resolveStaticPaths(options);
  const { config } = paths;
  const served = resolveServeRoot(paths);
  const liveReload = options.liveReload === true;
  const port = Number(options.port ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Port must be an integer between 0 and 65535');
  }

  const serverOptions = {
    hostname: options.host || '127.0.0.1',
    port,
    async fetch(request) {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url).pathname);
      } catch {
        return new Response('Bad request', { status: 400 });
      }

      if (pathname.includes('\0')) {
        return new Response('Bad request', { status: 400 });
      }

      if (liveReload && pathname === LIVE_RELOAD_SOCKET_PATH) {
        if (server.upgrade(request)) {
          return;
        }
        return new Response('WebSocket upgrade required', { status: 426 });
      }
      if (liveReload && pathname === LIVE_RELOAD_SCRIPT_PATH) {
        return new Response(liveReloadScript(), {
          headers: {
            'cache-control': 'no-store',
            'content-type': 'text/javascript; charset=utf-8',
          },
        });
      }

      const prefix = config.serve_prefix;
      if (prefix) {
        if (pathname === prefix || pathname.startsWith(prefix + '/')) {
          pathname = pathname.slice(prefix.length) || '/';
        } else {
          const location =
            prefix + (pathname === '/' ? (config.site.base_url || '') + '/' : pathname);
          return Response.redirect(new URL(location, request.url), 302);
        }
      }

      const filePath = findServedFile(
        served.dir,
        served.stripBase ? stripStaticBaseUrl(pathname, config.site.base_url) : pathname,
      );
      if (!filePath) {
        return new Response('Not found', { status: 404 });
      }

      const file = Bun.file(filePath);
      const headers = {
        'cache-control': 'no-store',
        'content-type': file.type || 'application/octet-stream',
      };
      if (request.method === 'HEAD') {
        return new Response(null, { headers });
      }
      if (liveReload && file.type.startsWith('text/html')) {
        return new Response(injectLiveReload(await file.text()), { headers });
      }
      return new Response(file, { headers });
    },
  };

  if (liveReload) {
    serverOptions.websocket = {
      open(socket) {
        socket.subscribe(LIVE_RELOAD_CHANNEL);
      },
      message() {},
    };
  }

  const server = Bun.serve(serverOptions);
  return server;
}

export function reloadStaticSiteClients(server) {
  return server.publish(LIVE_RELOAD_CHANNEL, 'reload');
}

function injectLiveReload(html) {
  const script = '<script src="' + LIVE_RELOAD_SCRIPT_PATH + '" defer></script>';
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, script + '\n</body>');
  }
  return html + script + '\n';
}

function liveReloadScript() {
  return [
    '(() => {',
    '  const connect = () => {',
    "    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';",
    "    const socket = new WebSocket(protocol + '//' + location.host + '" +
      LIVE_RELOAD_SOCKET_PATH +
      "');",
    "    socket.addEventListener('message', (event) => {",
    "      if (event.data === 'reload') location.reload();",
    '    });',
    "    socket.addEventListener('close', () => setTimeout(connect, 500));",
    '  };',
    '  connect();',
    '})();',
    '',
  ].join('\n');
}

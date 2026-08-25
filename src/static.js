import fs from 'node:fs';
import path from 'node:path';
import createTemplateCompiler from './fez/lib/template-compiler.js';

const PAGE_EXTENSIONS = new Set(['.html', '.md']);
const CONFIG_FILENAMES = ['config.yaml', 'config.json'];
const COLLECTION_SEGMENT = /^\[([a-z][a-z0-9_-]*)\]$/i;
const RAW_REGION_PATTERN =
  /(<!--[\s\S]*?-->)|(<(script|style|pre|code|xmp|fez-inline)\b[^>]*>)([\s\S]*?)(<\/\3\s*>)/gi;
const STATIC_CONTENT_MARKER = '\uE002FEZ_STATIC_CONTENT\uE003';
const STATIC_INCLUDE_MARKER_PATTERN = /<template data-fez-static-include="(\d+)"><\/template>/g;
const LIVE_RELOAD_CHANNEL = 'fez-static-reload';
const LIVE_RELOAD_SCRIPT_PATH = '/__fez_static/reload.js';
const LIVE_RELOAD_SOCKET_PATH = '/__fez_static/reload';

const STATIC_FEZ = {
  htmlEscape(value) {
    return String(value == null ? '' : value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character],
    );
  },

  isTruthy(value) {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return !!value;
  },

  toPairs(value) {
    if (Array.isArray(value)) {
      return value.map((item, index) => [item, index]);
    }
    if (value && typeof value === 'object') {
      return Object.entries(value);
    }
    return [];
  },
};

export async function buildStaticSite(options = {}) {
  const paths = resolveStaticPaths(options);
  const startedAt = performance.now();
  validateBuildPaths(paths);

  const sourceFiles = listFiles(paths.sourceDir);
  const copiedAssets = resolveCopiedAssets(paths);
  const pages = [];
  const assets = [];
  const collectionDirs = new Map();

  for (const absolutePath of sourceFiles) {
    const sourcePath = toPosix(path.relative(paths.sourceDir, absolutePath));
    const rootPath = parseRootPath(sourcePath);
    registerCollection(collectionDirs, rootPath.collection);
    const extension = path.extname(rootPath.outputPath).toLowerCase();
    if (PAGE_EXTENSIONS.has(extension)) {
      const page = readPage(
        absolutePath,
        sourcePath,
        rootPath.outputPath,
        rootPath.collection?.name,
        paths.config,
      );
      if (!page.draft || options.drafts) {
        pages.push(page);
      }
    } else {
      assets.push({ absolutePath, outputPath: rootPath.outputPath, sourcePath });
    }
  }

  const publicPages = pages.map((page) => toPublicPage(page, paths.config.site.base_url));
  const collections = buildCollections(publicPages, collectionDirs);
  const collectionIndexes = [...collectionDirs.values()].map((collection) => ({
    outputPath: collection.outputPath + '/index.yaml',
    sourcePath: collection.sourcePath,
    pages: collections[collection.name],
  }));
  assertUniqueOutputs(pages, [...assets, ...copiedAssets], collectionIndexes);

  if (options.validate) {
    validateRequiredMetadata(collections, paths.config.collections);
  }

  const site = {
    ...paths.config.site,
    pages: publicPages,
    collections,
  };
  const pageBySource = new Map(pages.map((page, index) => [page.absolutePath, publicPages[index]]));

  fs.mkdirSync(path.dirname(paths.outputDir), { recursive: true });
  const stageDir = fs.mkdtempSync(path.join(path.dirname(paths.outputDir), '.fez-static-stage-'));

  try {
    for (const page of pages) {
      const publicPage = pageBySource.get(page.absolutePath);
      const context = createRenderContext(site, collections, publicPage);
      const html = addGeneratedNotice(renderPage(page, context, paths), page.sourcePath);
      writeOutput(stageDir, page.outputPath, ensureFinalNewline(html));
    }

    for (const asset of assets) {
      const extension = path.extname(asset.outputPath).toLowerCase();
      if (extension === '.js' || extension === '.fez') {
        const source = fs.readFileSync(asset.absolutePath, 'utf8');
        writeOutput(
          stageDir,
          asset.outputPath,
          ensureFinalNewline(addGeneratedNotice(source, asset.sourcePath)),
        );
        continue;
      }
      const target = outputFilePath(stageDir, asset.outputPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(asset.absolutePath, target);
    }

    for (const asset of copiedAssets) {
      const target = outputFilePath(stageDir, asset.outputPath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(asset.absolutePath, target);
    }

    for (const index of collectionIndexes) {
      writeOutput(
        stageDir,
        index.outputPath,
        ensureFinalNewline(stripTrailingWhitespace(Bun.YAML.stringify(index.pages, null, 2))),
      );
    }

    if (options.validate) {
      validateStaticOutput(stageDir, paths.config.site.base_url);
    }

    if (options.check) {
      fs.rmSync(stageDir, { recursive: true, force: true });
    } else {
      replaceOutputDirectory(stageDir, paths.outputDir);
    }
  } catch (error) {
    if (fs.existsSync(stageDir)) {
      fs.rmSync(stageDir, { recursive: true, force: true });
    }
    throw error;
  }

  return {
    pages: pages.length,
    assets: assets.length + copiedAssets.length,
    collections: collectionIndexes.length,
    outputDir: paths.outputDir,
    duration: performance.now() - startedAt,
  };
}

export async function doctorStaticSite(options = {}) {
  return buildStaticSite({ ...options, check: true, validate: true });
}

export function initStaticSite(options = {}) {
  const rootDir = path.resolve(options.root || process.cwd());
  const siteDir = path.resolve(rootDir, options.site || 'fez-static');
  if (fs.existsSync(siteDir)) {
    throw new Error('Static site already exists: ' + siteDir);
  }

  const files = {
    'config.yaml': [
      'site:',
      '  title: My Fez Site',
      '  description: A small static site built with Fez',
      '',
    ].join('\n'),
    'layouts/default.html': [
      '<!doctype html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8">',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '    <meta name="description" content={page.description || site.description}>',
      '    <title>{page.title} - {site.title}</title>',
      '    <link rel="stylesheet" href={url("/site.css")}>',
      '  </head>',
      '  <body>',
      '    <header>',
      '      <nav><a href={url("/")}>{site.title}</a></nav>',
      '    </header>',
      '    <main>{@content}</main>',
      '    <footer>Built with Fez.</footer>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
    'root/index.html': [
      '---',
      'title: Home',
      '---',
      '<h1>{site.title}</h1>',
      '<p>{site.description}</p>',
      '<h2>Blog</h2>',
      '<ul>',
      '{#each collections.blogs as post}',
      '  <li><a href={post.href}>{post.title}</a></li>',
      '{/each}',
      '</ul>',
      '',
    ].join('\n'),
    'root/[blogs]/2026-01-01-hello-fez.md': [
      '---',
      'title: Hello, Fez',
      'description: The first post on this Fez static site.',
      'date: 2026-01-01',
      '---',
      '',
      '# Hello, Fez',
      '',
      'This is the first post in the `blogs` collection.',
      '',
    ].join('\n'),
    'root/[blogs]/2026-01-02-another-post.md': [
      '---',
      'title: Another post',
      'description: A second example collection entry.',
      'date: 2026-01-02',
      '---',
      '',
      '# Another post',
      '',
      'Add Markdown or HTML files here and rebuild the site.',
      '',
    ].join('\n'),
    'root/site.css': [
      ':root { font: 18px/1.6 system-ui, sans-serif; color: #202124; }',
      'body { max-width: 760px; margin: 0 auto; padding: 0 24px; }',
      'header, footer { padding: 24px 0; }',
      'main { min-height: 60vh; }',
      'a { color: #b42318; }',
      '',
    ].join('\n'),
  };

  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(siteDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  return { siteDir, files: Object.keys(files).length };
}

export function cleanStaticSite(options = {}) {
  const paths = resolveStaticPaths(options);
  validateBuildPaths(paths);
  const existed = fs.existsSync(paths.outputDir);
  if (existed) {
    fs.rmSync(paths.outputDir, { recursive: true, force: true });
  }
  return { outputDir: paths.outputDir, removed: existed };
}

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
  const { outputDir, config } = resolveStaticPaths(options);
  const liveReload = options.liveReload === true;
  const port = Number(options.port || 3000);
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

      const filePath = findServedFile(
        outputDir,
        stripStaticBaseUrl(pathname, config.site.base_url),
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

export function resolveStaticPaths(options = {}) {
  const rootDir = path.resolve(options.root || process.cwd());
  const siteDir = path.resolve(rootDir, options.site || 'fez-static');
  const configFile = resolveConfigFile(siteDir, options.config);
  const config = readStaticConfig(configFile);
  const sourceDir = options.source
    ? path.resolve(rootDir, options.source)
    : path.resolve(siteDir, 'root');
  const outputDir = options.output
    ? path.resolve(rootDir, options.output)
    : path.resolve(rootDir, config.target || 'build');

  return {
    rootDir,
    siteDir,
    sourceDir,
    layoutsDir: path.resolve(siteDir, 'layouts'),
    partsDir: path.resolve(siteDir, 'parts'),
    configFile,
    config,
    outputDir,
  };
}

function validateBuildPaths(paths) {
  let stat;
  try {
    stat = fs.statSync(paths.sourceDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Static root directory not found: ' + paths.sourceDir);
    }
    throw error;
  }
  if (!stat.isDirectory()) {
    throw new Error('Static root is not a directory: ' + paths.sourceDir);
  }

  const filesystemRoot = path.parse(paths.outputDir).root;
  if (paths.outputDir === filesystemRoot || paths.outputDir === paths.rootDir) {
    throw new Error('Refusing unsafe static output directory: ' + paths.outputDir);
  }
  if (!isPathInside(paths.rootDir, paths.outputDir)) {
    throw new Error('Static target must remain inside the project root: ' + paths.outputDir);
  }
  if (
    isPathInside(paths.outputDir, paths.sourceDir) ||
    isPathInside(paths.sourceDir, paths.outputDir)
  ) {
    throw new Error('Static root and output directories must not contain each other');
  }
}

function resolveConfigFile(siteDir, requestedFile) {
  if (requestedFile) {
    return path.resolve(siteDir, requestedFile);
  }
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(siteDir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readStaticConfig(configFile) {
  if (!configFile || !fs.existsSync(configFile)) {
    return { site: { base_url: '' }, collections: {}, copy: {} };
  }
  const source = fs.readFileSync(configFile, 'utf8');
  let parsed;
  if (path.extname(configFile).toLowerCase() === '.json') {
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      throw new Error('Invalid JSON in ' + configFile + ': ' + error.message, { cause: error });
    }
  } else {
    parsed = parseYaml(source, configFile);
  }
  const config = parsed || {};
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Static config must be an object: ' + configFile);
  }

  if (Object.prototype.hasOwnProperty.call(config, 'default_layout')) {
    throw new Error('default_layout is not configurable; use fez-static/layouts/default.html');
  }
  for (const name of ['target']) {
    if (
      Object.prototype.hasOwnProperty.call(config, name) &&
      (typeof config[name] !== 'string' || !config[name].trim())
    ) {
      throw new Error('Static config ' + name + ' must be a non-empty path string');
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(config, 'site') &&
    (config.site == null || typeof config.site !== 'object' || Array.isArray(config.site))
  ) {
    throw new Error('Static config site must be an object');
  }

  if (
    Object.prototype.hasOwnProperty.call(config, 'collections') &&
    (config.collections == null ||
      typeof config.collections !== 'object' ||
      Array.isArray(config.collections))
  ) {
    throw new Error('Static config collections must be an object');
  }
  for (const [name, options] of Object.entries(config.collections || {})) {
    if (!/^[a-z][a-z0-9_-]*$/i.test(name)) {
      throw new Error('Invalid static collection name: ' + name);
    }
    if (options == null || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('Static collection config must be an object: ' + name);
    }
    if (Object.prototype.hasOwnProperty.call(options, 'layout')) {
      effectiveLayout({ layout: options.layout });
    }
    if (Object.prototype.hasOwnProperty.call(options, 'required')) {
      if (
        !Array.isArray(options.required) ||
        options.required.some((field) => typeof field !== 'string' || !field.trim())
      ) {
        throw new Error('Static collection required fields must be non-empty strings: ' + name);
      }
      options.required = options.required.map((field) => field.trim());
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(config, 'copy') &&
    (config.copy == null || typeof config.copy !== 'object' || Array.isArray(config.copy))
  ) {
    throw new Error('Static config copy must be an object');
  }
  for (const [source, destination] of Object.entries(config.copy || {})) {
    if (!source.trim() || typeof destination !== 'string' || !destination.trim()) {
      throw new Error('Static copy paths must be non-empty strings');
    }
  }

  return {
    ...config,
    site: {
      ...(config.site || {}),
      base_url: normalizeStaticBaseUrl(config.site?.base_url),
    },
    collections: config.collections || {},
    copy: config.copy || {},
  };
}

function listFiles(directory) {
  const files = [];

  const visit = (current) => {
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.name.includes('.tmp.')) {
        continue;
      }
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  };

  visit(directory);
  return files;
}

function resolveCopiedAssets(paths) {
  const assets = [];

  for (const source of resolveCopySources(paths)) {
    if (source.stat.isDirectory()) {
      for (const absolutePath of listCopiedFiles(source.absolutePath)) {
        const relativePath = toPosix(path.relative(source.absolutePath, absolutePath));
        assets.push({
          absolutePath,
          outputPath: joinStaticOutputPath(source.outputPath, relativePath),
          sourcePath: 'copy ' + source.configuredPath + '/' + relativePath,
        });
      }
      continue;
    }

    const outputPath = source.destinationEndsInSlash
      ? joinStaticOutputPath(source.outputPath, path.basename(source.absolutePath))
      : source.outputPath === '.'
        ? path.basename(source.absolutePath)
        : source.outputPath;
    assets.push({
      absolutePath: source.absolutePath,
      outputPath,
      sourcePath: 'copy ' + source.configuredPath,
    });
  }

  return assets;
}

function resolveCopySources(paths) {
  const sources = [];
  const realRoot = fs.realpathSync(paths.rootDir);

  for (const [configuredPath, configuredOutput] of Object.entries(paths.config.copy)) {
    if (path.isAbsolute(configuredPath) || containsScratchPath(configuredPath)) {
      throw new Error('Invalid static copy source: ' + configuredPath);
    }

    const absolutePath = path.resolve(paths.siteDir, configuredPath);
    let stat;
    try {
      stat = fs.lstatSync(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Static copy source not found: ' + configuredPath);
      }
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error('Static copy sources cannot be symbolic links: ' + configuredPath);
    }
    if (!stat.isFile() && !stat.isDirectory()) {
      throw new Error('Static copy source must be a file or directory: ' + configuredPath);
    }

    const realSource = fs.realpathSync(absolutePath);
    if (!isPathInside(realRoot, realSource)) {
      throw new Error('Static copy source must remain inside the project root: ' + configuredPath);
    }
    if (
      isPathInside(paths.outputDir, absolutePath) ||
      (stat.isDirectory() && isPathInside(absolutePath, paths.outputDir))
    ) {
      throw new Error(
        'Static copy source and target must not contain each other: ' + configuredPath,
      );
    }

    const outputPath = normalizeStaticOutputPath(configuredOutput);
    sources.push({
      absolutePath,
      configuredPath,
      destinationEndsInSlash: /[\\/]$/.test(configuredOutput),
      outputPath,
      stat,
    });
  }

  return sources;
}

function listCopiedFiles(directory) {
  const files = [];

  const visit = (current) => {
    const entries = fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.name.includes('.tmp.')) {
        throw new Error(
          'Static copy cannot include scratch files: ' + path.join(current, entry.name),
        );
      }
      const absolutePath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error('Static copy cannot include symbolic links: ' + absolutePath);
      }
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  };

  visit(directory);
  return files;
}

function staticWatchTargets(paths) {
  const targets = [{ directory: paths.siteDir, recursive: true, file: null }];
  const seen = new Set([paths.siteDir + '\0']);

  for (const source of resolveCopySources(paths)) {
    if (isPathInside(paths.siteDir, source.absolutePath)) {
      continue;
    }
    let target;
    if (source.stat.isDirectory()) {
      target = { directory: source.absolutePath, recursive: true, file: null };
    } else {
      target = {
        directory: path.dirname(source.absolutePath),
        recursive: false,
        file: source.absolutePath,
      };
    }
    const key = target.directory + '\0' + (target.file || '');
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(target);
    }
  }

  return targets;
}

function normalizeStaticOutputPath(value) {
  const source = value.trim().replace(/\\/g, '/');
  if (source.includes('.tmp.') || path.posix.isAbsolute(source)) {
    throw new Error('Invalid static copy destination: ' + value);
  }
  const normalized = path.posix.normalize(source).replace(/^\.\//, '');
  if (normalized === '..' || normalized.startsWith('../')) {
    throw new Error('Static copy destination escapes the target: ' + value);
  }
  return normalized;
}

function joinStaticOutputPath(left, right) {
  return path.posix.join(left === '.' ? '' : left, right);
}

function containsScratchPath(value) {
  return value.split(/[\\/]/).some((segment) => segment.includes('.tmp.'));
}

function parseRootPath(sourcePath) {
  const sourceSegments = sourcePath.split('/');
  const outputSegments = [];
  let collection = null;

  for (const segment of sourceSegments) {
    const match = segment.match(COLLECTION_SEGMENT);
    if (!match) {
      outputSegments.push(segment);
      continue;
    }
    if (collection) {
      throw new Error('Static files cannot belong to nested collections: ' + sourcePath);
    }
    outputSegments.push(match[1]);
    collection = {
      name: match[1],
      sourcePath: sourceSegments.slice(0, outputSegments.length).join('/'),
      outputPath: outputSegments.join('/'),
    };
  }

  return { collection, outputPath: outputSegments.join('/') };
}

function registerCollection(collections, collection) {
  if (!collection) {
    return;
  }
  const existing = collections.get(collection.name);
  if (existing && existing.sourcePath !== collection.sourcePath) {
    throw new Error(
      'Static collection name is declared more than once: ' +
        existing.sourcePath +
        ' and ' +
        collection.sourcePath,
    );
  }
  collections.set(collection.name, collection);
}

function buildCollections(pages, collectionDirs) {
  const collections = Object.fromEntries([...collectionDirs.keys()].map((name) => [name, []]));
  for (const page of pages) {
    if (page.collection) {
      collections[page.collection].push(page);
    }
  }
  for (const pagesInCollection of Object.values(collections)) {
    pagesInCollection.sort(compareCollectionPages);
  }
  return collections;
}

function readPage(absolutePath, sourcePath, relativePath, collection, config) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  const { data, body } = splitFrontMatter(source, absolutePath);
  const extension = path.extname(relativePath).toLowerCase();
  const route = pageRoute(relativePath, data.permalink);
  const filename = path.basename(relativePath, extension);
  const filenameDate = filename.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];
  const slug = String(data.slug || filename.replace(/^\d{4}-\d{2}-\d{2}-/, ''));
  const date = normalizeDate(data.date || filenameDate);
  const defaultLayout = collection
    ? (config.collections[collection]?.layout ?? 'default')
    : 'default';
  const layout = effectiveLayout(data, defaultLayout);

  return {
    absolutePath,
    sourcePath,
    relativePath,
    outputPath: route.outputPath,
    url: route.url,
    extension,
    body,
    metadata: data,
    title: data.title || titleFromSlug(slug),
    slug,
    date,
    collection,
    layout,
    render: data.render !== false,
    draft: data.draft === true,
  };
}

function toPublicPage(page, baseUrl) {
  return {
    ...page.metadata,
    title: page.title,
    slug: page.slug,
    date: page.date,
    format: page.extension.slice(1),
    collection: page.collection,
    layout: page.layout,
    url: page.url,
    href: staticUrl(baseUrl, page.url),
    source_path: page.sourcePath,
  };
}

function compareCollectionPages(left, right) {
  const byDate = String(right.date || '').localeCompare(String(left.date || ''));
  return byDate || left.url.localeCompare(right.url);
}

function effectiveLayout(data, defaultLayout = 'default') {
  const value = Object.prototype.hasOwnProperty.call(data, 'layout') ? data.layout : defaultLayout;
  if (value === false || value === null) {
    return false;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Page layout must be a non-empty string or false');
  }
  return value.trim();
}

function pageRoute(relativePath, permalink) {
  if (permalink != null) {
    return permalinkRoute(permalink);
  }
  const extension = path.posix.extname(relativePath);
  const outputPath = relativePath.slice(0, -extension.length) + '.html';
  return { outputPath, url: '/' + outputPath };
}

function permalinkRoute(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    throw new Error('Permalink must be an absolute site path beginning with /');
  }
  if (/[?#]/.test(value) || value.split('/').includes('..')) {
    throw new Error('Invalid permalink: ' + value);
  }

  const normalized = path.posix.normalize(value);
  if (normalized === '/') {
    return { outputPath: 'index.html', url: '/' };
  }
  if (value.endsWith('/')) {
    const directory = normalized.replace(/\/$/, '');
    return {
      outputPath: directory.slice(1) + '/index.html',
      url: directory + '/',
    };
  }
  if (path.posix.extname(normalized)) {
    return { outputPath: normalized.slice(1), url: normalized };
  }
  return {
    outputPath: normalized.slice(1) + '.html',
    url: normalized + '.html',
  };
}

function normalizeStaticBaseUrl(value) {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value !== 'string') {
    throw new Error('Static site base_url must be a string');
  }

  const source = value.trim();
  if (
    !source.startsWith('/') ||
    source.startsWith('//') ||
    /[?#]/.test(source) ||
    /\/{2,}/.test(source) ||
    source.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('Static site base_url must be an absolute site path');
  }

  const normalized = source.replace(/\/+$/, '');
  return normalized === '' ? '' : normalized;
}

function staticUrl(baseUrl, value) {
  if (value == null) {
    return '';
  }
  const source = String(value);
  if (!source.startsWith('/') || source.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(source)) {
    return source;
  }
  const pathname = source.split(/[?#]/, 1)[0];
  if (!baseUrl || pathname === baseUrl || pathname.startsWith(baseUrl + '/')) {
    return source;
  }
  return baseUrl + source;
}

function normalizeDate(value) {
  if (value == null || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function titleFromSlug(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function assertUniqueOutputs(pages, assets, generated = []) {
  const outputs = new Map();
  const add = (outputPath, sourcePath) => {
    const key = outputPath.toLowerCase();
    const previous = outputs.get(key);
    if (previous) {
      throw new Error(
        'Static output collision for ' + outputPath + ': ' + previous + ' and ' + sourcePath,
      );
    }
    outputs.set(key, sourcePath);
  };

  for (const page of pages) {
    add(page.outputPath, page.relativePath);
  }
  for (const asset of assets) {
    add(asset.outputPath, asset.sourcePath);
  }
  for (const output of generated) {
    add(output.outputPath, output.sourcePath + ' collection index');
  }
}

function validateRequiredMetadata(collections, config) {
  const errors = [];

  for (const [name, options] of Object.entries(config)) {
    const required = [...new Set(options.required || [])];
    for (const page of collections[name] || []) {
      const missing = required.filter((field) => !hasRequiredMetadata(page[field]));
      if (missing.length) {
        errors.push(page.source_path + ' is missing required fields: ' + missing.join(', '));
      }
    }
  }

  if (errors.length) {
    throw staticDoctorError(errors);
  }
}

function hasRequiredMetadata(value) {
  if (value == null) {
    return false;
  }
  return typeof value !== 'string' || value.trim() !== '';
}

function validateStaticOutput(outputDir, baseUrl) {
  const documents = new Map();

  for (const absolutePath of listFiles(outputDir)) {
    if (path.extname(absolutePath).toLowerCase() !== '.html') {
      continue;
    }
    const outputPath = toPosix(path.relative(outputDir, absolutePath));
    const html = fs.readFileSync(absolutePath, 'utf8');
    documents.set(path.resolve(absolutePath), {
      anchors: extractStaticAnchors(html),
      outputPath,
      references: extractStaticReferences(html),
    });
  }

  const errors = [];
  for (const document of documents.values()) {
    for (const reference of document.references) {
      const error = validateStaticReference(reference, document, documents, outputDir, baseUrl);
      if (error) {
        errors.push(error);
      }
    }
  }

  if (errors.length) {
    throw staticDoctorError(errors);
  }
}

function validateStaticReference(reference, document, documents, outputDir, baseUrl) {
  const value = decodeStaticAttribute(reference.value).trim();
  if (!value || value.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return null;
  }
  const absolutePath = value.split(/[?#]/, 1)[0];
  if (
    baseUrl &&
    absolutePath.startsWith('/') &&
    absolutePath !== baseUrl &&
    !absolutePath.startsWith(baseUrl + '/')
  ) {
    return (
      document.outputPath +
      ' has ' +
      reference.attribute +
      '="' +
      value +
      '" outside base_url ' +
      baseUrl
    );
  }

  let resolved;
  try {
    const pageUrl = staticUrl(baseUrl, outputPathUrl(document.outputPath));
    resolved = new URL(value, 'https://fez-static.invalid' + pageUrl);
  } catch {
    return document.outputPath + ' has an invalid URL in ' + reference.attribute + ': ' + value;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(resolved.pathname);
  } catch {
    return document.outputPath + ' has an invalid encoded URL: ' + value;
  }
  const target = findServedFile(outputDir, stripStaticBaseUrl(pathname, baseUrl));
  if (!target) {
    return document.outputPath + ' links to missing output: ' + value;
  }

  if (!resolved.hash || path.extname(target).toLowerCase() !== '.html') {
    return null;
  }

  let anchor;
  try {
    anchor = decodeURIComponent(resolved.hash.slice(1));
  } catch {
    return document.outputPath + ' has an invalid encoded fragment: ' + value;
  }
  if (!anchor) {
    return null;
  }
  const targetDocument = documents.get(path.resolve(target));
  if (!targetDocument || !targetDocument.anchors.has(anchor)) {
    return document.outputPath + ' links to missing fragment: ' + value;
  }
  return null;
}

function extractStaticReferences(html) {
  const references = [];
  const protectedHtml = protectRawRegions(html).text;
  const tagPattern = /<([a-z][\w:-]*)\b([^<>]*?)\/?\s*>/gi;
  let match;

  while ((match = tagPattern.exec(protectedHtml))) {
    const tag = match[1].toLowerCase();
    const attributes = parseStaticAttributes(match[2]);
    if (attributes.has('data-fez-static-ignore')) {
      continue;
    }

    const names = staticReferenceAttributes(tag);
    for (const name of names) {
      const value = attributes.get(name);
      if (value == null) {
        continue;
      }
      if (name === 'srcset') {
        for (const source of staticSrcsetUrls(value)) {
          references.push({ attribute: name, value: source });
        }
      } else {
        references.push({ attribute: name, value });
      }
    }
  }

  return references;
}

function extractStaticAnchors(html) {
  const anchors = new Set();
  const protectedHtml = protectRawRegions(html).text;
  const tagPattern = /<([a-z][\w:-]*)\b([^<>]*?)\/?\s*>/gi;
  let match;

  while ((match = tagPattern.exec(protectedHtml))) {
    const tag = match[1].toLowerCase();
    const attributes = parseStaticAttributes(match[2]);
    const id = attributes.get('id');
    if (id) {
      anchors.add(decodeStaticAttribute(id));
    }
    const name = tag === 'a' ? attributes.get('name') : null;
    if (name) {
      anchors.add(decodeStaticAttribute(name));
    }
  }

  return anchors;
}

function parseStaticAttributes(source) {
  const attributes = new Map();
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function staticReferenceAttributes(tag) {
  if (tag === 'a' || tag === 'area' || tag === 'link') {
    return ['href'];
  }
  if (tag === 'img' || tag === 'source') {
    return ['src', 'srcset'];
  }
  if (tag === 'video') {
    return ['src', 'poster'];
  }
  if (['audio', 'embed', 'iframe', 'input', 'script', 'track'].includes(tag)) {
    return ['src'];
  }
  return [];
}

function staticSrcsetUrls(value) {
  if (value.trim().startsWith('data:')) {
    return [];
  }
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function decodeStaticAttribute(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function outputPathUrl(outputPath) {
  if (outputPath === 'index.html') {
    return '/';
  }
  if (outputPath.endsWith('/index.html')) {
    return '/' + outputPath.slice(0, -'index.html'.length);
  }
  return '/' + outputPath;
}

function staticDoctorError(errors) {
  return new Error(
    'Static doctor found ' +
      errors.length +
      (errors.length === 1 ? ' problem' : ' problems') +
      ':\n- ' +
      errors.join('\n- '),
  );
}

function createRenderContext(site, collections, page) {
  const includes = [];
  const url = (value) => staticUrl(site.base_url, value);
  const staticFez = {
    ...STATIC_FEZ,
    staticInclude(partPath, values = {}) {
      if (typeof partPath !== 'string' || !partPath) {
        throw new Error('Static include path must be a non-empty string');
      }
      if (values == null) {
        values = {};
      }
      if (typeof values !== 'object' || Array.isArray(values)) {
        throw new Error('Static include parameters must be an object');
      }
      const id = includes.length;
      includes.push({ partPath, values });
      return '<template data-fez-static-include="' + id + '"></template>';
    },
  };

  return {
    Fez: staticFez,
    UID: 0,
    fezName: page.source_path,
    site,
    page,
    collections,
    include: {},
    url,
    staticIncludes: includes,
  };
}

function renderPage(page, context, paths) {
  let content;
  if (!page.render) {
    content = page.body;
  } else {
    content =
      page.extension === '.md'
        ? Bun.markdown.html(page.body)
        : renderStaticTemplate(page.body, context, page.relativePath);
    content = expandStaticIncludes(content, context, path.dirname(page.absolutePath), [], paths);
  }

  let layoutName = page.layout;
  const layoutStack = [];
  while (layoutName) {
    const layoutFile = resolveLayoutFile(layoutName, paths.layoutsDir);
    if (layoutStack.includes(layoutFile)) {
      const cycle = [...layoutStack, layoutFile]
        .map((file) => toPosix(path.relative(paths.siteDir, file)))
        .join(' -> ');
      throw new Error('Layout cycle: ' + cycle);
    }
    layoutStack.push(layoutFile);

    let layoutSource;
    try {
      layoutSource = fs.readFileSync(layoutFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Layout not found: ' + layoutName + ' for ' + page.relativePath);
      }
      throw error;
    }

    const parsed = splitFrontMatter(layoutSource, layoutFile);
    const layoutContext = {
      ...context,
      fezName: toPosix(path.relative(paths.siteDir, layoutFile)),
      layout: parsed.data,
    };
    const extension = path.extname(layoutFile).toLowerCase();
    const templateSource = extension === '.md' ? Bun.markdown.html(parsed.body) : parsed.body;
    let rendered = renderStaticTemplate(templateSource, layoutContext, layoutContext.fezName);
    if (extension === '.md') {
      rendered = rendered.replace(
        new RegExp('<p>\\s*' + STATIC_CONTENT_MARKER + '\\s*</p>'),
        STATIC_CONTENT_MARKER,
      );
    }
    rendered = insertStaticContent(rendered, content, layoutContext.fezName);
    content = expandStaticIncludes(rendered, layoutContext, path.dirname(layoutFile), [], paths);

    if (!Object.prototype.hasOwnProperty.call(parsed.data, 'layout')) {
      break;
    }
    layoutName = parsed.data.layout;
    if (layoutName === false || layoutName === null) {
      break;
    }
    if (typeof layoutName !== 'string' || !layoutName.trim()) {
      throw new Error('Layout parent must be a non-empty string or false: ' + layoutFile);
    }
    layoutName = layoutName.trim();
  }

  if (page.render || page.layout) {
    assertNoStaticDirectives(content, page.relativePath);
    content = stripTrailingWhitespace(content);
  }
  return content;
}

function resolveLayoutFile(layoutName, layoutsDir) {
  if (path.isAbsolute(layoutName) || layoutName.split(/[\\/]/).includes('..')) {
    throw new Error('Invalid layout path: ' + layoutName);
  }
  const extension = path.extname(layoutName).toLowerCase();
  if (extension && !PAGE_EXTENSIONS.has(extension)) {
    throw new Error('Static layouts must use .html or .md: ' + layoutName);
  }
  const candidates = extension ? [layoutName] : [layoutName + '.html', layoutName + '.md'];
  const resolvedCandidates = candidates.map((name) => path.resolve(layoutsDir, name));
  if (resolvedCandidates.some((resolved) => !isPathInside(layoutsDir, resolved))) {
    throw new Error('Layout escapes fez-static/layouts: ' + layoutName);
  }
  return resolvedCandidates.find((candidate) => fs.existsSync(candidate)) || resolvedCandidates[0];
}

function renderStaticTemplate(source, context, label) {
  const protectedSource = protectRawRegions(source);
  if (/\{#await\b/.test(protectedSource.text)) {
    throw new Error('Static templates do not support await blocks: ' + label);
  }

  const transformed = transformStaticDirectives(protectedSource.text, label);
  const render = createTemplateCompiler(transformed, {
    name: label,
    static: true,
    strict: true,
  });
  return protectedSource.restore(render({ ...context, fezName: label }));
}

function transformStaticDirectives(source, label) {
  const withIncludes = replaceIncludeDirectives(source, (argumentsSource) => {
    assertLiteralIncludePath(argumentsSource, label);
    return '{@html Fez.staticInclude(' + argumentsSource + ')}';
  });
  return withIncludes.replace(/\{@content\s*\}/g, STATIC_CONTENT_MARKER);
}

function replaceIncludeDirectives(source, replace) {
  let result = '';
  let offset = 0;

  while (offset < source.length) {
    const start = source.indexOf('{@include', offset);
    if (start === -1) {
      result += source.slice(offset);
      break;
    }

    const next = source[start + 9];
    if (next && !/\s/.test(next)) {
      result += source.slice(offset, start + 9);
      offset = start + 9;
      continue;
    }

    result += source.slice(offset, start);
    const directive = extractStaticDirective(source, start);
    const argumentsSource = directive.expression.slice(8).trim();
    result += replace(argumentsSource);
    offset = directive.end + 1;
  }

  return result;
}

function extractStaticDirective(source, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
    } else if (character === '{') {
      depth++;
    } else if (character === '}') {
      depth--;
      if (depth === 0) {
        return {
          expression: source.slice(start + 1, index),
          end: index,
        };
      }
    }
  }

  throw new Error('Unterminated {@include} directive');
}

function assertLiteralIncludePath(argumentsSource, label) {
  const source = argumentsSource.trimStart();
  if (!source || (source[0] !== '"' && source[0] !== "'")) {
    throw new Error('{@include} path must be a quoted literal in ' + label);
  }
  const quote = source[0];
  let escaped = false;
  let end = -1;
  for (let index = 1; index < source.length; index++) {
    if (escaped) {
      escaped = false;
    } else if (source[index] === '\\') {
      escaped = true;
    } else if (source[index] === quote) {
      end = index;
      break;
    }
  }
  const remainder = end === -1 ? '' : source.slice(end + 1).trimStart();
  if (end === -1 || (remainder && !remainder.startsWith(','))) {
    throw new Error('{@include} path must be a quoted literal in ' + label);
  }
}

function expandStaticIncludes(html, context, currentDir, stack, paths) {
  const protectedHtml = protectRawRegions(html);
  let expanded = replaceIncludeDirectives(protectedHtml.text, (argumentsSource) => {
    argumentsSource = decodeStaticEntities(argumentsSource);
    assertLiteralIncludePath(argumentsSource, context.fezName);
    const [partPath, values] = evaluateIncludeArguments(argumentsSource, context);
    return context.Fez.staticInclude(partPath, values);
  });
  expanded = expanded.replace(
    /<p>\s*(<template data-fez-static-include="\d+"><\/template>)\s*<\/p>/g,
    '$1',
  );
  expanded = expanded.replace(STATIC_INCLUDE_MARKER_PATTERN, (_match, idSource) => {
    const request = context.staticIncludes[Number(idSource)];
    if (!request) {
      throw new Error('Unknown static include marker in ' + context.fezName);
    }

    const partFile = resolvePartFile(request.partPath, currentDir, paths.partsDir);
    if (path.basename(partFile).includes('.tmp.')) {
      throw new Error('{@include} cannot read scratch files: ' + request.partPath);
    }
    if (stack.includes(partFile)) {
      const cycle = [...stack, partFile]
        .map((file) => toPosix(path.relative(paths.siteDir, file)))
        .join(' -> ');
      throw new Error('Include cycle: ' + cycle);
    }

    let source;
    try {
      source = fs.readFileSync(partFile, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Part not found: ' + request.partPath + ' in ' + context.fezName);
      }
      throw error;
    }

    const parsed = splitFrontMatter(source, partFile);
    const includeContext = {
      ...context,
      fezName: toPosix(path.relative(paths.siteDir, partFile)),
      include: {
        ...parsed.data,
        ...request.values,
      },
    };
    const extension = path.extname(partFile).toLowerCase();
    let rendered;
    if (extension === '.md') {
      rendered = Bun.markdown.html(parsed.body);
    } else if (extension === '.html') {
      rendered = renderStaticTemplate(parsed.body, includeContext, includeContext.fezName);
    } else {
      throw new Error('Static parts must use .html or .md: ' + request.partPath);
    }
    rendered = expandStaticIncludes(
      rendered,
      includeContext,
      path.dirname(partFile),
      [...stack, partFile],
      paths,
    );
    return rendered;
  });
  return protectedHtml.restore(expanded);
}

function decodeStaticEntities(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function evaluateIncludeArguments(argumentsSource, context) {
  const names = Object.keys(context).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
  let values;
  try {
    // Static Fez templates already execute JavaScript expressions during a trusted build.
    // eslint-disable-next-line no-new-func
    const evaluate = new Function(...names, '"use strict"; return [' + argumentsSource + '];');
    values = evaluate(...names.map((name) => context[name]));
  } catch (error) {
    throw new Error(
      '{@include} expression error in ' + context.fezName + ': ' + firstLine(error.message),
    );
  }
  if (values.length > 2) {
    throw new Error('{@include} accepts a path and one parameters object in ' + context.fezName);
  }
  return values;
}

function resolvePartFile(partPath, currentDir, partsDir) {
  if (path.isAbsolute(partPath) || partPath.split(/[\\/]/).includes('..')) {
    throw new Error('Invalid static part path: ' + partPath);
  }
  const base = partPath.startsWith('./') ? currentDir : partsDir;
  const resolved = path.resolve(base, partPath);
  if (!isPathInside(partsDir, resolved)) {
    throw new Error('{@include} escapes fez-static/parts: ' + partPath);
  }
  return resolved;
}

function insertStaticContent(layout, content, label) {
  const protectedLayout = protectRawRegions(layout);
  const count = protectedLayout.text.split(STATIC_CONTENT_MARKER).length - 1;
  const result = protectedLayout.text.replace(STATIC_CONTENT_MARKER, content);
  if (count !== 1) {
    throw new Error('Layout ' + label + ' must contain exactly one {@content} directive');
  }
  return protectedLayout.restore(result);
}

function assertNoStaticDirectives(html, label) {
  const protectedHtml = protectRawRegions(html);
  if (protectedHtml.text.includes(STATIC_CONTENT_MARKER)) {
    throw new Error('{@content} can only be used once in a layout: ' + label);
  }
  if (/\{@include\b/.test(protectedHtml.text)) {
    throw new Error('Unexpanded {@include} directive in ' + label);
  }
}

function protectRawRegions(source) {
  const values = [];
  let prefix = '\uE000FEZ_STATIC_RAW_';
  while (source.includes(prefix)) {
    prefix += '_';
  }
  const text = source.replace(RAW_REGION_PATTERN, (value, comment, open, _tag, body, close) => {
    const token = prefix + values.length + '\uE001';
    if (comment) {
      values.push([token, value]);
      return token;
    }
    values.push([token, body]);
    return open + token + close;
  });
  return {
    text,
    restore(value) {
      for (const [token, raw] of values) {
        value = value.replaceAll(token, raw);
      }
      return value;
    },
  };
}

function splitFrontMatter(source, label) {
  const text = source.replace(/^\uFEFF/, '');
  if (!/^---[ \t]*\r?\n/.test(text)) {
    return { data: {}, body: text };
  }
  const match = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) {
    throw new Error('Unterminated YAML front matter: ' + label);
  }
  return {
    data: parseYaml(match[1], label),
    body: text.slice(match[0].length),
  };
}

function parseYaml(source, label) {
  if (!source.trim()) {
    return {};
  }
  let value;
  try {
    value = Bun.YAML.parse(source);
  } catch (error) {
    throw new Error('Invalid YAML in ' + label + ': ' + firstLine(error.message));
  }
  if (value == null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('YAML metadata must be an object: ' + label);
  }
  return value;
}

function writeOutput(stageDir, relativePath, content) {
  const target = outputFilePath(stageDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function outputFilePath(outputDir, relativePath) {
  const target = path.resolve(outputDir, ...relativePath.split('/'));
  if (!isPathInside(outputDir, target)) {
    throw new Error('Output path escapes build directory: ' + relativePath);
  }
  return target;
}

function replaceOutputDirectory(stageDir, outputDir) {
  const backupDir = path.join(
    path.dirname(outputDir),
    '.fez-static-backup-' + process.pid + '-' + Date.now(),
  );
  const hadOutput = fs.existsSync(outputDir);

  if (hadOutput) {
    fs.renameSync(outputDir, backupDir);
  }
  try {
    fs.renameSync(stageDir, outputDir);
  } catch (error) {
    if (hadOutput && fs.existsSync(backupDir)) {
      fs.renameSync(backupDir, outputDir);
    }
    throw error;
  }
  if (hadOutput) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }
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

function stripStaticBaseUrl(pathname, baseUrl) {
  if (typeof baseUrl !== 'string' || !baseUrl.startsWith('/')) {
    return pathname;
  }
  const prefix = baseUrl.replace(/\/+$/, '');
  if (!prefix || pathname === prefix) {
    return '/';
  }
  return pathname.startsWith(prefix + '/') ? pathname.slice(prefix.length) : pathname;
}

function findServedFile(outputDir, pathname) {
  const relative = pathname.replace(/^\/+/, '');
  const base = path.resolve(outputDir, relative);
  if (!isPathInside(outputDir, base)) {
    return null;
  }

  const candidates = [];
  if (pathname.endsWith('/')) {
    candidates.push(path.join(base, 'index.html'));
  } else {
    candidates.push(base);
    if (!path.extname(base)) {
      candidates.push(base + '.html');
      candidates.push(path.join(base, 'index.html'));
    }
  }

  for (const candidate of candidates) {
    if (!isPathInside(outputDir, candidate)) {
      continue;
    }
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        return candidate;
      }
      if (stat.isDirectory()) {
        const index = path.join(candidate, 'index.html');
        if (fs.statSync(index).isFile()) {
          return index;
        }
      }
    } catch {
      // Try the next clean-URL candidate.
    }
  }
  return null;
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return (
    relative === '' ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function ensureFinalNewline(value) {
  return value.endsWith('\n') ? value : value + '\n';
}

function addGeneratedNotice(value, sourcePath) {
  const safeSourcePath = ('fez-static/root/' + toPosix(sourcePath))
    .replace(/[\r\n]/g, ' ')
    .replace(/--/g, '- -');
  const message = 'generated from src: ' + safeSourcePath + ' | DO NOT EDIT OR READ THIS FILE';
  const notice =
    path.extname(sourcePath).toLowerCase() === '.js' ? '// ' + message : '<!-- ' + message + ' -->';
  return notice + '\n' + value;
}

function stripTrailingWhitespace(value) {
  return value.replace(/[ \t]+$/gm, '');
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function firstLine(message) {
  return String(message || 'Unknown error').split('\n')[0];
}

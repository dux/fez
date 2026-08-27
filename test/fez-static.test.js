import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildStaticSite,
  cleanStaticSite,
  doctorStaticSite,
  initStaticSite,
  reloadStaticSiteClients,
  serveStaticSite,
  watchStaticSite,
} from '../src/static.js';

const FEZ = path.resolve(import.meta.dir, '../bin/fez');
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('fez static', () => {
  test('builds HTML, Markdown, nested layouts, includes, posts, and assets', async () => {
    const root = createSite();
    write(
      root,
      'fez-static.yaml',
      lines([
        'site:',
        '  title: Test Site',
        '  script: /app.js',
        'collections:',
        '  blogs:',
        '    layout: post',
      ]),
    );
    write(
      root,
      'web_src/layouts/default.html',
      lines([
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <!-- keep this comment -->',
        '    <title>{page.title} | {site.title}</title>',
        '    <script src={site.script}></script>',
        '    <script>window.config = { ready: true }</script>',
        '  </head>',
        '  <body>',
        '    {@include "header.html", { label: site.title }}',
        '    {@content}',
        '    <ul class="posts">',
        '    {#each collections.blogs as post}',
        '      {@include "post-link.html", { post }}',
        '    {/each}',
        '    </ul>',
        '  </body>',
        '</html>',
      ]),
    );
    write(
      root,
      'web_src/layouts/post.html',
      lines([
        '---',
        'layout: default',
        '---',
        '<article data-slug={page.slug}>',
        '  {@content}',
        '</article>',
      ]),
    );
    write(root, 'web_src/parts/header.html', '<header>{include.label}</header>\n');
    write(
      root,
      'web_src/parts/post-link.html',
      '<li><a href={include.post.url}>{include.post.title}</a><div class="post-content">{@html include.post.content}</div></li>\n',
    );
    write(
      root,
      'web_src/root/index.html',
      lines(['---', 'title: Home', '---', '<h1>{page.title}</h1>']),
    );
    write(
      root,
      'web_src/root/[blogs]/2026-08-20-older.md',
      lines([
        '---',
        'title: Older',
        'permalink: /notes/older/',
        '---',
        '# Older',
        '',
        'Literal {page.title} remains Markdown.',
      ]),
    );
    write(
      root,
      'web_src/root/[blogs]/2026-08-24-newer.md',
      lines(['---', 'title: Newer', '---', '# Newer']),
    );
    write(
      root,
      'web_src/root/[blogs]/2026-08-25-draft.md',
      lines(['---', 'title: Draft', 'draft: true', '---', '# Draft']),
    );
    write(
      root,
      'web_src/root/raw.html',
      lines([
        '---',
        'title: Raw',
        'layout: false',
        'permalink: /raw/',
        '---',
        '<p>{page.title}</p>',
      ]),
    );
    write(root, 'web_src/root/assets/site.css', 'body { color: rebeccapurple; }\n');
    write(root, 'web_src/root/assets/app.js', 'window.ready = true;\n');
    write(root, 'web_src/root/fez/example.fez', '<p>Example</p>\n');
    write(root, 'web_src/root/[blogs]/assets/cover.txt', 'collection asset\n');

    const result = await buildStaticSite({ root });

    expect(result.pages).toBe(4);
    expect(result.assets).toBe(4);
    expect(result.collections).toBe(1);
    expect(read(root, 'web_build/index.html')).toStartWith(
      '<!-- generated from src: web_src/root/index.html | DO NOT EDIT OR READ THIS FILE -->\n' +
        '<!doctype html>\n',
    );
    expect(read(root, 'web_build/index.html')).toContain('<title>Home | Test Site</title>');
    expect(read(root, 'web_build/index.html')).toContain('<!-- keep this comment -->');
    expect(read(root, 'web_build/index.html')).toContain(
      '<script>window.config = { ready: true }</script>',
    );
    expect(read(root, 'web_build/index.html')).toContain('<script src="/app.js"></script>');
    expect(read(root, 'web_build/index.html')).toContain('<header>Test Site</header>');
    expect(read(root, 'web_build/index.html')).not.toContain('fez-key');
    expect(read(root, 'web_build/notes/older/index.html')).toContain('data-slug="older"');
    expect(read(root, 'web_build/notes/older/index.html')).toContain(
      'Literal {page.title} remains Markdown.',
    );
    expect(read(root, 'web_build/notes/older/index.html')).toStartWith(
      '<!-- generated from src: web_src/root/[blogs]/2026-08-20-older.md | ' +
        'DO NOT EDIT OR READ THIS FILE -->\n',
    );
    expect(read(root, 'web_build/raw/index.html')).toBe(
      '<!-- generated from src: web_src/root/raw.html | DO NOT EDIT OR READ THIS FILE -->\n' +
        '<p>Raw</p>\n',
    );
    expect(read(root, 'web_build/assets/site.css')).toBe('body { color: rebeccapurple; }\n');
    expect(read(root, 'web_build/assets/app.js')).toBe(
      '// generated from src: web_src/root/assets/app.js | DO NOT EDIT OR READ THIS FILE\n' +
        'window.ready = true;\n',
    );
    expect(read(root, 'web_build/fez/example.fez')).toBe(
      '<!-- generated from src: web_src/root/fez/example.fez | ' +
        'DO NOT EDIT OR READ THIS FILE -->\n<p>Example</p>\n',
    );
    expect(read(root, 'web_build/blogs/assets/cover.txt')).toBe('collection asset\n');
    expect(fs.existsSync(path.join(root, 'web_build/blogs/2026-08-25-draft.html'))).toBe(false);

    const collectionIndexSource = read(root, 'web_build/blogs/index.yaml');
    expect(/[ \t]+$/m.test(collectionIndexSource)).toBe(false);
    const collectionIndex = Bun.YAML.parse(collectionIndexSource);
    expect(collectionIndex.map((page) => page.title)).toEqual(['Newer', 'Older']);
    expect(collectionIndex[0].collection).toBe('blogs');
    expect(collectionIndex[0].source_path).toBe('[blogs]/2026-08-24-newer.md');
    expect(collectionIndex[0].layout).toBe('post');
    expect(collectionIndex[0].content).toBeUndefined();

    const index = read(root, 'web_build/index.html');
    expect(/[ \t]+$/m.test(index)).toBe(false);
    expect(index.indexOf('Newer')).toBeLessThan(index.indexOf('Older'));
    expect(index).toContain('href="/notes/older/"');
    expect(index).not.toContain('href="/notes/older//"');
    expect(index).toContain('<div class="post-content"><h1>Newer</h1></div>');

    const withDrafts = await buildStaticSite({ root, drafts: true });
    expect(withDrafts.pages).toBe(5);
    expect(fs.existsSync(path.join(root, 'web_build/blogs/2026-08-25-draft.html'))).toBe(true);
    expect(Bun.YAML.parse(read(root, 'web_build/blogs/index.yaml'))[0].title).toBe('Draft');
  });

  test('expands relative and Markdown includes recursively', async () => {
    const root = createSite();
    write(root, 'web_src/layouts/default.md', '# {site.title}\n\n{@content}\n');
    write(root, 'fez-static.yaml', lines(['site:', '  title: Markdown layout']));
    write(
      root,
      'web_src/parts/outer.html',
      '<aside>{include.kind}{@include "./inner.md"}</aside>\n',
    );
    write(root, 'web_src/parts/inner.md', '**Nested** include\n');
    write(
      root,
      'web_src/root/index.md',
      lines([
        '---',
        'title: Includes',
        '---',
        '# Page',
        '',
        '{@include "outer.html", { kind: "note" }}',
      ]),
    );

    await buildStaticSite({ root });

    const output = read(root, 'web_build/index.html');
    expect(output).toContain('<h1>Markdown layout</h1>');
    expect(output).toContain('<aside>note<p><strong>Nested</strong> include</p>');
    expect(output).not.toContain('{@include');
  });

  test('keeps the previous build when rendering fails', async () => {
    const root = createSite();
    write(root, 'web_build/stable.txt', 'previous build\n');
    write(root, 'web_src/layouts/default.html', '<main>{missing.value}{@content}</main>\n');
    write(root, 'web_src/root/index.html', '<h1>Broken</h1>\n');

    await expect(buildStaticSite({ root })).rejects.toThrow('template runtime error');

    expect(read(root, 'web_build/stable.txt')).toBe('previous build\n');
    expect(fs.readdirSync(root).some((name) => name.startsWith('.fez-static-stage-'))).toBe(false);
  });

  test('adds the generated notice to explicitly unrendered HTML', async () => {
    const root = createSite();
    write(
      root,
      'web_src/root/legacy.html',
      lines([
        '---',
        'layout: false',
        'render: false',
        '---',
        '<p>{page.title} {@include "missing.html"}</p>',
      ]),
    );

    await buildStaticSite({ root });

    expect(read(root, 'web_build/legacy.html')).toBe(
      '<!-- generated from src: web_src/root/legacy.html | DO NOT EDIT OR READ THIS FILE -->\n' +
        '<p>{page.title} {@include "missing.html"}</p>\n',
    );
  });

  test('uses config target paths from the project root and validates without publishing', async () => {
    const root = createSite();
    write(
      root,
      'fez-static.yaml',
      lines(['target_dir: public', 'site:', '  title: Configured Site']),
    );
    write(root, 'web_src/layouts/default.html', '<title>{site.title}</title>{@content}\n');
    write(root, 'web_src/root/index.md', '# Configured\n');
    write(root, 'public/stable.txt', 'previous target\n');

    const checked = await doctorStaticSite({ root });
    expect(checked.pages).toBe(1);
    expect(read(root, 'public/stable.txt')).toBe('previous target\n');

    const built = await buildStaticSite({ root });
    expect(built.outputDir).toBe(path.join(root, 'public'));
    expect(read(root, 'public/index.html')).toContain('<title>Configured Site</title>');
    expect(cleanStaticSite({ root })).toEqual({
      outputDir: path.join(root, 'public'),
      removed: true,
    });
    expect(fs.existsSync(path.join(root, 'public'))).toBe(false);
  });

  test('builds base-aware URLs and validates links, assets, anchors, and metadata', async () => {
    const root = createSite();
    write(
      root,
      'fez-static.yaml',
      lines([
        'site:',
        '  base_url: /preview/',
        'collections:',
        '  docs:',
        '    required: [title, description]',
      ]),
    );
    write(
      root,
      'web_src/layouts/default.html',
      lines([
        '<nav><a href={url("/")}>Home</a></nav>',
        '<main>{@content}</main>',
        '<script src={url("/app.js")}></script>',
      ]),
    );
    write(root, 'web_src/root/index.html', '<h1 id="home">Home</h1>\n');
    write(
      root,
      'web_src/root/[docs]/guide.html',
      lines([
        '---',
        'title: Guide',
        'description: A guide.',
        'permalink: /guide/',
        '---',
        '<h1 id="start">Guide</h1>',
        '<a href={page.href + "#start"}>Start</a>',
        '<img src={url("/cover.png")} alt="Cover">',
        '<a href="/application" data-fez-static-ignore>Application</a>',
      ]),
    );
    write(root, 'web_src/root/app.js', 'window.ready = true;\n');
    write(root, 'web_src/root/cover.png', 'image\n');

    const built = await buildStaticSite({ root });
    expect(built.pages).toBe(2);
    expect(read(root, 'web_build/guide/index.html')).toContain('href="/preview/guide/#start"');
    expect(read(root, 'web_build/guide/index.html')).toContain('src="/preview/cover.png"');
    expect(read(root, 'web_build/docs/index.yaml')).toContain('href: /preview/guide/');

    const checked = await doctorStaticSite({ root });
    expect(checked.pages).toBe(2);
    expect(read(root, 'web_build/guide/index.html')).toContain('Guide');

    const broken = createSite();
    write(
      broken,
      'web_src/root/index.html',
      lines([
        '---',
        'layout: false',
        '---',
        '<a href="/missing/">Missing</a>',
        '<a href="#missing">Missing anchor</a>',
        '<img src="/missing.png">',
      ]),
    );
    await expect(doctorStaticSite({ root: broken })).rejects.toThrow('3 problems');

    const wrongBase = createSite();
    write(wrongBase, 'fez-static.yaml', 'site:\n  base_url: /preview\n');
    write(
      wrongBase,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<a href="/other/">Other</a>']),
    );
    await expect(doctorStaticSite({ root: wrongBase })).rejects.toThrow(
      'outside base_url /preview',
    );

    const wrongFez = createSite();
    write(wrongFez, 'fez-static.yaml', 'site:\n  base_url: /preview\n');
    write(
      wrongFez,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<script fez="/other.fez"></script>']),
    );
    await expect(doctorStaticSite({ root: wrongFez })).rejects.toThrow('outside base_url /preview');

    const namedFez = createSite();
    write(
      namedFez,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<script fez="ui-clock"></script>']),
    );
    await expect(doctorStaticSite({ root: namedFez })).resolves.toMatchObject({ pages: 1 });
  });

  test('emits build-root URLs with page.base so nested pages share one prefix', async () => {
    const root = createSite();
    write(
      root,
      'web_src/layouts/default.html',
      lines([
        '<base href={page.base}>',
        '<link rel="stylesheet" href={url("/app.css")}>',
        '<a href={url("/")}>Home</a>',
        '<script fez={url("/app.fez")}></script>',
        '<main>{@content}</main>',
      ]),
    );
    write(root, 'web_src/root/index.html', '<h1>Home</h1>\n');
    write(
      root,
      'web_src/root/nested.html',
      lines(['---', 'permalink: /deep/page/', '---', '<p>Deep</p>']),
    );
    write(root, 'web_src/root/app.css', 'body{}\n');
    write(root, 'web_src/root/app.fez', '<p>Hi</p>\n');

    await buildStaticSite({ root });
    expect(read(root, 'web_build/index.html')).toContain('<base href="./">');
    expect(read(root, 'web_build/index.html')).toContain('href="app.css"');
    expect(read(root, 'web_build/index.html')).toContain('fez="app.fez"');
    expect(read(root, 'web_build/deep/page/index.html')).toContain('<base href="../../">');
    expect(read(root, 'web_build/deep/page/index.html')).toContain('href="app.css"');
    expect(read(root, 'web_build/deep/page/index.html')).toContain('fez="app.fez"');
    await expect(doctorStaticSite({ root })).resolves.toMatchObject({ pages: 2 });
  });

  test('emits page-relative URLs and serves from a parent document root', async () => {
    const root = createSite();
    write(
      root,
      'fez-static.yaml',
      lines([
        'target_dir: public',
        'serve_root: .',
        'serve_prefix: /repo',
        'site:',
        '  base_url: /public',
        '  relative_urls: true',
      ]),
    );
    write(
      root,
      'web_src/layouts/default.html',
      lines([
        '<link rel="stylesheet" href={url("/app.css")}>',
        '<a href={url("/")}>Home</a>',
        '<main>{@content}</main>',
      ]),
    );
    write(root, 'web_src/root/index.html', '<h1>Home</h1>\n');
    write(
      root,
      'web_src/root/nested.html',
      lines(['---', 'permalink: /deep/page/', '---', '<p>Deep</p>']),
    );
    write(root, 'web_src/root/app.css', 'body{}\n');

    await buildStaticSite({ root });
    expect(read(root, 'public/index.html')).toContain('href="app.css"');
    expect(read(root, 'public/index.html')).toContain('href="./"');
    expect(read(root, 'public/deep/page/index.html')).toContain('href="../../app.css"');
    expect(read(root, 'public/deep/page/index.html')).toContain('href="../../"');
    await expect(doctorStaticSite({ root })).resolves.toMatchObject({ pages: 2 });

    const server = serveStaticSite({ root, port: '0' });
    try {
      expect((await fetch(new URL('/repo/public/', server.url))).status).toBe(200);
      expect((await fetch(new URL('/repo/public/app.css', server.url))).status).toBe(200);
      expect((await fetch(new URL('/repo/public/deep/page/', server.url))).status).toBe(200);
      const redirected = await fetch(new URL('/public/', server.url), { redirect: 'manual' });
      expect(redirected.status).toBe(302);
      expect(redirected.headers.get('location')).toContain('/repo/public/');
    } finally {
      server.stop(true);
    }

    const missingMetadata = createSite();
    write(
      missingMetadata,
      'fez-static.yaml',
      lines(['collections:', '  notes:', '    required: [description]']),
    );
    write(
      missingMetadata,
      'web_src/root/[notes]/note.html',
      lines(['---', 'layout: false', 'title: Note', '---', '<p>Note</p>']),
    );
    await expect(doctorStaticSite({ root: missingMetadata })).rejects.toThrow(
      'missing required fields: description',
    );

    const invalidBase = createSite();
    write(invalidBase, 'fez-static.yaml', 'site:\n  base_url: docs\n');
    write(invalidBase, 'web_src/root/index.html', '<p>Invalid</p>\n');
    await expect(buildStaticSite({ root: invalidBase })).rejects.toThrow(
      'base_url must be an absolute site path',
    );
  });

  test('copies configured files and directories outside the static root', async () => {
    const root = createSite();
    write(
      root,
      'fez-static.yaml',
      lines(['copy:', '  "dist/main.min.js": "./assets/main.min.js"', '  "shared": "./vendor"']),
    );
    write(root, 'web_src/root/index.html', lines(['---', 'layout: false', '---', '<p>Home</p>']));
    write(root, 'dist/main.min.js', 'window.minified=true;\n');
    write(root, 'shared/nested/data.txt', 'shared data\n');

    const result = await buildStaticSite({ root });
    expect(result.assets).toBe(2);
    expect(read(root, 'web_build/assets/main.min.js')).toBe('window.minified=true;\n');
    expect(read(root, 'web_build/vendor/nested/data.txt')).toBe('shared data\n');

    const collision = createSite();
    write(collision, 'fez-static.yaml', 'copy:\n  "outside.html": "index.html"\n');
    write(collision, 'outside.html', '<p>Outside</p>\n');
    write(
      collision,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<p>Inside</p>']),
    );
    await expect(buildStaticSite({ root: collision })).rejects.toThrow('output collision');

    const scratch = createSite();
    write(scratch, 'fez-static.yaml', 'copy:\n  "file.tmp.js": "file.js"\n');
    write(scratch, 'web_src/root/index.html', '<p>Scratch</p>\n');
    await expect(buildStaticSite({ root: scratch })).rejects.toThrow('Invalid static copy source');

    const outside = createSite();
    write(outside, 'secret.txt', 'secret\n');
    const unsafe = createSite();
    const unsafeSource = toPosix(path.relative(unsafe, path.join(outside, 'secret.txt')));
    write(unsafe, 'fez-static.yaml', 'copy:\n  "' + unsafeSource + '": "secret.txt"\n');
    write(unsafe, 'web_src/root/index.html', '<p>Unsafe</p>\n');
    await expect(buildStaticSite({ root: unsafe })).rejects.toThrow(
      'copy source must remain inside the project root',
    );
  });

  test('loads JSON config and prefers YAML when both files exist', async () => {
    const jsonRoot = createSite();
    write(
      jsonRoot,
      'fez-static.json',
      JSON.stringify({ target_dir: 'json-public', site: { title: 'JSON Site' } }, null, 2) + '\n',
    );
    write(jsonRoot, 'web_src/layouts/default.html', '<title>{site.title}</title>{@content}\n');
    write(jsonRoot, 'web_src/root/index.html', '<h1>JSON</h1>\n');

    await buildStaticSite({ root: jsonRoot });
    expect(read(jsonRoot, 'json-public/index.html')).toContain('<title>JSON Site</title>');

    const preferredRoot = createSite();
    write(
      preferredRoot,
      'fez-static.json',
      JSON.stringify({ target_dir: 'json-public', site: { title: 'JSON Site' } }) + '\n',
    );
    write(
      preferredRoot,
      'fez-static.yaml',
      lines(['target_dir: yaml-public', 'site:', '  title: YAML Site']),
    );
    write(preferredRoot, 'web_src/layouts/default.html', '<title>{site.title}</title>{@content}\n');
    write(preferredRoot, 'web_src/root/index.html', '<h1>YAML</h1>\n');

    await buildStaticSite({ root: preferredRoot });
    expect(read(preferredRoot, 'yaml-public/index.html')).toContain('<title>YAML Site</title>');
    expect(fs.existsSync(path.join(preferredRoot, 'json-public'))).toBe(false);
  });

  test('initializes a safe starter site with a collection', async () => {
    const root = createSite();
    const initialized = initStaticSite({ root });

    expect(initialized.files).toBe(6);
    expect(initialized.siteDir).toBe(path.join(root, 'web_src'));
    const starterConfig = read(root, 'fez-static.yaml');
    expect(starterConfig).toContain('\nsource_dir: web_src\n');
    expect(starterConfig).toContain('\ntarget_dir: web_build\n');
    for (const option of [
      'base_url',
      'relative_urls',
      'copy',
      'collections',
      'serve_root',
      'serve_prefix',
    ]) {
      expect(starterConfig).toMatch(new RegExp('^\\s*# ' + option + ':', 'm'));
    }
    expect(Object.keys(Bun.YAML.parse(starterConfig)).sort()).toEqual([
      'site',
      'source_dir',
      'target_dir',
    ]);
    expect(fs.existsSync(path.join(root, 'web_src/root/index.html'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'web_src/root/[blogs]'))).toBe(true);
    expect(() => initStaticSite({ root })).toThrow('already exists');

    const built = await buildStaticSite({ root });
    expect(built.pages).toBe(3);
    expect(
      Bun.YAML.parse(read(root, 'web_build/blogs/index.yaml')).map((page) => page.title),
    ).toEqual(['Another post', 'Hello, Fez']);
    expect(read(root, 'web_build/index.html')).toContain('Another post');

    const configured = createSite();
    write(configured, 'config/fez-static.yaml', 'source_dir: site\ntarget_dir: public\n');
    const configuredInit = initStaticSite({ root: configured });
    expect(configuredInit.files).toBe(5);
    expect(configuredInit.siteDir).toBe(path.join(configured, 'site'));
    expect(fs.existsSync(path.join(configured, 'fez-static.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(configured, 'site/root/index.html'))).toBe(true);
    expect((await buildStaticSite({ root: configured })).outputDir).toBe(
      path.join(configured, 'public'),
    );
  });

  test('resolves config from the project root or config/ with source_dir and target_dir', async () => {
    const nested = createSite();
    write(nested, 'config/fez-static.yaml', lines(['source_dir: site', 'target_dir: out']));
    write(nested, 'site/layouts/default.html', '<main>{@content}</main>\n');
    write(nested, 'site/root/index.md', '# Nested config\n');

    const built = await buildStaticSite({ root: nested });
    expect(built.outputDir).toBe(path.join(nested, 'out'));
    expect(read(nested, 'out/index.html')).toStartWith(
      '<!-- generated from src: site/root/index.md | DO NOT EDIT OR READ THIS FILE -->\n',
    );

    const rootWins = createSite();
    write(rootWins, 'fez-static.json', JSON.stringify({ target_dir: 'from-root' }) + '\n');
    write(rootWins, 'config/fez-static.yaml', 'target_dir: from-config\n');
    write(
      rootWins,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<p>Root wins</p>']),
    );
    expect((await buildStaticSite({ root: rootWins })).outputDir).toBe(
      path.join(rootWins, 'from-root'),
    );

    const legacy = createSite();
    write(legacy, 'fez-static.yaml', 'target: public\n');
    write(
      legacy,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<p>Legacy</p>']),
    );
    await expect(buildStaticSite({ root: legacy })).rejects.toThrow('renamed to target_dir');

    const escaping = createSite();
    write(escaping, 'fez-static.yaml', 'source_dir: ../elsewhere\n');
    await expect(buildStaticSite({ root: escaping })).rejects.toThrow(
      'source_dir must remain inside the project root',
    );

    const empty = createSite();
    write(empty, 'fez-static.yaml', 'source_dir: ""\n');
    await expect(buildStaticSite({ root: empty })).rejects.toThrow(
      'source_dir must be a non-empty path string',
    );

    const missing = createSite();
    await expect(buildStaticSite({ root: missing })).rejects.toThrow('source_dir: web_src');
  });

  test('rejects include cycles and paths outside the source', async () => {
    const cyclic = createSite();
    write(cyclic, 'web_src/layouts/default.html', '{@include "a.html"}{@content}\n');
    write(cyclic, 'web_src/parts/a.html', '{@include "./b.html"}\n');
    write(cyclic, 'web_src/parts/b.html', '{@include "./a.html"}\n');
    write(cyclic, 'web_src/root/index.html', '<p>Cycle</p>\n');

    await expect(buildStaticSite({ root: cyclic })).rejects.toThrow('Include cycle');

    const escaping = createSite();
    write(escaping, 'web_src/layouts/default.html', '{@include "../secret.html"}{@content}\n');
    write(escaping, 'web_src/root/index.html', '<p>Escape</p>\n');

    await expect(buildStaticSite({ root: escaping })).rejects.toThrow('Invalid static part path');
  });

  test('rejects layout cycles, output collisions, and dynamic include paths', async () => {
    const layouts = createSite();
    write(
      layouts,
      'web_src/layouts/default.html',
      lines(['---', 'layout: second', '---', '{@content}']),
    );
    write(
      layouts,
      'web_src/layouts/second.html',
      lines(['---', 'layout: default', '---', '{@content}']),
    );
    write(layouts, 'web_src/root/index.html', '<p>Cycle</p>\n');
    await expect(buildStaticSite({ root: layouts })).rejects.toThrow('Layout cycle');

    const collisions = createSite();
    write(collisions, 'web_src/layouts/default.html', '{@content}\n');
    write(collisions, 'web_src/root/one.md', lines(['---', 'permalink: /same/', '---', '# One']));
    write(
      collisions,
      'web_src/root/two.html',
      lines(['---', 'permalink: /same/', '---', '<p>Two</p>']),
    );
    await expect(buildStaticSite({ root: collisions })).rejects.toThrow('output collision');

    const dynamic = createSite();
    write(dynamic, 'web_src/layouts/default.html', '{@include page.partial}{@content}\n');
    write(dynamic, 'web_src/root/index.html', '<p>Dynamic</p>\n');
    await expect(buildStaticSite({ root: dynamic })).rejects.toThrow(
      'path must be a quoted literal',
    );

    const unsafeTarget = createSite();
    write(unsafeTarget, 'fez-static.yaml', 'target_dir: ../outside\n');
    write(unsafeTarget, 'web_src/layouts/default.html', '{@content}\n');
    write(unsafeTarget, 'web_src/root/index.html', '<p>Unsafe</p>\n');
    await expect(buildStaticSite({ root: unsafeTarget })).rejects.toThrow(
      'target_dir must remain inside the project root',
    );

    const configuredDefault = createSite();
    write(configuredDefault, 'fez-static.yaml', 'default_layout: post\n');
    await expect(buildStaticSite({ root: configuredDefault })).rejects.toThrow(
      'default_layout is not configurable',
    );
  });

  test('runs through the published fez dispatcher', async () => {
    const initializedRoot = createSite();
    const initialized = Bun.spawnSync({
      cmd: [FEZ, 'static', 'init', initializedRoot],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(initialized.exitCode).toBe(0);
    expect(initialized.stdout.toString()).toContain('with 6 files');
    expect(fs.existsSync(path.join(initializedRoot, 'web_src/root/index.html'))).toBe(true);

    const root = createSite();
    write(root, 'web_src/layouts/default.html', '<main>{@content}</main>\n');
    write(root, 'web_src/root/index.md', '# CLI\n');

    const checked = Bun.spawnSync({
      cmd: [FEZ, 'static', 'doctor', root],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(checked.exitCode).toBe(0);
    expect(checked.stdout.toString()).toContain('Site is valid: 1 pages');
    expect(fs.existsSync(path.join(root, 'web_build'))).toBe(false);

    const result = Bun.spawnSync({
      cmd: [FEZ, 'static', 'build', root],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('Built 1 pages');
    expect(result.stdout.toString()).toContain('Run locally: fez static serve');
    expect(read(root, 'web_build/index.html')).toContain('<h1>CLI</h1>');

    const cleaned = Bun.spawnSync({
      cmd: [FEZ, 'static', 'clean', root],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(cleaned.exitCode).toBe(0);
    expect(cleaned.stdout.toString()).toContain('Removed ');
    expect(fs.existsSync(path.join(root, 'web_build'))).toBe(false);
  });

  test('serves and publishes live reload events in development mode', async () => {
    const root = createSite();
    write(
      root,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<!doctype html><body><p>Live</p></body>']),
    );
    await buildStaticSite({ root });

    const server = serveStaticSite({ root, port: '0', liveReload: true });
    let socket;
    try {
      const html = await (await fetch(server.url)).text();
      expect(html).toContain('<script src="/__fez_static/reload.js" defer></script>');
      const script = await (await fetch(new URL('/__fez_static/reload.js', server.url))).text();
      expect(script).toContain('new WebSocket');

      const socketUrl = new URL('/__fez_static/reload', server.url);
      socketUrl.protocol = 'ws:';
      socket = new WebSocket(socketUrl);
      await Promise.race([
        new Promise((resolve, reject) => {
          socket.addEventListener('open', resolve, { once: true });
          socket.addEventListener('error', reject, { once: true });
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('live reload socket timed out')), 3000),
        ),
      ]);

      const message = Promise.race([
        new Promise((resolve) =>
          socket.addEventListener('message', (event) => resolve(event.data), { once: true }),
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('live reload message timed out')), 3000),
        ),
      ]);
      reloadStaticSiteClients(server);
      expect(await message).toBe('reload');
    } finally {
      socket?.close();
      server.stop(true);
    }
  });

  test('watches configured copy sources outside the static root', async () => {
    const root = createSite();
    write(root, 'fez-static.yaml', 'copy:\n  "dist/main.js": "main.js"\n');
    write(
      root,
      'web_src/root/index.html',
      lines(['---', 'layout: false', '---', '<p>Watcher</p>']),
    );
    write(root, 'dist/main.js', 'window.version = 1;\n');

    let buildCount = 0;
    let resolveRebuild;
    const rebuilt = new Promise((resolve) => {
      resolveRebuild = resolve;
    });
    const watcher = await watchStaticSite(
      { root },
      {
        onBuild() {
          buildCount++;
          if (buildCount === 2) {
            resolveRebuild();
          }
        },
      },
    );

    try {
      expect(read(root, 'web_build/main.js')).toBe('window.version = 1;\n');
      await Bun.sleep(50);
      write(root, 'dist/main.js', 'window.version = 2;\n');
      await Promise.race([
        rebuilt,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('copied file rebuild timed out')), 3000),
        ),
      ]);
      expect(read(root, 'web_build/main.js')).toBe('window.version = 2;\n');
    } finally {
      watcher.close();
    }
  });

  test('watches source changes and serves clean URLs', async () => {
    const root = createSite();
    write(root, 'fez-static.yaml', lines(['site:', '  base_url: /preview']));
    write(root, 'web_src/layouts/default.html', '<main>{@content}</main>\n');
    write(root, 'web_src/root/index.md', lines(['---', 'permalink: /docs/', '---', '# First']));

    let buildCount = 0;
    let resolveRebuild;
    const rebuilt = new Promise((resolve) => {
      resolveRebuild = resolve;
    });
    const watcher = await watchStaticSite(
      { root },
      {
        onBuild() {
          buildCount++;
          if (buildCount === 2) {
            resolveRebuild();
          }
        },
      },
    );

    try {
      await Bun.sleep(50);
      write(root, 'web_src/root/index.md', lines(['---', 'permalink: /docs/', '---', '# Second']));
      await Promise.race([
        rebuilt,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('watch rebuild timed out')), 3000),
        ),
      ]);
      expect(read(root, 'web_build/docs/index.html')).toContain('<h1>Second</h1>');
    } finally {
      watcher.close();
    }

    const server = serveStaticSite({ root, port: '0' });
    try {
      const response = await fetch(new URL('/docs/', server.url));
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<h1>Second</h1>');
      expect((await fetch(new URL('/preview/docs/', server.url))).status).toBe(200);
      expect((await fetch(new URL('/missing', server.url))).status).toBe(404);
    } finally {
      server.stop(true);
    }
  });
});

function createSite() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-static-test-'));
  roots.push(root);
  return root;
}

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function lines(values) {
  return values.join('\n') + '\n';
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildStaticSite,
  cleanStaticSite,
  doctorStaticSite,
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
    write(root, 'fez-static/config.yaml', lines(['site:', '  title: Test Site']));
    write(
      root,
      'fez-static/layouts/default.html',
      lines([
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <!-- keep this comment -->',
        '    <title>{page.title} | {site.title}</title>',
        '    <script>window.config = { ready: true }</script>',
        '  </head>',
        '  <body>',
        '    {@include "header.html", { label: site.title }}',
        '    {@content}',
        '    <ul class="posts">',
        '    {#each collections.posts as post}',
        '      {@include "post-link.html", { post }}',
        '    {/each}',
        '    </ul>',
        '  </body>',
        '</html>',
      ]),
    );
    write(
      root,
      'fez-static/layouts/post.html',
      lines([
        '---',
        'layout: default',
        '---',
        '<article data-slug={page.slug}>',
        '  {@content}',
        '</article>',
      ]),
    );
    write(root, 'fez-static/parts/header.html', '<header>{include.label}</header>\n');
    write(
      root,
      'fez-static/parts/post-link.html',
      '<li><a href={include.post.url}>{include.post.title}</a></li>\n',
    );
    write(
      root,
      'fez-static/src/index.html',
      lines(['---', 'title: Home', '---', '<h1>{page.title}</h1>']),
    );
    write(
      root,
      'fez-static/src/blog/2026-08-20-older.md',
      lines([
        '---',
        'title: Older',
        'layout: post',
        'permalink: /notes/older/',
        '---',
        '# Older',
        '',
        'Literal {page.title} remains Markdown.',
      ]),
    );
    write(
      root,
      'fez-static/src/blog/2026-08-24-newer.md',
      lines(['---', 'title: Newer', 'layout: post', '---', '# Newer']),
    );
    write(
      root,
      'fez-static/src/blog/2026-08-25-draft.md',
      lines(['---', 'title: Draft', 'draft: true', '---', '# Draft']),
    );
    write(
      root,
      'fez-static/src/raw.html',
      lines([
        '---',
        'title: Raw',
        'layout: false',
        'permalink: /raw/',
        '---',
        '<p>{page.title}</p>',
      ]),
    );
    write(root, 'fez-static/src/assets/site.css', 'body { color: rebeccapurple; }\n');

    const result = await buildStaticSite({ root });

    expect(result.pages).toBe(4);
    expect(result.assets).toBe(1);
    expect(read(root, 'build/index.html')).toContain('<title>Home | Test Site</title>');
    expect(read(root, 'build/index.html')).toContain('<!-- keep this comment -->');
    expect(read(root, 'build/index.html')).toContain(
      '<script>window.config = { ready: true }</script>',
    );
    expect(read(root, 'build/index.html')).toContain('<header>Test Site</header>');
    expect(read(root, 'build/index.html')).not.toContain('fez-key');
    expect(read(root, 'build/notes/older/index.html')).toContain('data-slug="older"');
    expect(read(root, 'build/notes/older/index.html')).toContain(
      'Literal {page.title} remains Markdown.',
    );
    expect(read(root, 'build/raw/index.html')).toBe('<p>Raw</p>\n');
    expect(read(root, 'build/assets/site.css')).toBe('body { color: rebeccapurple; }\n');
    expect(fs.existsSync(path.join(root, 'build/blog/2026-08-25-draft.html'))).toBe(false);

    const index = read(root, 'build/index.html');
    expect(index.indexOf('Newer')).toBeLessThan(index.indexOf('Older'));
    expect(index).toContain('href="/notes/older/"');
    expect(index).not.toContain('href="/notes/older//"');

    const withDrafts = await buildStaticSite({ root, drafts: true });
    expect(withDrafts.pages).toBe(5);
    expect(fs.existsSync(path.join(root, 'build/blog/2026-08-25-draft.html'))).toBe(true);
  });

  test('expands relative and Markdown includes recursively', async () => {
    const root = createSite();
    write(root, 'fez-static/layouts/default.html', '<main>{@content}</main>\n');
    write(
      root,
      'fez-static/parts/outer.html',
      '<aside>{include.kind}{@include "./inner.md"}</aside>\n',
    );
    write(root, 'fez-static/parts/inner.md', '**Nested** include\n');
    write(
      root,
      'fez-static/src/index.md',
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

    const output = read(root, 'build/index.html');
    expect(output).toContain('<aside>note<p><strong>Nested</strong> include</p>');
    expect(output).not.toContain('{@include');
  });

  test('keeps the previous build when rendering fails', async () => {
    const root = createSite();
    write(root, 'build/stable.txt', 'previous build\n');
    write(root, 'fez-static/layouts/default.html', '<main>{missing.value}{@content}</main>\n');
    write(root, 'fez-static/src/index.html', '<h1>Broken</h1>\n');

    await expect(buildStaticSite({ root })).rejects.toThrow('template runtime error');

    expect(read(root, 'build/stable.txt')).toBe('previous build\n');
    expect(fs.readdirSync(root).some((name) => name.startsWith('.fez-static-stage-'))).toBe(false);
  });

  test('passes through explicitly unrendered HTML unchanged', async () => {
    const root = createSite();
    write(
      root,
      'fez-static/src/legacy.html',
      lines([
        '---',
        'layout: false',
        'render: false',
        '---',
        '<p>{page.title} {@include "missing.html"}</p>',
      ]),
    );

    await buildStaticSite({ root });

    expect(read(root, 'build/legacy.html')).toBe('<p>{page.title} {@include "missing.html"}</p>\n');
  });

  test('uses config target paths from the project root and validates without publishing', async () => {
    const root = createSite();
    write(
      root,
      'fez-static/config.yaml',
      lines(['target: public', 'site:', '  title: Configured Site']),
    );
    write(root, 'fez-static/layouts/default.html', '<title>{site.title}</title>{@content}\n');
    write(root, 'fez-static/src/index.md', '# Configured\n');
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

  test('rejects include cycles and paths outside the source', async () => {
    const cyclic = createSite();
    write(cyclic, 'fez-static/layouts/default.html', '{@include "a.html"}{@content}\n');
    write(cyclic, 'fez-static/parts/a.html', '{@include "./b.html"}\n');
    write(cyclic, 'fez-static/parts/b.html', '{@include "./a.html"}\n');
    write(cyclic, 'fez-static/src/index.html', '<p>Cycle</p>\n');

    await expect(buildStaticSite({ root: cyclic })).rejects.toThrow('Include cycle');

    const escaping = createSite();
    write(escaping, 'fez-static/layouts/default.html', '{@include "../secret.html"}{@content}\n');
    write(escaping, 'fez-static/src/index.html', '<p>Escape</p>\n');

    await expect(buildStaticSite({ root: escaping })).rejects.toThrow('Invalid static part path');
  });

  test('rejects layout cycles, output collisions, and dynamic include paths', async () => {
    const layouts = createSite();
    write(
      layouts,
      'fez-static/layouts/default.html',
      lines(['---', 'layout: second', '---', '{@content}']),
    );
    write(
      layouts,
      'fez-static/layouts/second.html',
      lines(['---', 'layout: default', '---', '{@content}']),
    );
    write(layouts, 'fez-static/src/index.html', '<p>Cycle</p>\n');
    await expect(buildStaticSite({ root: layouts })).rejects.toThrow('Layout cycle');

    const collisions = createSite();
    write(collisions, 'fez-static/layouts/default.html', '{@content}\n');
    write(collisions, 'fez-static/src/one.md', lines(['---', 'permalink: /same/', '---', '# One']));
    write(
      collisions,
      'fez-static/src/two.html',
      lines(['---', 'permalink: /same/', '---', '<p>Two</p>']),
    );
    await expect(buildStaticSite({ root: collisions })).rejects.toThrow('output collision');

    const dynamic = createSite();
    write(dynamic, 'fez-static/layouts/default.html', '{@include page.partial}{@content}\n');
    write(dynamic, 'fez-static/src/index.html', '<p>Dynamic</p>\n');
    await expect(buildStaticSite({ root: dynamic })).rejects.toThrow(
      'path must be a quoted literal',
    );

    const unsafeTarget = createSite();
    write(unsafeTarget, 'fez-static/config.yaml', 'target: ../outside\n');
    write(unsafeTarget, 'fez-static/layouts/default.html', '{@content}\n');
    write(unsafeTarget, 'fez-static/src/index.html', '<p>Unsafe</p>\n');
    await expect(buildStaticSite({ root: unsafeTarget })).rejects.toThrow(
      'target must remain inside the project root',
    );

    const configuredDefault = createSite();
    write(configuredDefault, 'fez-static/config.yaml', 'default_layout: post\n');
    await expect(buildStaticSite({ root: configuredDefault })).rejects.toThrow(
      'default_layout is not configurable',
    );
  });

  test('runs through the published fez dispatcher', async () => {
    const root = createSite();
    write(root, 'fez-static/layouts/default.html', '<main>{@content}</main>\n');
    write(root, 'fez-static/src/index.md', '# CLI\n');

    const checked = Bun.spawnSync({
      cmd: [FEZ, 'static', 'doctor', root],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(checked.exitCode).toBe(0);
    expect(checked.stdout.toString()).toContain('Site is valid: 1 pages');
    expect(fs.existsSync(path.join(root, 'build'))).toBe(false);

    const result = Bun.spawnSync({
      cmd: [FEZ, 'static', 'build', root],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('Built 1 pages');
    expect(read(root, 'build/index.html')).toContain('<h1>CLI</h1>');

    const cleaned = Bun.spawnSync({
      cmd: [FEZ, 'static', 'clean', root],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(cleaned.exitCode).toBe(0);
    expect(cleaned.stdout.toString()).toContain('Removed ');
    expect(fs.existsSync(path.join(root, 'build'))).toBe(false);
  });

  test('watches source changes and serves clean URLs', async () => {
    const root = createSite();
    write(root, 'fez-static/layouts/default.html', '<main>{@content}</main>\n');
    write(root, 'fez-static/src/index.md', lines(['---', 'permalink: /docs/', '---', '# First']));

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
          if (buildCount === 2) resolveRebuild();
        },
      },
    );

    try {
      await Bun.sleep(50);
      write(
        root,
        'fez-static/src/index.md',
        lines(['---', 'permalink: /docs/', '---', '# Second']),
      );
      await Promise.race([
        rebuilt,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('watch rebuild timed out')), 3000),
        ),
      ]);
      expect(read(root, 'build/docs/index.html')).toContain('<h1>Second</h1>');
    } finally {
      watcher.close();
    }

    const server = serveStaticSite({ root, port: '0' });
    try {
      const response = await fetch(new URL('/docs/', server.url));
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<h1>Second</h1>');
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

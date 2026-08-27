import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { Glob } from 'bun';
import { doctorStaticSite } from '../src/static.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

const loadEntries = async () => {
  const entries = [];

  for await (const path of new Glob('fez-static/root/*/*.md').scan('.')) {
    if (!path.startsWith('fez-static/root/[changelog]/')) continue;
    if (path.includes('.tmp.')) continue;

    const text = await Bun.file(path).text();
    const match = text.match(FRONTMATTER);
    expect(match, `${path} must start with YAML frontmatter`).not.toBeNull();

    const frontmatter = Bun.YAML.parse(match[1]);
    entries.push({
      path,
      text,
      data: { ...frontmatter, file: path.replace('fez-static/root/[changelog]/', '') },
    });
  }

  return entries.sort((a, b) => b.data.date.localeCompare(a.data.date));
};

describe('changelog entries', () => {
  test('use parseable, complete frontmatter', async () => {
    const entries = await loadEntries();
    const slugs = new Set();

    expect(entries).toHaveLength(27);

    for (const { path, data } of entries) {
      expect(data.title).toBeString();
      expect(data.description).toBeString();
      expect(data.description.endsWith('.')).toBeTrue();
      expect(data.description.split(/\s+/).length).toBeLessThanOrEqual(24);
      expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(data.author).toBe('Dino Reic');
      expect(data.authors).toEqual([{ name: 'Dino Reic', url: 'https://github.com/dux' }]);
      expect(data.tags.length).toBeGreaterThanOrEqual(2);
      expect(data.commits.length).toBeGreaterThanOrEqual(1);
      expect(data.commits.every((commit) => /^[0-9a-f]{7,40}$/.test(commit))).toBeTrue();
      expect(path.split('/').pop().startsWith(`${data.date}-`)).toBeTrue();

      if (data.image) {
        expect(data.image).toMatch(/^assets\/[a-z0-9-]+\.webp$/);
        expect(data.image_alt).toBeString();
        expect(data.image_alt.length).toBeGreaterThan(20);
        expect(await Bun.file(`fez-static/root/[changelog]/${data.image}`).exists()).toBeTrue();
      } else {
        expect(data.image_alt).toBeUndefined();
      }

      expect(slugs.has(data.slug), `duplicate slug: ${data.slug}`).toBeFalse();
      slugs.add(data.slug);
    }
  });

  test('keep selected image assets referenced without orphans', async () => {
    const entries = await loadEntries();
    const referenced = entries
      .filter(({ data }) => data.image)
      .map(({ data }) => data.image)
      .sort();
    const assets = [];

    for await (const path of new Glob('fez-static/root/*/assets/*.webp').scan('.')) {
      if (!path.startsWith('fez-static/root/[changelog]/')) continue;
      if (path.includes('.tmp.')) continue;
      assets.push(path.replace('fez-static/root/[changelog]/', ''));
    }

    expect(referenced).toHaveLength(6);
    expect(assets.sort()).toEqual(referenced);
  });

  test('keep a working example in every entry', async () => {
    const entries = await loadEntries();

    for (const { path, text } of entries) {
      const prose = text
        .replace(FRONTMATTER, '')
        .replace(/```[\s\S]*?```/g, '')
        .trim();
      expect(text, `${path} must not keep essay copy`).not.toContain('## Working example');
      expect(prose, `${path} must keep prose in the short description`).toBe('');
      expect(text, `${path} must include a working example`).toMatch(/```(?:html|bash)\r?\n/);
    }
  });

  test('maintain the planned milestone cadence', async () => {
    const entries = await loadEntries();
    const counts = entries.reduce((result, { data }) => {
      const year = data.date.slice(0, 4);
      result[year] = (result[year] || 0) + 1;
      return result;
    }, {});

    expect(counts).toEqual({ 2024: 7, 2025: 10, 2026: 10 });
  });

  test('leave collection indexes to the static builder', async () => {
    expect(await Bun.file('fez-static/root/[changelog]/index.json').exists()).toBeFalse();
    expect(await Bun.file('fez-static/root/[changelog]/index.yaml').exists()).toBeFalse();
  });
});

describe('changelog demo', () => {
  test('links the changelog and features without the old benchmark entry', async () => {
    const site = await Bun.file('fez-static/root/site.fez').text();
    const page = await Bun.file('fez-static/root/changelog.html').text();
    const layout = await Bun.file('fez-static/layouts/default.html').text();
    const output = await Bun.file('demo/changelog/index.html').text();
    const post = await Bun.file(
      'demo/changelog/2026-08-22-fez-0-6-typed-props-and-motion.html',
    ).text();
    const css = await Bun.file('fez-static/root/css/site.css').text();
    const control = await Bun.file('fez-static/root/fez/fez-control.fez').text();
    const config = Bun.YAML.parse(await Bun.file('fez-static/config.yaml').text());

    expect(site).toContain("label: 'Changelog'");
    expect(config.site.fez_url).toBe('fez.min.js');
    expect(config.site.components).toContain('/fez/fez-control.fez');
    expect(config.copy['../dist/fez.min.js']).toBe('fez.min.js');
    expect(config.copy['../dist/fez.min.js.map']).toBe('fez.min.js.map');
    expect(config.collections.changelog.required).toEqual(['title', 'description', 'date']);
    expect(config.site.base_url).toBeUndefined();
    expect(config.serve_root).toBeUndefined();
    expect(config.serve_prefix).toBeUndefined();
    expect(site).toContain('<a href="features.html">Features</a>');
    expect(site).toContain('<a href="changelog/">Changelog</a>');
    expect(output).toContain('href="');
    expect(post).toContain('<main id="pjax" class="pjax site-wrap site-text site-md">');
    expect(post).not.toContain('class="pjax site-wrap site-docs site-md"');
    expect(post).toContain('<script fez="fez/fez-control.fez"></script>');
    expect(css).toContain('body.site .site-md pre code {');
    expect(control).toContain('GLOBAL = true');
    expect(control).toContain('pre code[class*="language-"]:not(.hljs)');
    expect(layout).toContain('<base href={page.base}>');
    expect(site).not.toContain("name: 'blogs'");
    expect(site).not.toContain('Benchmark');
    expect(page).toContain('permalink: /changelog/');
    expect(page).toContain('collections.changelog');
    expect(page).toContain('{@html entry.content}');
    expect(page).toContain('class="changelog-image"');
    expect(page).toContain('loading="lazy"');
    expect(layout).toContain('class="article-hero"');
    expect(layout).toContain('<h1>{page.title}</h1>');
    expect(layout).toContain('<p class="article-summary">{page.description}</p>');
    expect(layout).toContain("href={url('/changelog/')}");
    expect(layout).toContain('Back to changelog');
    expect(layout).not.toContain('href={url(\'/changelog/\')} class="no-pjax"');
    expect(await Bun.file('demo/blog.html').exists()).toBeFalse();
    expect(await Bun.file('fez-static/root/blog.html').exists()).toBeFalse();
    expect(output.match(/class="changelog-row/g)).toHaveLength(27);
    expect(output.match(/class="changelog-image"/g)).toHaveLength(6);
    expect(output.match(/<pre/g).length).toBeGreaterThanOrEqual(27);
    expect(output).toContain('PROPS');
    expect(output).toContain('fez compile');
    expect(output).not.toContain('collections.changelog');
    expect(output).not.toContain('post-card');
    expect(await Bun.file('fez-static/root/fez/site-blog.fez').exists()).toBeFalse();
  });

  test('doctor accepts the relocatable demo site', async () => {
    await expect(doctorStaticSite({ root: process.cwd() })).resolves.toMatchObject({
      outputDir: path.join(process.cwd(), 'demo'),
    });
  });
});

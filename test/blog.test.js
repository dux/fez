import { describe, expect, test } from "bun:test";
import { Glob } from "bun";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

const loadPosts = async () => {
  const posts = [];

  for await (const path of new Glob("blogs/*.md").scan(".")) {
    if (path.includes(".tmp.")) continue;

    const text = await Bun.file(path).text();
    const match = text.match(FRONTMATTER);
    expect(match, `${path} must start with YAML frontmatter`).not.toBeNull();

    const frontmatter = Bun.YAML.parse(match[1]);
    posts.push({
      path,
      text,
      data: { ...frontmatter, file: path.replace("blogs/", "") },
    });
  }

  return posts.sort((a, b) => b.data.date.localeCompare(a.data.date));
};

describe("blog posts", () => {
  test("use parseable, complete frontmatter", async () => {
    const posts = await loadPosts();
    const slugs = new Set();

    expect(posts).toHaveLength(27);

    for (const { path, data } of posts) {
      expect(data.title).toBeString();
      expect(data.description).toBeString();
      expect(data.description.endsWith(".")).toBeTrue();
      expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(data.author).toBe("Dino Reic");
      expect(data.authors).toEqual([
        { name: "Dino Reic", url: "https://github.com/dux" },
      ]);
      expect(data.tags.length).toBeGreaterThanOrEqual(2);
      expect(data.commits.length).toBeGreaterThanOrEqual(1);
      expect(data.commits.every((commit) => /^[0-9a-f]{7,40}$/.test(commit))).toBeTrue();
      expect(path.split("/").pop().startsWith(`${data.date}-`)).toBeTrue();

      if (data.image) {
        expect(data.image).toMatch(/^assets\/[a-z0-9-]+\.webp$/);
        expect(data.image_alt).toBeString();
        expect(data.image_alt.length).toBeGreaterThan(20);
        expect(await Bun.file(`blogs/${data.image}`).exists()).toBeTrue();
      } else {
        expect(data.image_alt).toBeUndefined();
      }

      expect(slugs.has(data.slug), `duplicate slug: ${data.slug}`).toBeFalse();
      slugs.add(data.slug);
    }
  });

  test("keep selected image assets referenced without orphans", async () => {
    const posts = await loadPosts();
    const referenced = posts
      .filter(({ data }) => data.image)
      .map(({ data }) => data.image)
      .sort();
    const assets = [];

    for await (const path of new Glob("blogs/assets/*.webp").scan(".")) {
      if (path.includes(".tmp.")) continue;
      assets.push(path.replace("blogs/", ""));
    }

    expect(referenced).toHaveLength(6);
    expect(assets.sort()).toEqual(referenced);
  });

  test("keep a working example in every article", async () => {
    const posts = await loadPosts();

    for (const { path, text, data } of posts) {
      expect(text).toContain(`# ${data.title}`);
      expect(text, `${path} must include a working example`).toMatch(
        /## Working example\r?\n\r?\n[\s\S]*?```/,
      );
    }
  });

  test("maintain the planned milestone cadence", async () => {
    const posts = await loadPosts();
    const counts = posts.reduce((result, { data }) => {
      const year = data.date.slice(0, 4);
      result[year] = (result[year] || 0) + 1;
      return result;
    }, {});

    expect(counts).toEqual({ 2024: 7, 2025: 10, 2026: 10 });
  });

  test("keep index.json synchronized with frontmatter", async () => {
    const posts = await loadPosts();
    const index = await Bun.file("blogs/index.json").json();

    expect(index).toEqual(posts.map(({ data }) => data));
  });
});

describe("blog demo", () => {
  test("links the blog and features without the old benchmark entry", async () => {
    const site = await Bun.file("demo/site.fez").text();
    const page = await Bun.file("demo/blog.html").text();
    const blog = await Bun.file("demo/fez/site-blog.fez").text();

    expect(site).toContain("label: 'Blog'");
    expect(site).toContain('<a href="./features.html">Features</a>');
    expect(site).toContain('<a href="./blog.html" class="no-pjax">Blog</a>');
    expect(site).not.toContain("Benchmark");
    expect(page).toContain("<site-blog></site-blog>");
    expect(blog).toContain('class="post-card-image"');
    expect(blog).toContain('loading="lazy"');
    expect(blog).toContain('class="article-hero"');
  });
});

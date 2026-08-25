---
title: Fez Static
description: Build Markdown and HTML sites with Fez templates.
---

# Fez Static

This page is generated from Markdown, wrapped in `layouts/default.html`, and written to the configured `demo` target.
Pages and browser assets live under `fez-static/root`, which mirrors the public site.

Shared build-time fragments use the Fez-native include directive:

```html
{@include "head.html"}
```

A bracketed directory declares a collection.
For example, `root/[blogs]/` is available to templates as `collections.blogs`, publishes under `blogs/`, and produces `blogs/index.yaml` during the build.

Start a new site with one page, two Markdown posts, navigation, and a footer:

```bash
fez static init
```

## Base-aware URLs

Set `site.base_url` when the generated site is hosted below the domain root.
Use `url(path)` for assets and navigation, or use the base-aware `page.href` attached to every page and collection entry.

```html
<a href={url("/")}>Home</a>
<a href={page.href}>{page.title}</a>
<script src={url("/assets/app.js")}></script>
```

## Copy external build artifacts

The `copy` map brings files or directory trees from outside `fez-static/root` into the generated target.
Sources resolve from `fez-static`, destinations resolve inside the target, and copied files remain unchanged.

```yaml
copy:
  "../dist/main.min.js": "./assets/main.min.js"
  "../public": "./vendor"
```

## Validate before publishing

`fez static doctor` renders without replacing the target and checks required metadata, internal links, fragments, referenced assets, and `base_url` usage.
Collection requirements live beside the collection layout configuration.

```yaml
collections:
  blogs:
    layout: post
    required: [title, description, date]
```

Use `data-fez-static-ignore` on an intentional client-side link that has no generated target.

## Develop with reload

`fez static dev` watches the site and configured copy sources, serves the target, and reloads connected browser pages after each successful build.

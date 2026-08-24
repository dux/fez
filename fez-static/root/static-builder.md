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

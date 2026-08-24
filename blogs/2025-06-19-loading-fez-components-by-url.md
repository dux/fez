---
title: "A Fez component became loadable by URL"
description: "URL loading made a .fez file a portable component artifact that a page can consume without a local build pipeline."
date: "2025-06-19"
slug: "loading-fez-components-by-url"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "loader"
  - "cdn"
  - "components"
commits:
  - "49f1e8e"
  - "eccf09a"
---

# A Fez component became loadable by URL

The `.fez` format was designed to keep a component in one place, but it still needed a simple delivery mechanism.
In June 2025, the loader learned to fetch and compile a component directly from a URL.

That made the file itself the unit of distribution.
A Rails view, a static page, or a small server-rendered application could add one component without adopting the repository structure or build tool that produced it.

There are obvious limits to remote code.
The URL must be trusted, CORS must allow the request, and production systems should pin a version they control.
Convenience does not change the security model of executing JavaScript.

Within those boundaries, URL loading is a powerful way to keep adoption incremental.
A team can try one component on one page and move it local only when that becomes useful.

## Working example

The `fez` attribute belongs on a normal script tag.

```html
<script src="https://raw.githubusercontent.com/dux/fez/main/dist/fez.js"></script>

<script fez="https://raw.githubusercontent.com/dux/fez/main/demo/fez/ui-counter.fez"></script>

<ui-counter start="2"></ui-counter>
```

Fez fetches the component source from the repository, compiles it, registers `ui-counter`, and lets the existing tag connect.
No bundler participates in that path.

The same syntax works with local relative URLs, which remains the usual choice for application-owned components.
The important part is that delivery is explicit and uses the web's existing address space.

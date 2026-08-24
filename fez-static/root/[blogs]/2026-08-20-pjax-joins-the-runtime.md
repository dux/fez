---
title: "Pjax joined the Fez runtime"
description: "Bundling the former dux-pjax package connected server-rendered navigation with Fez's component-aware DOM morphing."
date: "2026-08-20"
slug: "pjax-joins-the-runtime"
image: "assets/2026-08-20-pjax-navigation.webp"
image_alt: "Server-rendered page panels moving along a continuous red navigation route."
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "pjax"
  - "navigation"
  - "server-rendering"
commits:
  - "89a6912"
  - "9dfb989"
  - "e0ee17f"
---

# Pjax joined the Fez runtime

Fez components had always been comfortable on server-rendered pages.
The missing piece was navigation that could keep those components alive while the server remained responsible for producing each destination.

In August 2026, I ported the former `dux-pjax` package into Fez and exposed it as `window.Pjax`.
Pjax fetches the next HTML document, extracts the active container, and swaps it through `Fez.nodeMorph` instead of replacing the whole browser page.

The feature is gated by markup.
`window.Pjax` is available whenever Fez loads, but link, form, and popstate handlers start only when the page contains a `<pjax>` tag or `.pjax` container with an id.
Pages that do not opt in retain native navigation.

This is an important boundary.
Fez does not silently convert a website into a single-page application.
The document chooses where progressive navigation applies.

## Working example

Use the same container id on every server-rendered destination.

```html
<nav><a href="/account">Account</a></nav>

<main id="content" class="pjax">
  <h1>Account</h1>
  <a href="/account/billing">Billing</a>
</main>
```

A component outside the swapped container can follow navigation explicitly.

```html
<script>
  class {
    init() {
      this.state.path = location.pathname
    }

    onMount() {
      this.on('pjax:render', (event) => {
        this.state.path = new URL(event.detail.to, location.href).pathname
      })
    }
  }
</script>

<span>Current page: {state.path}</span>
```

The server still renders `/account/billing` as a complete page for direct visits, crawlers, and ordinary browser fallback.
During an opted-in navigation, Fez morphs only `#content`, preserves compatible components, updates history, and emits structured lifecycle events.

This is the kind of single-page behavior I want: progressive, server-compatible, and invited by the HTML.

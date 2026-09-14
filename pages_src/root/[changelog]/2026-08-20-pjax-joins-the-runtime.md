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

```html
<nav><a href="/account">Account</a></nav>

<main id="content" class="pjax">
  <h1>Account</h1>
  <a href="/account/billing">Billing</a>
</main>
```

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

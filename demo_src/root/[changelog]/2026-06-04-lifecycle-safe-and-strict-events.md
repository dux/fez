---
title: "Events became lifecycle-safe and optionally strict"
description: "this.on centralized listener cleanup, and strict event attributes made target-only interactions concise and reliable."
date: "2026-06-04"
slug: "lifecycle-safe-and-strict-events"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "events"
  - "lifecycle"
  - "templates"
commits:
  - "8c2aed6"
  - "c9dc412"
  - "f75a007"
---

```html
<script>
  class {
    init() {
      this.state.open = false
      this.state.path = location.pathname
    }

    onMount() {
      this.on('pjax:render', (event) => {
        this.state.path = new URL(event.detail.to, location.href).pathname
      })
    }

    open() {
      this.state.open = true
    }

    close() {
      this.state.open = false
    }
  }
</script>

<button onclick="fez.open()">Show current path</button>

{#if state.open}
  <div class="overlay" onclick!="fez.close()">
    <section>
      <p>{state.path}</p>
      <button onclick="fez.close()">Close</button>
    </section>
  </div>
{/if}
```

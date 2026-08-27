---
title: "Global components and Fez.fetch covered page-level services"
description: "Singleton components and a cached request helper made dialogs, data panels, and other page-level services straightforward."
date: "2025-07-23"
slug: "global-components-and-fez-fetch"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "singleton"
  - "fetch"
  - "services"
commits:
  - "1695082"
  - "43ecdcf"
---

```html
<script>
  class {
    GLOBAL = 'BuildStatus'

    init() {
      this.state.build = Fez.fetch('/api/build-status')
    }

    reload() {
      Fez.clearFetchCache()
      this.state.build = Fez.fetch('/api/build-status')
    }
  }
</script>

{#await state.build}
  <p>Checking build...</p>
{:then build}
  <p>Build {build.id}: {build.status}</p>
{:catch error}
  <p>Could not load status: {error.message}</p>
{/await}

<button onclick="fez.reload()">Reload</button>
```

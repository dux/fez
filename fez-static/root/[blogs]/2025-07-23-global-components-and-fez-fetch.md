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

# Global components and Fez.fetch covered page-level services

Some interface elements are components but do not belong to a particular template location.
A dialog host, toast region, image preview, or command palette should exist once and listen for work from the whole page.

In July 2025, Fez added a global component mode and the `Fez.fetch()` request helper.
Together they covered a useful class of page-level services without requiring an application root.

`GLOBAL = true` appends one instance to the body.
A string value also exposes that instance on `window` for imperative APIs such as `Dialog.open()`.

`Fez.fetch()` wraps browser fetch with automatic text or JSON parsing, a bounded GET cache, and concurrent GET deduplication.
It does not try to become a data framework.
It handles the repetitive part of a small request while returning a normal promise.

## Working example

This global status component loads once even though no page template contains its tag.

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

Loading the component file is enough to create the singleton.
Other code can call `BuildStatus.reload()` because the `GLOBAL` value supplied that window name.

I reserve globals for genuinely page-wide services.
Ordinary reusable components remain explicit tags because visible ownership is easier to understand.

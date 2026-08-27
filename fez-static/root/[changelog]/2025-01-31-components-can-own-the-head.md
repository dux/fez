---
title: "A component can declare what it needs in the document head"
description: "Fez.head made external CSS, scripts, and import maps part of the component module instead of hidden page setup."
date: "2025-01-31"
slug: "components-can-own-the-head"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "dependencies"
  - "head"
  - "modules"
commits:
  - "a151c17"
  - "c624e73"
---

```html
<script>
  Fez.head({
    importmap: {
      'nanoid': 'https://esm.sh/nanoid@5',
    },
  })

  Fez.head({
    css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  })

  import { nanoid } from 'nanoid'

  class {
    init() {
      this.state.document_id = nanoid()
    }
  }
</script>

<p><i class="fa-solid fa-file"></i> Document: <code>{state.document_id}</code></p>
```

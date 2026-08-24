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

# A component can declare what it needs in the document head

Reusable components often arrive with an awkward second set of instructions.
Copy this tag into the page head, load this stylesheet first, and make sure another version of the same library is not already present.

At the end of January 2025, I added `Fez.head()` so those requirements could live beside the component that owns them.
The runtime deduplicates the resulting head entries, which means multiple instances do not multiply the same stylesheet or import map.

Dependency declarations belong at module level, before the component class.
They are evaluated when the `.fez` module loads, while instance lifecycle stays inside the class.
That distinction keeps shared setup from running once per tag.

This was also early groundwork for component blocks and import support.
A `.fez` file was becoming more than a template fragment.
It was becoming the complete delivery unit for one piece of interface.

## Working example

This editor component declares an import map and external theme before importing its module.

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

The class remains the final item in the script block.
Imports and `Fez.head()` calls stay above it because they belong to the shared module, not to an individual component instance.

This arrangement makes a component honest about its dependencies.
Opening one file is enough to see both what it renders and what it asks the page to load.

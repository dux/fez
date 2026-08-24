---
title: "ES modules moved inside the component file"
description: "Module-context imports let a .fez file declare external behavior without a second bootstrap script."
date: "2025-07-27"
slug: "es-modules-inside-fez-components"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "modules"
  - "imports"
  - "dependencies"
commits:
  - "b80c8c6"
  - "82ef3b6"
---

# ES modules moved inside the component file

A one-file component is not really one file if every useful dependency requires a separate page script.
In July 2025, the Fez compiler gained module context and import support inside `.fez` files.

The script block now has a deliberate two-zone structure.
Imports, import maps, shared constants, and `Fez.head()` calls live before the class.
The component class comes last and contains per-instance behavior.

This mirrors the lifetime of the code.
A module import should happen once when the component definition loads.
An editor or chart instance should be created for each mounted component and cleaned up when that instance is destroyed.

Keeping both zones visible in one file makes dependency ownership clear without bundling everything into a single lifecycle method.

## Working example

This component imports a date formatter once and uses it from each instance.

```html
<script>
  Fez.head({
    importmap: {
      'date-fns': 'https://esm.sh/date-fns@4',
    },
  })

  import { formatDistanceToNow } from 'date-fns'

  class {
    PROPS = {
      since: { type: Date, required: true },
    }

    init() {
      this.state.distance = ''
    }

    beforeRender() {
      this.state.distance = formatDistanceToNow(this.props.since, {
        addSuffix: true,
      })
    }
  }
</script>

<time datetime={props.since.toISOString()}>{state.distance}</time>
```

```html
<relative-time since="2025-07-27T12:00:00Z"></relative-time>
```

The import map prevents dependency URLs from leaking into every import statement.
The class stays last, which lets the compiler separate module work from component definition reliably.

External libraries remain optional.
When one is the right tool, the component can now be honest and self-contained about using it.

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

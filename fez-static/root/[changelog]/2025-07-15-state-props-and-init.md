---
title: "State, props, and init became the component vocabulary"
description: "Fez simplified template access and settled on init as the lifecycle entry point for instance state."
date: "2025-07-15"
slug: "state-props-and-init"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "state"
  - "props"
  - "lifecycle"
commits:
  - "c1bfd3a"
  - "f9e2ee2"
---

```html
<script>
  class {
    PROPS = {
      label: { type: String, default: 'Count' },
      start: { type: Number, default: 0 },
    }

    init(props) {
      this.state.count = props.start
    }

    increment() {
      this.state.count++
    }
  }
</script>

<button onclick="fez.increment()">
  {props.label}: {state.count}
</button>
```

```html
<score-counter label="Points" start="10"></score-counter>
```

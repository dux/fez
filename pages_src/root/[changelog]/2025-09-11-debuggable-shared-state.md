---
title: "Shared state stayed observable and debuggable"
description: "Global pub/sub, state subscriptions, dump helpers, and CSS mixins expanded coordination without hiding it behind a store framework."
date: "2025-09-11"
slug: "debuggable-shared-state"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "global-state"
  - "debugging"
  - "pub-sub"
commits:
  - "7d34c82"
  - "3963e45"
  - "658cd15"
---

```html
<!-- theme-toggle.fez -->
<script>
  class {
    init() {
      this.state.dark = Boolean(Fez.state.get('dark'))
    }

    toggle() {
      this.state.dark = !this.state.dark
      Fez.state.set('dark', this.state.dark)
      document.documentElement.classList.toggle('dark', this.state.dark)
    }
  }
</script>

<button onclick="fez.toggle()">
  Use {state.dark ? 'light' : 'dark'} theme
</button>
```

```html
<theme-toggle></theme-toggle>
<p>Dark mode: <fez-inline>{globalState.dark ? 'on' : 'off'}</fez-inline></p>

<script>
  Fez.state.subscribe('dark', (value, oldValue) => {
    console.log('dark changed', { oldValue, value })
  })
</script>
```

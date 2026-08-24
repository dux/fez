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

# Shared state stayed observable and debuggable

Shared state becomes dangerous when it is easy to change and difficult to observe.
The solution is not necessarily a larger state framework.
Often it is a small API with clear notifications and good inspection.

During August and September 2025, Fez added dump and mixin utilities and completed global pub/sub behavior with tests.
Global state could notify one key or all keys, while components that read a key could react on the next render frame.

I wanted cross-page values such as theme, current account, or cart count to remain ordinary named data.
Subscribers receive the key, new value, and old value.
That makes logging and diagnosis possible without instrumenting every writer separately.

The same philosophy applies to `Fez.dump()` and CSS mixins.
Small shared mechanisms should expose what they are doing instead of creating a hidden subsystem.

## Working example

One component writes a global value, and an inline template reads it without requiring another component file.

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

The component owns the interaction.
The document class owns the CSS switch.
Global state carries the shared fact, and the subscription leaves an obvious observation point.

Shared state should be used sparingly, but sparingly does not mean mysteriously.

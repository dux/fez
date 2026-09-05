---
title: "Fez 0.7 keeps one store per instance"
description: "this.local is gone: this.state is read-tracked, so a write re-renders only when the last render read that key, and fez:this refs land in state."
date: "2026-09-04"
slug: "fez-0-7-one-state-store"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "release"
  - "state"
  - "cli"
commits:
  - "5470ddb"
  - "c3b494a"
  - "c84a42d"
  - "0a843c5"
---

```html
<script>
  class {
    PROPS = {
      on_pick: { type: Function, state: true, default: () => {} },
    }

    init() {
      this.state.count = 0     // rendered below: a write re-renders
      this.state.ticks = 0     // never rendered: writes are free
    }

    onMount() {
      this.state.chart = new Chart(this.state.canvas)
      this.setInterval(() => this.state.ticks++, 100)
    }

    onDestroy() {
      this.state.chart.destroy()
    }
  }
</script>

<canvas fez:this="canvas"></canvas>
<button onclick="fez.state.count++">{state.count}</button>
```

Breaking changes:

* `this.local` is removed. Everything the instance owns goes in `this.state`; each render records the keys it read and a write to any other key schedules nothing.
* `fez:this="name"` lands on `this.state.name`, written silently on every render, instead of on the instance.
* `Fez.css()` is removed, use `Fez.cssClass()`.
* `GLOBAL` only names the window handle; `MOUNT = true` is the auto-mount.

Also new: `this.noChangeStateTrigger(fn)` for bulk writes that must not paint, `PROPS` entries of `type: Function` accept string handlers, and literal `[]` / `{}` defaults are copied per instance.
`fez compile` reports the removed APIs and `fez refactor` flags `FAST`, `GLOBAL` without `MOUNT`, and redundant ref lookups.

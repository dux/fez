---
title: "Events became lifecycle-safe and optionally strict"
description: "this.on centralized listener cleanup, and strict event attributes made target-only interactions concise and reliable."
date: "2026-06-04"
slug: "lifecycle-safe-and-strict-events"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "events"
  - "lifecycle"
  - "templates"
commits:
  - "8c2aed6"
  - "c9dc412"
  - "f75a007"
---

# Events became lifecycle-safe and optionally strict

Event listeners are easy to add and easy to leak.
A component that listens on `document`, `window`, or another long-lived node must remove that exact handler when it disconnects.

The May 2026 work strengthened `this.on()` so it binds the instance, guards disconnected components, supports throttling, and removes listeners automatically during destruction.
`onRefresh` also gave preserved child components a lifecycle point when a parent re-rendered around them.

In June, strict event attributes added a different kind of precision.
Appending `!` to an event attribute makes the handler run only when the element itself is the event target, then stops propagation and prevents the default action.

This is particularly useful for overlays and interactive cards, where a child click should not trigger the parent's action.

## Working example

The component listens for an external pjax event safely and closes only when the overlay itself is clicked.

```html
<script>
  class {
    init() {
      this.state.open = false
      this.state.path = location.pathname
    }

    onMount() {
      this.on('pjax:render', (event) => {
        this.state.path = new URL(event.detail.to, location.href).pathname
      })
    }

    open() {
      this.state.open = true
    }

    close() {
      this.state.open = false
    }
  }
</script>

<button onclick="fez.open()">Show current path</button>

{#if state.open}
  <div class="overlay" onclick!="fez.close()">
    <section>
      <p>{state.path}</p>
      <button onclick="fez.close()">Close</button>
    </section>
  </div>
{/if}
```

Clicking the section or its button does not count as clicking the overlay itself.
The pjax listener needs no matching `removeEventListener` in `onDestroy()` because `this.on()` owns that cleanup.

Event correctness is mostly lifecycle and targeting discipline.
These APIs put both disciplines close to the code that declares the event.

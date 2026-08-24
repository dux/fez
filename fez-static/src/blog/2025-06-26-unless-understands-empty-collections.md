---
title: "Unless understands empty collections"
description: "Fez added a practical empty-state block whose truthiness rules match the way interface data is actually shaped."
date: "2025-06-26"
slug: "unless-understands-empty-collections"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "templates"
  - "empty-states"
  - "collections"
commits:
  - "e04f498"
---

# Unless understands empty collections

Empty states are common enough that their syntax should not fight the data model.
JavaScript considers `[]` and `{}` truthy, but an interface usually considers them empty.

In June 2025, Fez added `unless` and defined collection-aware truthiness for its template blocks.
An empty array, an empty object, `null`, `undefined`, `false`, `0`, and an empty string all take the empty branch.

This is intentionally a template rule rather than a change to JavaScript itself.
Inside methods, ordinary JavaScript semantics still apply.
Inside a rendering condition, Fez answers the more useful UI question: is there anything to show?

The rule also applies consistently to `if` and `else if` blocks.
Consistency matters more than the particular spelling because it prevents every component from inventing its own `items && items.length` guard.

## Working example

The fallback renders for `[]` without an extra length check.

```html
<script>
  class {
    init() {
      this.state.notifications = []
    }

    add() {
      this.state.notifications.push({
        id: Date.now(),
        text: 'Build completed',
      })
    }
  }
</script>

<button onclick="fez.add()">Add notification</button>

{#unless state.notifications}
  <p>You are all caught up.</p>
{/unless}

{#each state.notifications as notification}
  <p key={notification.id}>{notification.text}</p>
{/each}
```

Before the first click, the array is present but empty, so the empty-state message appears.
After the push, deep state reactivity schedules a render and the notification replaces it.

Small template semantics like this rarely headline a framework release.
They do, however, determine whether everyday component code stays readable after the demo is over.

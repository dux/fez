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

# State, props, and init became the component vocabulary

Framework APIs accumulate accidental terminology quickly.
By July 2025, Fez had enough real components to show which names were helping and which were only historical residue.

I made `state` and `props` direct template values and renamed the connection hook to `init()`.
Those names describe the work rather than the implementation event.

`props` are inputs supplied by the caller.
`state` is data owned by the instance that should schedule rendering when it changes.
`init()` is where instance state is established before the first template render.

Keeping these roles distinct prevents a common bug: copying a prop into state merely to display it.
Props already update when a parent re-renders.
A copied value becomes stale unless the component adds synchronization code it did not otherwise need.

## Working example

The label remains a prop while only the count is local state.

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

The `PROPS` schema shown here arrived later, but it reinforces the boundary established in 2025.
`start` seeds owned state once.
`label` remains reactive caller input and is read directly from `props`.

Good lifecycle naming does not make a component correct by itself.
It makes the correct ownership model easier to see during implementation and review.

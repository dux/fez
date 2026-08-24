---
title: "Rendering became component-aware DOM morphing"
description: "Fez moved from replacing HTML to morphing it, preserving useful browser and component state across renders."
date: "2024-07-08"
slug: "component-aware-dom-morphing"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "rendering"
  - "dom-morphing"
  - "identity"
commits:
  - "2ca74e8"
---

# Rendering became component-aware DOM morphing

The first renderer could produce HTML, but producing HTML is the easy half of a component runtime.
The difficult half is applying the next result without erasing everything the browser and nested components already know.

On July 8, Fez adopted DOM morphing.
Instead of assigning a fresh `innerHTML` tree after every state change, it compared the rendered result with the live DOM and changed only what differed.

That distinction matters immediately for focus, selection, media, nested component instances, and event-driven state.
A node is not just serialized markup after it has spent time in the browser.
It has identity.

The first implementation used an external morphing library.
Fez later replaced it with its own component-aware differ, but the product rule stayed the same: rendering should reconcile the page, not reset it.

## Working example

Stable keys tell the differ which item is which while the array changes.

```html
<script>
  class {
    init() {
      this.state.next_id = 3
      this.state.items = [
        { id: 1, name: 'HTML' },
        { id: 2, name: 'DOM' },
      ]
    }

    add() {
      this.state.items.push({
        id: this.state.next_id,
        name: `Item ${this.state.next_id}`,
      })
      this.state.next_id++
    }
  }
</script>

<button onclick="fez.add()">Add item</button>
<ul>
  {#each state.items as item}
    <li key={item.id}>{item.name}</li>
  {/each}
</ul>
```

Appending an item does not require recreating the existing list entries.
Their keys carry identity across the render, and the differ inserts only the new node.

The same principle now protects nested Fez components and supports transitions, keyed reordering, and pjax page swaps.
Those later features all depend on the decision made here: the live DOM deserves to be reconciled with care.

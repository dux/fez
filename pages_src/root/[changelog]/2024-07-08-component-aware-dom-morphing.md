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

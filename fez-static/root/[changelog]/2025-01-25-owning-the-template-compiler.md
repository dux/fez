---
title: "Fez began owning its template compiler"
description: "Replacing the early renderer gave Fez control over template semantics, errors, and the cost of each render."
date: "2025-01-25"
slug: "owning-the-template-compiler"
image: "assets/2025-01-25-template-compiler.webp"
image_alt: "A compact compiler machine arranging loose tokens into structured component blocks."
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "templates"
  - "compiler"
  - "rendering"
commits:
  - "16f9420"
  - "9a6dc92"
  - "6915b94"
  - "4cce741"
---

```html
<script>
  class {
    init() {
      this.state.filter = 'all'
      this.state.visible = []
      this.state.tasks = [
        { id: 1, title: 'Compile template', done: true },
        { id: 2, title: 'Morph DOM', done: false },
      ]
    }

    beforeRender() {
      this.state.visible = this.state.filter === 'all'
        ? this.state.tasks
        : this.state.tasks.filter(task => task.done)
    }
  }
</script>

{#if state.visible.length}
  <ul>
    {#each state.visible as task}
      <li key={task.id}>{task.title}</li>
    {/each}
  </ul>
{:else}
  <p>No matching tasks.</p>
{/if}
```

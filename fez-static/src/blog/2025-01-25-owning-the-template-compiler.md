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

# Fez began owning its template compiler

The early Fez prototypes moved through existing template engines quickly.
That was useful while the component model was still changing, but it also meant the most central part of the runtime obeyed someone else's grammar and tradeoffs.

In January 2025, I replaced that path with a Fez template compiler and optimized the generated render functions.
Owning the compiler meant Fez could define collection truthiness, component-specific attributes, event transformation, and useful compile errors as one coherent language.

This was not about inventing syntax for its own sake.
A small runtime benefits from reducing the number of semantic layers a developer has to keep in mind.
The same compiler can understand a loop, preserve a keyed node, register an event, and tell the DOM differ what identity means.

The compiler has since adopted the current Svelte-like surface syntax.
The important milestone was taking responsibility for the semantics underneath it.

## Working example

The compiler turns conditions and loops into a render function before the component updates the DOM.

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

`beforeRender()` computes derived state, while the template remains a readable description of the output.
Keys and block structure are known to Fez at compile time instead of being reconstructed from string conventions later.

Once the compiler belonged to Fez, later additions such as await blocks, strict events, transitions, and typed render slots could grow from the same foundation.

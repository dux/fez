---
title: "Fez adopted Svelte-like templates without adopting Svelte"
description: "A familiar block syntax improved readability while Fez kept its own compiler, runtime, and DOM ownership model."
date: "2026-01-22"
slug: "svelte-like-templates-without-svelte"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "templates"
  - "syntax"
  - "compiler"
commits:
  - "876eb7e"
  - "df8927f"
  - "e8fe356"
---

```html
<script>
  class {
    init() {
      this.state.selected = 2
      this.state.people = [
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Grace' },
      ]
    }

    select(id) {
      this.state.selected = id
    }
  }
</script>

{#if state.people}
  <ul>
    {#each state.people as person}
      <li class:selected={person.id === state.selected}>
        <button onclick="fez.select({person.id})">{person.name}</button>
      </li>
    {/each}
  </ul>
{:else}
  <p>No people found.</p>
{/if}
```

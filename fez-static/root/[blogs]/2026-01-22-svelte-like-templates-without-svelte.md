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

# Fez adopted Svelte-like templates without adopting Svelte

Fez had already used several template syntaxes by early 2026.
The language worked, but familiarity matters when it does not compromise the architecture.

On January 22, I added a Svelte-like compiler path and then migrated the components to it.
Blocks such as `{#if}`, `{#each}`, and `{:else}` made structure visible without inventing new punctuation for ideas developers already knew.

This did not make Fez a Svelte runtime.
There is no Svelte compiler dependency for `.fez` files, no component ownership of the entire application tree, and no generated virtual application around the page.
Fez's own compiler produces HTML for its component-aware DOM differ.

Borrowing good surface syntax is cheaper than making every developer learn a novel one.
The framework's identity should live in its behavior and boundaries, not in being different for its own sake.

## Working example

The current syntax keeps branching, iteration, and conditional classes readable in the HTML.

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

The inline event value is resolved when the loop renders.
The class directive compiles into the element's class attribute.
The empty collection rule means the fallback also handles `[]`.

Familiar syntax lowered the cost of reading Fez while leaving the runtime's smaller ownership model intact.

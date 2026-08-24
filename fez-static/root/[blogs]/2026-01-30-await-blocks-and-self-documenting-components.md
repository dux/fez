---
title: "Await blocks and documentation moved into the component"
description: "Promises gained visible loading and error states while info and demo blocks made each .fez file explain and demonstrate itself."
date: "2026-01-30"
slug: "await-blocks-and-self-documenting-components"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "async"
  - "documentation"
  - "demos"
commits:
  - "088cf99"
  - "803b9ee"
  - "50f469c"
---

# Await blocks and documentation moved into the component

Asynchronous state is not only a resolved value.
It is pending, fulfilled, or rejected, and hiding those states in method bookkeeping makes a component harder to read.

At the end of January 2026, Fez added await blocks.
A promise can stay in state, and the template can describe all three outcomes where they render.
Reassigning a promise naturally returns the component to its loading branch.

The same period added `<info>` and `<demo>` blocks to the component format.
That put explanation, example usage, source, and implementation in one file.
The Fez component index could then power documentation pages without maintaining parallel demo HTML.

These features share a theme: important component states and knowledge should remain visible beside the component.

## Working example

This complete file documents itself and handles the request lifecycle directly in the template.

```html
<info>
  <ul>
    <li>Loads one user and renders pending, success, and error states.</li>
    <li>Prop: <code>user_id</code>.</li>
  </ul>
</info>

<demo>
  <user-summary user_id="42"></user-summary>
</demo>

<script>
  class {
    PROPS = {
      user_id: { type: Number, required: true },
    }

    init(props) {
      this.state.user = Fez.fetch(`/api/users/${props.user_id}`)
    }
  }
</script>

{#await state.user}
  <p>Loading user...</p>
{:then user}
  <h2>{user.name}</h2>
  <p>{user.email}</p>
{:catch error}
  <p>Could not load user: {error.message}</p>
{/await}
```

The promise is assigned directly.
Using `await` inside `init()` would discard the pending state before the template saw it.

The demo system can render the `<demo>` block and show the `<info>` block from this same source file.
Documentation stays close enough to the implementation that changing one without noticing the other becomes difficult.

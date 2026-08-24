---
title: "Fez replaced Idiomorph with its own DOM differ"
description: "Owning the differ let Fez preserve component identity, slots, refs, and render hashes according to its own lifecycle rules."
date: "2026-03-30"
slug: "owning-the-dom-differ"
image: "assets/2026-03-30-dom-differ.webp"
image_alt: "Two aligned page grids with one changed region highlighted in red."
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "dom-morphing"
  - "rendering"
  - "performance"
commits:
  - "da8ed82"
---

# Fez replaced Idiomorph with its own DOM differ

Adopting DOM morphing in 2024 was the right decision, and using an existing implementation was the fastest way to validate it.
By 2026, Fez needed semantics that were specific to Fez components.

On March 30, I removed Idiomorph and introduced a dedicated differ with a large behavioral test suite.
It understood component roots, slot anchors, `fez:keep`, stable references, and the points where child lifecycle methods must run.

The renderer also skips a morph when newly rendered HTML and render slots are unchanged.
That avoids walking a component tree when state writes collapse into the same visible result.
The optimization only works because the runtime owns both template output and reconciliation.

Writing a differ is not a goal I would recommend casually.
It became justified when adapting a general-purpose library was more complex than implementing the smaller set of rules Fez actually needed.

## Working example

This component lets the browser retain the live input while a sibling counter renders repeatedly.

```html
<script>
  class {
    init() {
      this.state.count = 0
    }

    increment() {
      this.state.count++
    }

    submit() {
      alert(this.email_input.value)
    }
  }
</script>

<input fez:this="email_input" type="email" placeholder="Type, then increment" />
<button onclick="fez.increment()">Render {state.count}</button>
<button onclick="fez.submit()">Read email</button>
```

`fez:this` supplies a stable identifier that helps the differ match the input across renders.
The user's current value remains browser state rather than being copied through the template.

The result feels uneventful, which is exactly what good reconciliation should feel like.
State updates the output that changed and leaves unrelated live DOM alone.

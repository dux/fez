---
title: "Fez 0.6 added typed boundaries and native motion"
description: "Typed PROPS, element transitions, FLIP reordering, and content-size animation rounded out the 0.6 runtime."
date: "2026-08-22"
slug: "fez-0-6-typed-props-and-motion"
image: "assets/2026-08-22-typed-props-motion.webp"
image_alt: "Geometric inputs passing through typed gates into moving interface cards."
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "release"
  - "props"
  - "transitions"
commits:
  - "cfdb677"
  - "0101aba"
  - "73d2827"
---

# Fez 0.6 added typed boundaries and native motion

The 0.6 work brought two concerns into the runtime that are often left to component-by-component convention: input coercion and motion lifecycle.

The `PROPS` schema converts HTML strings into numbers, booleans, arrays, objects, dates, or functions before `init()` runs.
It also supports defaults, required values, enums, transforms, and one-time state seeding.
Bad input reports through `Fez.onError` and falls back predictably instead of throwing during connection.

Transitions became declarative attributes on plain elements.
`fez:in`, `fez:out`, and `fez:transition` connect animation to insertion and removal.
`fez:animate="flip"` covers keyed reordering, while height, width, and size animation respond to content changes through `ResizeObserver`.

Both features belong near the template because both describe a boundary.
Props define how outside data enters the component.
Transitions define how DOM enters, leaves, and moves.

## Working example

This notice coerces its duration, seeds open state from a Boolean prop, and animates removal.

```html
<script>
  class {
    PROPS = {
      message: { type: String, required: true },
      duration: { type: Number, default: 3000 },
      open: { type: Boolean, state: true },
    }

    onMount() {
      if (this.state.open) {
        this.setTimeout(() => {
          this.state.open = false
        }, this.props.duration)
      }
    }
  }
</script>

{#if state.open}
  <aside fez:in="fly, from=right, duration=220" fez:out="fade, duration=140">
    {props.message}
  </aside>
{/if}
```

```html
<auto-notice message="Saved" duration="1800" open></auto-notice>
```

`duration` reaches the lifecycle as a number rather than a string.
`open` seeds `state.open` once because the component owns the value after connection.
The outro keeps the node in the DOM until its animation finishes, then the differ removes it.

Fez 0.6 did not change the framework's central premise.
It made the local component boundary more expressive while the surrounding page remained ordinary HTML.

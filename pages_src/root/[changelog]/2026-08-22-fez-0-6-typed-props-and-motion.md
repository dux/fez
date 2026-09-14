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

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

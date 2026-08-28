---
title: "Fez started with the DOM"
description: "The first version established the rule that still matters most: enhance the page the server rendered instead of taking it over."
date: "2024-06-10"
slug: "fez-started-with-the-dom"
image: "assets/2024-06-10-dom-foundation.webp"
image_alt: "Layered browser and DOM cards assembled on a clean worktable."
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "architecture"
  - "dom"
  - "custom-elements"
commits:
  - "1ac22d1"
  - "2880137"
---

```html
<script src="https://raw.githubusercontent.com/dux/fez/main/dist/fez.js"></script>
<script fez="./hello-counter.fez"></script>

<h1>Server-rendered account page</h1>
<hello-counter></hello-counter>
```

```html
<script>
  class {
    init() {
      this.state.count = 0
    }

    increment() {
      this.state.count++
    }
  }
</script>

<button onclick="fez.increment()">Count: {state.count}</button>
```

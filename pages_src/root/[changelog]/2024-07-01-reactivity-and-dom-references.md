---
title: "Reactivity needs a direct route back to the DOM"
description: "Reactive state and fez:this arrived together because useful components need both declarative rendering and precise DOM access."
date: "2024-07-01"
slug: "reactivity-and-dom-references"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "reactivity"
  - "dom"
  - "references"
commits:
  - "c1dc622"
---

```html
<script>
  class {
    init() {
      this.state.message = ''
    }

    onMount() {
      this.name_input.focus()
    }

    greet() {
      const name = this.name_input.value.trim()
      this.state.message = name ? `Hello, ${name}.` : 'Please enter a name.'
    }
  }
</script>

<label>
  Name
  <input fez:this="name_input" autocomplete="name" />
</label>
<button onclick="fez.greet()">Greet</button>
<p>{state.message}</p>
```

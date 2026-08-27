---
title: "Components needed local styles and durable slots"
description: "Style scoping, slot preservation, and binding work turned isolated demos into components that could live safely on real pages."
date: "2024-07-17"
slug: "scoped-styles-slots-and-bindings"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "css"
  - "slots"
  - "composition"
commits:
  - "af435d9"
  - "399923e"
  - "ddc02ca"
---

```html
<!-- info-panel.fez -->
<script>
  class {
    init() {
      this.state.open = true
    }

    toggle() {
      this.state.open = !this.state.open
    }
  }
</script>

<style>
  section {
    border: 1px solid #d2d4d9;
    border-radius: 10px;
    padding: 16px;

    button {
      margin-bottom: 10px;
    }
  }
</style>

<section>
  <button onclick="fez.toggle()">Toggle details</button>
  {#if state.open}
    <slot />
  {/if}
</section>
```

```html
<info-panel>
  <p>This paragraph belongs to the page that uses the component.</p>
</info-panel>
```

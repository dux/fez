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

# Components needed local styles and durable slots

The first components could render, but reusable UI needs stronger boundaries than a render function.
Its CSS must not leak across the page, and the content supplied by its caller must survive the component's own updates.

The July 15 to July 17 changes improved slot preservation, corrected global and local CSS behavior, and added binding support.
These were separate commits around one practical goal: a component should be safe to place inside a larger document.

Fez uses light DOM, so slotted content remains ordinary page content.
That keeps selectors, accessibility tools, browser inspection, and server-rendered markup straightforward.
The component still gets scoped styles, but there is no shadow boundary between the page and the nodes the user sees.

The exact style implementation has changed substantially since 2024.
The current rule is clearer than the early one: `<style>` is scoped as a whole, while `<style global>` is emitted document-wide.

## Working example

This panel styles its own structure and accepts arbitrary caller content through a slot.

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

The panel owns the disclosure behavior and its local presentation.
The caller owns the content.
That separation is what makes composition useful rather than merely possible.

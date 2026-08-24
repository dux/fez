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

# Reactivity needs a direct route back to the DOM

The July 1 work added reactive binding, DOM observation, and the feature that became `fez:this`.
Those ideas belong together.

State is excellent when the output is a function of data.
It is less useful when code needs to focus an input, read a live selection, measure a box, or hand an element to another library.
A component model that hides the DOM eventually invents a complicated escape hatch back to it.

I preferred to make the escape hatch part of the main road.
`fez:this` gives an element a stable identity and exposes it directly on the component instance.
There is no query repeated across methods and no wrapper object pretending the node is something else.

This also set an important performance boundary.
Fez state schedules a render of the component template.
Values that exist only inside a form control do not always belong in state.
Reading them from the referenced element at submit time avoids work and preserves the browser's native behavior.

## Working example

This form keeps the input value in the input and uses state only for rendered feedback.

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

The reference is assigned after the template mounts, which is why focus belongs in `onMount()` rather than `init()`.
The message belongs in state because changing it should update the rendered paragraph.
The input value does not belong in state because the browser already owns it perfectly well.

That split has become one of the most useful Fez habits.
Use reactivity for rendered meaning and direct nodes for live DOM behavior.

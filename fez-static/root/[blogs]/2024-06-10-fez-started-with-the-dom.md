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

# Fez started with the DOM

The first commit did not yet have the final name, API, or template language.
What it did have was the right boundary.

I wanted components without handing an application to a client-side framework.
The server should remain free to render ordinary HTML, and a component should attach behavior only where its tag appears.
That is a smaller promise than a single-page framework makes, and it is exactly why the idea has held up.

The same day, I removed the jQuery requirement.
That was not a rejection of jQuery's style.
Its directness is still a major influence on Fez.
The browser had simply reached the point where the runtime could use `querySelector`, custom elements, events, and the DOM directly without carrying another abstraction underneath.

This decision gives Fez a useful failure mode.
If a component does not load, the surrounding document is still a document.
Forms, links, server routes, and rendered content do not disappear behind an application bootstrap step.

## Working example

Load the runtime, load a component file, and use its tag in normal HTML.

```html
<script src="https://raw.githubusercontent.com/dux/fez/main/dist/fez.js"></script>
<script fez="./hello-counter.fez"></script>

<h1>Server-rendered account page</h1>
<hello-counter></hello-counter>
```

The component owns only its own tag.

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

There is no application root and no build step in this example.
The page remains HTML, while the one part that needs state gets state.

That is still the core of Fez: the DOM is not an output target owned by the framework.
It is the shared medium the component joins.

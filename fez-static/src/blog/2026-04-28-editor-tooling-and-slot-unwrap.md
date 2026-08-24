---
title: "Editor tooling arrived, and slots learned to disappear"
description: "VS Code support improved authoring while slot unwrap let semantic wrappers remain exactly where the component design intended."
date: "2026-04-28"
slug: "editor-tooling-and-slot-unwrap"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "vscode"
  - "slots"
  - "semantics"
commits:
  - "2fb6f10"
  - "d40b826"
---

# Editor tooling arrived, and slots learned to disappear

A component language becomes much easier to trust when the editor understands its boundaries.
In April 2026, Fez gained a VS Code extension with syntax highlighting, snippets, and language configuration for `.fez` files.

Two days later, slots gained `unwrap`.
The default slot wrapper is useful because it gives morphing a durable anchor.
It is not always valid or desirable in the final HTML.

A navigation component may require anchors to remain direct children of `nav`.
A list may require `li` elements to stay directly under `ul`.
`<slot unwrap />` fills the slot and then dissolves the generated wrapper so the semantic structure remains exact.

The tradeoff is explicit.
An unwrapped slot renders once and cannot use reactive component state, because rebuilding the template would lose the caller-owned nodes that were dissolved into it.

## Working example

This component adds behavior and scoped layout to a semantic navigation element without inserting another wrapper around its links.

```html
<script>
  class {
    NAME = 'nav'

    onMount() {
      this.on(this.root, 'click', (event) => {
        const link = event.target.closest('a')
        if (link) this.root.querySelector('.active')?.classList.remove('active')
        link?.classList.add('active')
      })
    }
  }
</script>

<style>
  & {
    display: flex;
    gap: 12px;
  }
</style>

<slot unwrap />
```

```html
<section-nav aria-label="Account">
  <a href="/profile">Profile</a>
  <a href="/billing">Billing</a>
</section-nav>
```

The rendered root is a real `nav`, and the anchors are its direct children.
Tooling makes the special blocks easier to author, while `unwrap` keeps their output faithful to HTML semantics.

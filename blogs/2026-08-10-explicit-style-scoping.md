---
title: "Style scope became explicit on the tag"
description: "Fez removed its CSS-in-JS dependency and made scoped, global, nested, and hoisted CSS behavior part of its own compiler."
date: "2026-08-10"
slug: "explicit-style-scoping"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "css"
  - "scoping"
  - "compiler"
commits:
  - "2af3d18"
  - "b1a4b9b"
  - "fc4341f"
  - "fb09f4c"
---

# Style scope became explicit on the tag

CSS scoping had existed in Fez for years, but its implementation and source rules had accumulated ambiguity.
In August 2026, I removed Goober and made scope a property of the style tag itself.

`<style>` now scopes the entire block to the component.
`<style global>` emits the block verbatim for document-wide rules.
There is no inference based on which selectors happen to appear inside.

Fez also began flattening nested CSS itself and hoisting constructs that cannot legally remain inside a style rule, including `@keyframes`, `@font-face`, and `@property`.
Owning that transformation keeps browser output deterministic instead of relying on emerging native nesting behavior.

The component has a generated outer wrapper.
Root-level declarations style that wrapper, while selectors such as `nav` style template children.
`&` addresses the wrapper explicitly inside nested selectors.

## Working example

This file uses both style channels and keeps their intent visible.

```html
<style>
  padding: 16px;
  border: 1px solid var(--line);

  &:hover {
    border-color: #c8102e;
  }

  article {
    display: grid;
    gap: 8px;

    h2 {
      margin: 0;
    }
  }

  @keyframes enter {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

<style global>
  :root {
    --line: #e6e7ea;
  }
</style>

<article><slot /></article>
```

The component border cannot leak to other elements.
The root token is intentionally available to the whole document.
The keyframes are hoisted to a legal position while remaining declared beside the component that uses them.

CSS is already a capable language.
Fez's job is to give it a predictable component boundary, not replace it with JavaScript objects.

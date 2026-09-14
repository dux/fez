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

---
title: "CDE became Fez"
description: "Renaming the project clarified that it was a small component layer for real pages, not another abstract element system."
date: "2024-06-14"
slug: "cde-became-fez"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "design"
  - "components"
commits:
  - "d8d0ce8"
  - "18106b3"
---

# CDE became Fez

Four days into the project, I renamed CDE to Fez.
The code change was mechanical, but the product decision was not.

Names influence which abstractions feel natural.
"Custom DOM Elements" described an implementation mechanism.
Fez gave the project room to become a practical way of adding behavior, state, styling, loading, and lifecycle to ordinary HTML.

I also wanted component names to remain visible in the markup.
A custom element should read like a small piece of the product, not like compiler output.
Kebab-case tags made that possible while staying inside the browser's custom-element rules.

The convention is deliberately boring.
`user-profile`, `payment-status`, and `search-box` tell another developer what lives there before they open the component source.
That readability is more valuable than saving a few characters.

## Working example

A Fez component is named by its file and used as a real custom element.

```html
<!-- ./status-pill.fez -->
<script>
  class {
    PROPS = {
      state: { type: String, default: 'pending' },
    }
  }
</script>

<style>
  span {
    display: inline-flex;
    padding: 4px 10px;
    border-radius: 999px;
    background: #f4d9de;
    color: #8e0b21;
  }
</style>

<span>{props.state}</span>
```

```html
<script fez="./status-pill.fez"></script>

<p>Invoice <status-pill state="paid"></status-pill></p>
```

The component does not need a parent Fez application.
It can sit beside server templates, old JavaScript, or a third-party widget and still remain understandable as HTML.

The rename marked the point where the project stopped being an experiment named after its plumbing.
It became a small framework with a clear taste: readable tags, local ownership, and very little ceremony.

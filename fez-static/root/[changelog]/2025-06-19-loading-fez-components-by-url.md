---
title: "A Fez component became loadable by URL"
description: "URL loading made a .fez file a portable component artifact that a page can consume without a local build pipeline."
date: "2025-06-19"
slug: "loading-fez-components-by-url"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "loader"
  - "cdn"
  - "components"
commits:
  - "49f1e8e"
  - "eccf09a"
---

```html
<script src="https://raw.githubusercontent.com/dux/fez/main/dist/fez.js"></script>

<script fez="https://raw.githubusercontent.com/dux/fez/main/demo/fez/ui-counter.fez"></script>

<ui-counter start="2"></ui-counter>
```

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

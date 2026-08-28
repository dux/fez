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

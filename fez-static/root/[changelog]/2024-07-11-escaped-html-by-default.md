---
title: "Templates escape HTML unless I explicitly opt out"
description: "Escaped interpolation became the safe default, with a visible raw-HTML directive for trusted content."
date: "2024-07-11"
slug: "escaped-html-by-default"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "templates"
  - "security"
  - "html"
commits:
  - "5e9f72b"
---

```html
<script>
  class {
    init() {
      this.state.user_text = '<img src=x onerror=alert(1)>'
      this.state.trusted_html = '<strong>Saved successfully.</strong>'
    }
  }
</script>

<p>User input: {state.user_text}</p>
<div class="notice">{@html state.trusted_html}</div>
```

---
title: "fez:keep made preservation explicit"
description: "A stable preservation key gave expensive or stateful DOM subtrees a clear contract with the renderer."
date: "2025-08-05"
slug: "preserving-dom-with-fez-keep"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "dom"
  - "identity"
  - "performance"
commits:
  - "82b7f80"
  - "32c1671"
---

```html
<script>
  import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4/+esm'

  class {
    init() {
      this.state.title = 'Revenue'
    }

    onMount() {
      this.local.chart = new Chart(this.chart_node, {
        type: 'line',
        data: this.props.data,
      })
    }

    onDestroy() {
      this.local.chart?.destroy()
    }
  }
</script>

<h2>{state.title}</h2>
<div fez:keep="revenue-chart" fez:this="chart_node"></div>
```

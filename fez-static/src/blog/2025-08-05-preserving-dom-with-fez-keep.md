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

# fez:keep made preservation explicit

DOM morphing handles ordinary updates well, but some subtrees should not participate in diffing at all.
An editor, map, video player, or third-party widget may own internal nodes that cannot be reconstructed from the Fez template.

In August 2025, Fez added `fez:keep` as an explicit preservation contract.
When the key remains the same, the differ keeps the existing plain element and everything inside it.
When the key changes, the subtree can be recreated intentionally.

The directive belongs on plain HTML elements, not directly on Fez component tags.
Nested Fez components already have component-aware preservation rules.
When a component needs a preservation boundary, a plain wrapper makes that boundary visible.

The key should include every value that makes the preserved subtree obsolete.
A constant key means "never let rendering touch this again," which is correct only when the component updates that subtree itself.

## Working example

This component lets an external chart own its container while the heading remains reactive.

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

A change to `state.title` re-renders the component but leaves the chart's DOM untouched.
The external instance lives in `this.local` because it is not render state.

`fez:keep` is not a performance charm to scatter across templates.
It is a precise ownership declaration for the places where another system, or direct DOM code, is in charge.

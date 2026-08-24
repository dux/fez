---
title: "Pub/sub made components cooperate without coupling"
description: "The first substantial demos arrived with a small event model for communication within and across component trees."
date: "2024-07-14"
slug: "pub-sub-and-real-components"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "events"
  - "pub-sub"
  - "components"
commits:
  - "ecc4481"
  - "40e95a6"
---

# Pub/sub made components cooperate without coupling

A counter can prove that state renders.
Tabs, a todo list, and coordinated widgets prove whether a component model can support an actual interface.

The July 14 work added pub/sub and expanded the demos into those more realistic cases.
It exposed an architectural question early: how should one component announce something without reaching into another component's instance?

Direct references are useful when the relationship is explicitly imperative.
They are a poor default for domain events.
A cart button should announce that an item was added, not locate a header component and edit its state.

Fez therefore supports both component-scoped publication and global publication.
Component subscriptions are cleaned up with the instance, while global events can reach independent parts of the page.
The event name becomes the contract, and neither side needs to know the other's tag or DOM location.

## Working example

These two independent components share a small global event.

```html
<!-- add-to-cart.fez -->
<script>
  class {
    add() {
      Fez.publish('cart:add', { id: this.props.product_id })
    }
  }
</script>

<button onclick="fez.add()">Add to cart</button>
```

```html
<!-- cart-count.fez -->
<script>
  class {
    init() {
      this.state.count = 0
      this.subscribe('cart:add', () => {
        this.state.count++
      })
    }
  }
</script>

<span>Cart: {state.count}</span>
```

```html
<add-to-cart product_id="book-7"></add-to-cart>
<cart-count></cart-count>
```

The counter owns its count.
The button owns the user action.
The `cart:add` event is the only shared surface.

This pattern is intentionally small.
When a workflow needs request tracking, persistence, or complex transactions, I use an appropriate data layer.
For coordination between light DOM components, a named event is often the clearest tool available.

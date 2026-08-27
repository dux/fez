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

---
title: "Unless understands empty collections"
description: "Fez added a practical empty-state block whose truthiness rules match the way interface data is actually shaped."
date: "2025-06-26"
slug: "unless-understands-empty-collections"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "templates"
  - "empty-states"
  - "collections"
commits:
  - "e04f498"
---

```html
<script>
  class {
    init() {
      this.state.notifications = []
    }

    add() {
      this.state.notifications.push({
        id: Date.now(),
        text: 'Build completed',
      })
    }
  }
</script>

<button onclick="fez.add()">Add notification</button>

{#unless state.notifications}
  <p>You are all caught up.</p>
{/unless}

{#each state.notifications as notification}
  <p key={notification.id}>{notification.text}</p>
{/each}
```

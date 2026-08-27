---
title: "Component identity stopped depending on sibling position"
description: "Source signatures and explicit keys made component preservation reliable when lists insert, remove, or reorder children."
date: "2026-07-11"
slug: "component-identity-during-morphs"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "identity"
  - "dom-morphing"
  - "components"
commits:
  - "e9fafb2"
  - "3141208"
---

```html
<!-- account-list.fez -->
<script>
  class {
    init() {
      this.state.accounts = [
        { id: 7, name: 'Personal' },
        { id: 12, name: 'Studio' },
      ]
    }

    reverse() {
      this.state.accounts.reverse()
    }
  }
</script>

<button onclick="fez.reverse()">Reverse</button>

{#each state.accounts as account}
  <account-row key={account.id} :account="account"></account-row>
{/each}
```

```html
<!-- account-row.fez -->
<script>
  class {
    PROPS = {
      account: { type: Object, required: true },
    }
  }
</script>

<label>
  {props.account.name}
  <input placeholder="Unsaved note" />
</label>
```

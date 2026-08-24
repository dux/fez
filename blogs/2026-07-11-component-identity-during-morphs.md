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

# Component identity stopped depending on sibling position

DOM differs need an answer to a deceptively difficult question: is this the same component as before?
Tag name and sibling position are not enough when a list inserts at the front or two instances of the same component exchange places.

In July 2026, Fez introduced source-signature identity for unkeyed components and strengthened explicit key behavior.
The differ could preserve an unkeyed component based on the source that produced it, while `key` remained the clear opt-in for domain identity.

Explicit keys are still the right choice for data-backed lists.
They express what the application knows and the renderer cannot infer: account `42` remains account `42` even when its position changes.

The later slot-content fix completed the rule by ensuring a keyed component is rewritten when the caller's supplied content genuinely changes.
Preservation should keep identity, not freeze inputs.

## Working example

The parent keys each child by account identity.

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

Reversing the parent array moves the existing component nodes instead of turning one account instance into another.
Any live input state travels with the account it belongs to.

Identity rules are invisible when they work and destructive when they do not.
That makes them worth defining explicitly and testing heavily.

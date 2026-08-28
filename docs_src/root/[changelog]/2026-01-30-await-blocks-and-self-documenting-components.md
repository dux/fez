---
title: "Await blocks and documentation moved into the component"
description: "Promises gained visible loading and error states while info and demo blocks made each .fez file explain and demonstrate itself."
date: "2026-01-30"
slug: "await-blocks-and-self-documenting-components"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "async"
  - "documentation"
  - "demos"
commits:
  - "088cf99"
  - "803b9ee"
  - "50f469c"
---

```html
<info>
  <ul>
    <li>Loads one user and renders pending, success, and error states.</li>
    <li>Prop: <code>user_id</code>.</li>
  </ul>
</info>

<demo>
  <user-summary user_id="42"></user-summary>
</demo>

<script>
  class {
    PROPS = {
      user_id: { type: Number, required: true },
    }

    init(props) {
      this.state.user = Fez.fetch(`/api/users/${props.user_id}`)
    }
  }
</script>

{#await state.user}
  <p>Loading user...</p>
{:then user}
  <h2>{user.name}</h2>
  <p>{user.email}</p>
{:catch error}
  <p>Could not load user: {error.message}</p>
{/await}
```

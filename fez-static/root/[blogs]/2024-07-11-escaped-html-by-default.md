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

# Templates escape HTML unless I explicitly opt out

Template convenience can quietly become a security policy.
If ordinary interpolation emits raw HTML, every value carries an obligation to prove where it came from.
That is the wrong default for application code.

On July 11, Fez changed interpolation to escape HTML and added an explicit raw-HTML form.
The syntax has evolved since then, but the contract has not.

Visible friction is useful at a dangerous boundary.
`{state.value}` should be safe for a name from a form, a title from a database, or a value returned by an API.
When code genuinely holds sanitized markup, `{@html state.value}` makes that decision obvious during review.

The raw directive is not a sanitizer.
It is a statement that sanitization or trust has already been established elsewhere.
Keeping those two responsibilities separate makes the component easier to reason about.

## Working example

The first value is treated as text even though it contains markup.
The second value is deliberately rendered as HTML.

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

The paragraph displays the angle brackets instead of creating an image.
The notice creates a `strong` element because the raw directive is explicit.

In production, `trusted_html` should come from a controlled template or a real HTML sanitizer.
I do not use `{@html}` merely because a value happens to contain tags.

Safe defaults are one of the few framework features that remove work rather than adding it.
Most values stay on the ordinary path, and the exceptional path is easy to search for.

---
title: "A smaller Fez root: Fez.url, Fez.util, Fez.css and Fez.req"
description: "URL state became one parse-and-build helper, utilities and CSS helpers moved into namespaces, Fez.request became Fez.req and Fez.fetch is gone."
date: "2026-11-17"
slug: "a-smaller-fez-root"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "url"
  - "request"
  - "api"
---

```js
Fez.url('/boards/x/pri:3?q=a#/logs?app=shop').pqs('pri')   // '3'
Fez.url.qs('page', 2).push()                               // the current page, history only
Fez.load(Fez.url.pqs('pri', null))                         // navigate with a builder

Fez.util.htmlEscape(text)
Fez.css.global('.card { padding: 8px; }')
const res = await Fez.req('/api/stats', { cache: 300 })
```

`Fez.url(href)` parses and builds any URL part by part: `proto`, `host`, `port`, `path`, `pqs` (trailing `/key:value` segments), `qs`, `hpath`, `hqs` and `anchor`.
A method reads with a key and writes with a value; writes chain and finish with `push()`, `replace()` or `String(...)`.
`Fez.url.qs(...)` is the same call on the current page.

Breaking changes:

* `Fez.qs`, `Fez.hash`, `Fez.hpath` and `Fez.hqs` are removed; use `Fez.url.qs`, `Fez.url.hqs`, `Fez.url.hpath` and `Fez.url.hqs`. `hpath()` now returns the whole route path (`'/logs'`), not its last segment.
* `Fez.request` is `Fez.req`, and `Fez.param` is `Fez.req.param`. `Fez.fetch` is removed; use `Fez.req(url, { cache: 300 })`.
* Helpers moved into `Fez.util`: `htmlEscape`, `htmlAttr`, `jsEscape`, `styleProp`, `isTrue`, `isTruthy`, `typeof`, `toPairs`, `throttle`, `fnv1`, `uid`, `darkenColor`, `lightenColor`, `untilTrue`, `onReady`, `activateNode` and `animateSize`.
* CSS helpers are `Fez.css(text)`, `Fez.css.global`, `Fez.css.mixin` and `Fez.css.extract` (were `cssClass`, `globalCss`, `cssMixin`, `extractCss`).
* `Fez.dump` and `Fez.highlightAll` are `Fez.dev.dump` and `Fez.dev.highlightAll`.
* Runtime internals moved under `Fez._`.

`fez refactor` reports every removed name with its replacement.

---
title: "One request layer and Fez.$"
description: "Fez.request runs every request on XMLHttpRequest with upload progress, abort and nested data; Fez.fetch, pjax and the new jQuery-shaped Fez.$ all go through it."
date: "2026-11-13"
slug: "one-request-layer-and-fez-dollar"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "request"
  - "dom"
  - "pjax"
---

```js
Fez.request.headers['x-csrf-token'] = token // same-origin requests only

const res = await Fez.request({
  method: 'POST',
  url: '/api/assets/create',
  data: { asset: { file, name: 'scan.pdf' } },   // a Blob anywhere -> multipart
  onUpload: (p) => (bar.value = p.percent),
})
if (!res.ok) showErrors(res.data)               // an error status resolves, it does not throw

const $ = Fez.$
$(document).on('click.menu', '.item', open)      // registering again replaces it
$.post('/api/sort', { refs: ['a', 'b'] }).done((data) => {})
```

`Fez.request` is the one remote-request primitive.
It runs on `XMLHttpRequest`, so uploads report progress, every request can be aborted or time out, and the promise never rejects: `res.error` names a network failure, a timeout or an abort.
Plain-object data is encoded Rails/Rack style by the new `Fez.param` (`refs[]=a`, `user[name]=x`), as multipart when it holds a file.
`Fez.request.headers` are sent to the same origin only, so a CSRF token never leaks to a presigned upload URL.

`Fez.$` is a small jQuery-shaped DOM layer: selection, traversal, classes, attributes, insertion and namespaced, delegated events.
Fez never assigns `window.$`; an app opts in with `window.$ = Fez.$`.
`on()` keeps one handler per node, event and key, so a script that pjax runs again does not stack handlers.
`$.ajax`, `$.get` and `$.post` run on `Fez.request` and return its promise plus `.done`, `.fail` and `.always`.
`this.$root` is now always a `Fez.$` set.

Breaking changes:

* `Fez.clearFetchCache()` is removed, use `Fez.request.clearCache()`.
* `Fez.fetch` POST data is urlencoded with bracket names instead of flat `FormData` (multipart only when it holds a file), PUT and DELETE now send their data, and a network failure or timeout rejects too.
* Pjax requests go through `Fez.request`; `Fez.pjax.requests` holds request promises with `abort()` instead of `AbortController`s.

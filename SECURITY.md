# Fez security model

Fez compiles templates and component scripts to JavaScript at runtime. That
design has security consequences worth stating explicitly.

## Trusted input

Fez treats `.fez` component sources, template strings, and handler attributes as
**trusted application code**. They are compiled with `new Function` and evaluated
in the page. This is the same trust model as loading a JavaScript file, and it is
why Fez needs a Content-Security-Policy that allows `unsafe-eval`.

Do not feed untrusted strings into any of the following. They are code-execution
sinks by design:

- `Fez.compile(name, source)` and `<template fez>` / `<xmp fez>` sources
- `createTemplate(text)` and `Fez.createTemplate(text)`
- `fez.*` / bare calls inside `on<event>` attributes
- `:attr="expr"`, `fez-bind`, `fez-use`, and `data-props` / `data-json-template`
- `Fez.getFunction(string)` and `Fez.head({ script })`
- Inline `<script>` tags returned by a pjax response

## Untrusted input

Everything that can be influenced by an end user or a remote server is treated
as untrusted:

- Values interpolated with `{expr}` are HTML-escaped.
- `{@html expr}` is raw by contract; only use it with sanitized content.
- `Fez.nodeMorph` / `morphdom` parse HTML from strings. A pjax response is
  same-origin only; never morph HTML from an origin you do not control.
- `Fez.index.apply` and `Fez.domRoot` write HTML with `innerHTML`; pass only
  trusted demo/documentation markup.

## Content-Security-Policy

Because component code is compiled and run at runtime, a strict CSP for a Fez
app includes:

```
script-src 'self' 'unsafe-eval';
```

Applications that precompile all components and do not use inline handlers or
runtime `Fez.compile` can drop `unsafe-eval`.

## Reporting

Report suspected vulnerabilities via the repository issue tracker:
https://github.com/dux/fez/issues

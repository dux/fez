// The one place fez turns source text into code at runtime: templates and
// .fez files compiled in the browser, string handlers (Fez.getFunction), :attr
// expressions in server HTML, <fez-if>. The CSP build (dist/fez.csp.*, see
// build.js) swaps this module for evaluate-csp.js, so a page with a
// Content-Security-Policy without 'unsafe-eval' runs fez with precompiled
// components only (the bundler plugin) and gets a clear error otherwise.

export default function evaluate(what, ...args) {
  return new Function(...args);
}

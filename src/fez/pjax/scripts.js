// Script handling for a pjax response. The response is parsed with innerHTML,
// which never runs scripts, so inline ones are run here by hand: as <script>
// elements carrying the page's CSP nonce (Fez.runScript), never through eval.
//
// On a page with a CSP nonce a response script runs only when it carries the
// nonce of its own response (named in that response's Content-Security-Policy
// header): markup injected into a response cannot run code the server did not
// emit, exactly as on a full page load. A page without a nonce runs them all.

import Fez from '../root.js';

const isInlineJs = (script) => {
  if (script.getAttribute('src') || script.getAttribute('fez')) {
    return false;
  }
  return (script.getAttribute('type') || 'javascript').includes('javascript');
};

// The nonce a Content-Security-Policy header gives to scripts, '' without one
export function responseNonce(header) {
  return header?.match(/script-src[^;]*'nonce-([^']+)'/)?.[1] || '';
}

const allowed = (script, nonce) =>
  !Fez.nonce() || (!!nonce && (script.nonce || script.getAttribute('nonce')) === nonce);

const execute = (script, nonce) => {
  if (!allowed(script, nonce)) {
    console.warn('fez pjax: skipped an inline script without the response CSP nonce');
    return;
  }
  const code = script.textContent;
  if (script.hasAttribute('pjax-delay')) {
    requestAnimationFrame(() => Fez.runScript(code));
  } else {
    Fez.runScript(code);
  }
};

// Runs the inline scripts of the part about to be swapped in, and removes them
// from it so the morph never carries (or re-runs) them. Returns the node.
// `nonce` is the response's CSP nonce (responseNonce).
//
// Scripts run AFTER history has been committed, but BEFORE the new HTML is
// morphed into the live document. Inline scripts in a response typically set
// globals/state that the rendered markup consumes on `pjax:render`, and may
// need the new `location.pathname + location.search`. Running them first also
// avoids a flash where new nodes appear before their setup ran.
// Side effect: a script cannot `document.querySelector` siblings in the same
// response (they aren't in `document` yet) - do per-DOM wiring in a
// `pjax:render` listener, or tag the script `pjax-delay` to defer it to the
// next animation frame (after the morph completes).
export function runScripts(node, nonce) {
  for (const script of Array.from(node.getElementsByTagName('script'))) {
    if (isInlineJs(script)) {
      execute(script, nonce);
      script.remove();
    }
  }
  return node;
}

// Inline <head> scripts of a full-page response are otherwise discarded on a
// swap (only the pjax region is morphed in). Run those outside the pjax region
// so head bootstrap - e.g. window.app data and flash emitted by the server -
// refreshes on every navigation. src= bundles and the pjax region's own
// scripts (handled by runScripts) are skipped.
//
// A full page's <head> also carries its own fez definitions: the
// `<script fez="ui-clock.fez">` loaders and inline `<template fez>` /
// `<xmp fez>` blocks a layout emits per page. They are not code to run but
// components to compile, and the morph only reaches the pjax region - so
// compile them here, or a pjax navigation lands on a page whose components
// never registered (unknown custom elements, empty widgets).
export function runHeadScripts(root, pjaxBody, onError, nonce) {
  const outside = (node) => !pjaxBody?.contains(node);

  for (const node of Array.from(root.querySelectorAll('template[fez], xmp[fez], script[fez]'))) {
    if (!outside(node)) {
      continue;
    }
    // one malformed definition must not abort the whole swap (the caller
    // would fall back to a full page load), so report and keep going
    try {
      Fez.compile(node);
    } catch (err) {
      onError(`Head component failed: ${err?.message || err}`);
    }
  }

  for (const script of Array.from(root.getElementsByTagName('script'))) {
    if (outside(script) && isInlineJs(script)) {
      execute(script, nonce);
    }
  }
}

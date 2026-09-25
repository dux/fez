// Script handling for a pjax response. The response is parsed with innerHTML,
// which never runs scripts, so inline ones are executed here by hand.

import Fez from '../root.js';

const isInlineJs = (script) => {
  if (script.getAttribute('src') || script.getAttribute('fez')) {
    return false;
  }
  return (script.getAttribute('type') || 'javascript').includes('javascript');
};

const execute = (script) => {
  const func = new Function(script.textContent);
  if (script.hasAttribute('pjax-delay')) {
    requestAnimationFrame(func);
  } else {
    func();
  }
};

// Runs the inline scripts of the part about to be swapped in, and removes them
// from it so the morph never carries (or re-runs) them. Returns the node.
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
export function runScripts(node) {
  for (const script of Array.from(node.getElementsByTagName('script'))) {
    if (isInlineJs(script)) {
      execute(script);
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
export function runHeadScripts(root, pjaxBody, onError) {
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
      execute(script);
    }
  }
}

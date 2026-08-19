// Pjax boot, called from fez.js for the primary fez copy only (the fez dist
// IIFE can be inlined into several bundles on one page - see src/fez.js).
//
// window.Pjax is always exposed so app code can call Pjax.load() etc, but the
// navigation handlers (link hijack, popstate, data-pjax forms) bind only when
// the page declares a pjax container (<pjax> tag or .pjax class). Pages
// without one keep native browser navigation. A page that injects the
// container after DOMContentLoaded can call Pjax.start() manually.

import createPjax from './pjax.js';

export default function bootPjax() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // an app still loading the standalone dux-pjax package wins - never double-bind
  if (window.Pjax) return;

  const Pjax = createPjax();
  window.Pjax = Pjax;

  const boot = () => {
    const container =
      document.getElementsByTagName?.('pjax')[0] ||
      document.getElementsByClassName?.('pjax')[0];
    if (container) Pjax.start();
  };

  if (!document.readyState || document.readyState === 'loading') {
    document.addEventListener?.('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

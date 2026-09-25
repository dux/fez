// Pjax boot, called from fez.js for the primary fez copy only (the fez dist
// IIFE can be inlined into several bundles on one page - see src/fez.js).
//
// Fez.pjax and the Fez.load / Fez.refresh / URL state shortcuts are always
// exposed, but the navigation handlers (link hijack, popstate, data-pjax forms)
// bind only when the page declares a pjax container (<pjax> tag or .pjax
// class). Pages without one keep native browser navigation. A page that
// injects the container after DOMContentLoaded can call Fez.pjax.start().

import Fez from '../root.js';
import createPjax from './pjax.js';

export default function bootPjax() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  Fez.pjax = createPjax();

  // resolved at call time, so an override on Fez.pjax also drives the shortcut
  Fez.load = (...args) => Fez.pjax.load(...args);
  Fez.refresh = (...args) => Fez.pjax.refresh(...args);
  Fez.qs = (...args) => Fez.pjax.qs(...args);
  Fez.hash = (...args) => Fez.pjax.hash(...args);
  Fez.hpath = (...args) => Fez.pjax.hpath(...args);
  Fez.hqs = (...args) => Fez.pjax.hqs(...args);

  const boot = () => {
    const container =
      document.getElementsByTagName?.('pjax')[0] || document.getElementsByClassName?.('pjax')[0];
    if (container) {
      Fez.pjax.start();
    }
  };

  if (!document.readyState || document.readyState === 'loading') {
    document.addEventListener?.('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

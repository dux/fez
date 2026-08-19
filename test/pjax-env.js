// Shared happy-dom environment for the pjax test files.
//
// Pjax touches far more browser surface than the component tests (history,
// location, XHR, MouseEvent, FormData), so unlike node-morph.test.js we swap
// the whole global window for a happy-dom one - but keep the canonical Fez
// instance reachable on it, and restore every global in teardown so the other
// test files in the same run are unaffected.

import { Window } from 'happy-dom';

const KEYS = [
  'window',
  'document',
  'location',
  'CustomEvent',
  'XMLHttpRequest',
  'FormData',
  'MouseEvent',
  'requestAnimationFrame',
  'scrollTo',
];

const saved = {};

export function setupPjaxEnv() {
  for (const k of KEYS) saved[k] = globalThis[k];

  const happyWindow = new Window({ url: 'http://localhost/' });
  happyWindow.Fez = saved.window?.Fez;

  global.window = happyWindow;
  global.document = happyWindow.document;
  global.location = happyWindow.location;
  global.CustomEvent = happyWindow.CustomEvent;
  global.XMLHttpRequest = happyWindow.XMLHttpRequest;
  global.FormData = happyWindow.FormData;
  global.MouseEvent = happyWindow.MouseEvent;

  // sync raf so pjax-delay scripts and post-swap scroll callbacks run inline
  const raf = (cb) => {
    cb();
    return 0;
  };
  global.requestAnimationFrame = raf;
  try {
    happyWindow.requestAnimationFrame = raf;
  } catch {
    Object.defineProperty(happyWindow, 'requestAnimationFrame', { value: raf, configurable: true });
  }

  const noopScroll = () => {};
  global.scrollTo = noopScroll;
  try {
    happyWindow.scrollTo = noopScroll;
  } catch {
    Object.defineProperty(happyWindow, 'scrollTo', { value: noopScroll, configurable: true });
  }

  return happyWindow;
}

export function teardownPjaxEnv() {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete globalThis[k];
    else globalThis[k] = saved[k];
  }
}

// The standard page fixture the coffee suite used: a pjax container with a
// nested .ajax region.
export function resetDOM() {
  document.body.innerHTML = `
    <main class="pjax" id="pjax">
      <div class="ajax" id="ajax-node" data-path="/dialog">
        <a href="/next" class="ajax-trigger">Next</a>
      </div>
    </main>
  `;
}

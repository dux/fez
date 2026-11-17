// Shared happy-dom environment for the pjax test files.
//
// Pjax touches far more browser surface than the component tests (history,
// location, MouseEvent, FormData), so unlike node-morph.test.js we swap the
// whole global window for a happy-dom one - but keep the canonical Fez
// instance reachable on it, and restore every global in teardown so the other
// test files in the same run are unaffected. fetch is mocked per test with
// installMockFetch().

import { Window } from 'happy-dom';

const KEYS = [
  'window',
  'document',
  'location',
  'CustomEvent',
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

// Fez.req (and so pjax) runs on XMLHttpRequest; see mock-xhr.js.
export { installMockXHR } from './mock-xhr.js';

// A response stand-in for calling handleResponse directly.
export function fakeResponse(status = 200, headers = {}, url = '') {
  return { status, url, headers: new Headers(headers) };
}

// Lets the awaited request continuations run.
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Completes a mock request as if the server answered, then lets pjax process it.
export async function respond(request, html, status = 200, headers = {}) {
  request.respond(status, html, headers);
  await settle();
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

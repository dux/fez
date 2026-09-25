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

// Swaps fetch for a recorder. Every call lands in `requests` and stays pending
// until respond(); aborting its signal rejects it with an AbortError, like the
// real fetch. Call restore() in teardown.
export function installMockFetch() {
  const requests = [];
  const original = globalThis.fetch;

  globalThis.fetch = (url, init = {}) =>
    new Promise((resolve, reject) => {
      const request = {
        url,
        method: init.method,
        headers: init.headers || {},
        body: init.body,
        resolve,
        reject,
      };
      init.signal?.addEventListener('abort', () => {
        request.aborted = true;
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
      requests.push(request);
    });

  return {
    requests,
    restore: () => (globalThis.fetch = original),
  };
}

// A fetch Response stand-in for handleResponse / the mock fetch.
export function fakeResponse(status = 200, headers = {}, url = '') {
  return { status, url, headers: new Headers(headers) };
}

// Lets the awaited fetch continuations run.
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Completes a mock request as if the server answered, then lets pjax process it.
export async function respond(request, html, status = 200, headers = {}) {
  request.resolve({ ...fakeResponse(status, headers), text: async () => html });
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

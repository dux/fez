// Single-stylesheet CSS injector.
//
// Replaces goober. We only ever needed two things from it - a stable hash and
// somewhere to put the text - and its one-class-wraps-everything model forced
// two workarounds: every rule got a `.goNNN ` prefix it did not need, and that
// class had to be stuck on <html> for the rules to match at all. That made
// truly global CSS impossible (`:root {}` became `.goNNN :root`, which matches
// nothing) and inflated the specificity of every component rule.
//
// Nesting is now the browser's job. Component CSS is already scoped by the
// .fez.fez-<name> selector the compiler emits, so the text can go in verbatim.

const injected = new Set();
const chunks = [];

let sheet = null;

// FNV-ish rolling hash - collision odds are irrelevant here, we only need a
// stable key per distinct stylesheet
export const cssHash = (text) => {
  let hash = 11;
  for (let i = 0; i < text.length; i++) {
    hash = (101 * hash + text.charCodeAt(i)) >>> 0;
  }
  return 'fez-' + hash.toString(36);
};

const ensureStyleNode = () => {
  if (sheet && sheet.isConnected) {
    return { node: sheet, rebuilt: false };
  }

  const existing = document.getElementById('fez-css');
  if (existing) {
    sheet = existing;
    return { node: existing, rebuilt: false };
  }

  // New node: replay everything injected so far, so a removed/replaced
  // <style id="fez-css"> does not silently drop the stylesheet.
  sheet = document.createElement('style');
  sheet.id = 'fez-css';
  for (const chunk of chunks) {
    sheet.appendChild(document.createTextNode(`${chunk}\n`));
  }
  document.head.appendChild(sheet);
  return { node: sheet, rebuilt: true };
};

/**
 * Append CSS to the shared stylesheet. Repeat calls with identical text are
 * no-ops, so registering a component twice cannot duplicate its rules.
 * @param {string} text - CSS rules, already scoped by the caller
 * @returns {string} stable key for this text
 */
export const injectCss = (text) => {
  const key = cssHash(text);
  if (injected.has(key)) {
    return key;
  }
  injected.add(key);
  chunks.push(text);

  // No DOM (unit tests) - the hash is still a useful return value
  try {
    const { node, rebuilt } = ensureStyleNode();
    // A rebuilt node already replays every chunk, including this one.
    if (!rebuilt) {
      node.appendChild(document.createTextNode(`${text}\n`));
    }
  } catch {}

  return key;
};

/**
 * Everything injected so far, in injection order. Useful for SSR and tests.
 * @returns {string}
 */
export const extractCss = () => chunks.join('\n');

export default injectCss;

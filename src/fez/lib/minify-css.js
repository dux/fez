// Build-time CSS minifier for component <style> blocks (compile-module, `minify`).
//
// Whitespace and comments only: the output is the same nested CSS, so the
// runtime pipeline (Fez.cssMixin, flattenCss) reads it exactly as it read the
// source. Strings and url() are copied verbatim; whitespace runs collapse to one
// space and go away next to `{ } ; , :` where CSS never needs them.
//
// The style macros are textual (utils/css_mixin.js), so their shape survives:
//   - `:name {` / `@include name {` keep the space before `{` (the macro needs it)
//   - a space before `:name` or `@include` stays unless `{` or `;` precedes it (the macro's lead
//     guard takes only those): `} :name`, `.a, :name`
//   - `:name;` keeps its `;` before a closing `}`

// a macro-shaped prelude or declaration at the end of the output
const MACRO_END = /(?:^|[\s{;])(?::|@include\s+)[\w-]+$/;

const DROP_BEFORE = new Set(['{', '}', ';', ',']);
const DROP_AFTER = new Set(['{', '}', ';', ',', ':']);

/**
 * @param {string} css - component CSS, nested or flat
 * @returns {string} the same CSS without comments and needless whitespace
 */
export default function minifyCss(css) {
  let out = '';
  let space = false;

  // a pending whitespace run, emitted only when the character at `at` needs it
  const flushSpace = (at) => {
    const next = css[at];
    if (!space) {
      return;
    }
    space = false;
    const prev = out[out.length - 1];
    if (prev === undefined) {
      return;
    }
    const macroLead = next === ':' || css.startsWith('@include', at);
    if (macroLead && prev !== '{' && prev !== ';') {
      out += ' ';
      return;
    }
    if (next === '{' && MACRO_END.test(out)) {
      out += ' ';
      return;
    }
    if (DROP_AFTER.has(prev) || DROP_BEFORE.has(next)) {
      return;
    }
    out += ' ';
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];

    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
      space = true;
      continue;
    }

    if (/\s/.test(ch)) {
      space = true;
      continue;
    }

    flushSpace(i);

    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) {
        j += css[j] === '\\' ? 2 : 1;
      }
      out += css.slice(i, j + 1);
      i = j;
      continue;
    }

    if (ch === '\\') {
      out += css.slice(i, i + 2);
      i++;
      continue;
    }

    // url(...) unquoted may hold anything but `)`; keep it as written
    if (
      (ch === 'u' || ch === 'U') &&
      /^url\(/i.test(css.slice(i, i + 4)) &&
      !/[\w-]/.test(out[out.length - 1] || '')
    ) {
      const end = css.indexOf(')', i + 4);
      const stop = end === -1 ? css.length : end + 1;
      out += css.slice(i, stop);
      i = stop - 1;
      continue;
    }

    // `;}` -> `}`, unless the `;` ends a `:name;` macro
    if (ch === '}' && out.endsWith(';') && !MACRO_END.test(out.slice(0, -1))) {
      out = out.slice(0, -1);
    }

    out += ch;
  }

  return out;
}

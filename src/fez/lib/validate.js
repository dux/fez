// Shared source validation used by the runtime compiler and the build-time
// module compiler. Keep messages in sync with validateStyle() in bin/fez-compile.

export const STYLE_SCOPE_ERRORS = {
  body: 'body { } in a scoped <style>. Move these rules to <style global>.',
  host: ':host is not supported. <style> is already scoped - use `&` for the root node.',
  fez: ':fez is no longer an author-facing selector. <style> is already scoped - use `&` for the root node.',
  globalInGlobal:
    ':global() inside <style global>. These rules are already global - drop the wrapper.',
};

// Blank out comments while keeping length and line breaks, so scope checks
// never fire on prose - "was :fez before" in a comment is not an error.
export function withoutComments(style) {
  return style
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/[^\n]*/gm, (m, indent) => indent + ' '.repeat(m.length - indent.length));
}

function skipLineComment(script, i) {
  while (i < script.length && script[i] !== '\n') {
    i++;
  }
  return i;
}

function skipBlockComment(script, i) {
  i += 2;
  while (i < script.length && !(script[i] === '*' && script[i + 1] === '/')) {
    i++;
  }
  return i + 1;
}

function skipString(script, i, quote) {
  i++;
  while (i < script.length) {
    if (script[i] === '\\') {
      i++;
    } else if (script[i] === quote) {
      return i;
    }
    i++;
  }
  return script.length;
}

// Keywords after which a `/` opens a regex literal instead of dividing.
const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await',
]);

// A `/` divides when it follows a value (identifier, number, closing bracket,
// string); anywhere else it opens a regex literal.
function startsRegex(script, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(script[j])) {
    j--;
  }
  if (j < 0) {
    return true;
  }
  if (/[\w$]/.test(script[j])) {
    let start = j;
    while (start > 0 && /[\w$]/.test(script[start - 1])) {
      start--;
    }
    return REGEX_KEYWORDS.has(script.slice(start, j + 1));
  }
  return !')]}"\'`'.includes(script[j]);
}

// Skip a regex literal, returning the index of its closing `/`. Quotes inside
// (`/["']/`) must not open a string. A regex never spans lines, so hitting a
// newline means this was not one - stay put.
function skipRegex(script, i) {
  let inClass = false;
  for (let j = i + 1; j < script.length; j++) {
    const c = script[j];
    if (c === '\\') {
      j++;
    } else if (c === '\n') {
      return i;
    } else if (c === '[') {
      inClass = true;
    } else if (c === ']') {
      inClass = false;
    } else if (c === '/' && !inClass) {
      return j;
    }
  }
  return i;
}

// Skip past a `${...}` expression inside a template literal, returning the
// index of the matching `}`. Recurses into nested strings, templates and
// comments so braces inside them never desynchronise the depth count.
function skipTemplateExpression(script, i) {
  let depth = 0;
  while (i < script.length) {
    const c = script[i];
    const next = script[i + 1];
    if (c === '/' && next === '/') {
      i = skipLineComment(script, i);
    } else if (c === '/' && next === '*') {
      i = skipBlockComment(script, i);
    } else if (c === '/' && startsRegex(script, i)) {
      i = skipRegex(script, i);
    } else if (c === '"' || c === "'") {
      i = skipString(script, i, c);
    } else if (c === '`') {
      i = skipTemplate(script, i);
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
    i++;
  }
  return script.length;
}

function skipTemplate(script, i) {
  i++;
  while (i < script.length) {
    const c = script[i];
    if (c === '\\') {
      i += 2;
    } else if (c === '`') {
      return i;
    } else if (c === '$' && script[i + 1] === '{') {
      i = skipTemplateExpression(script, i + 1);
    } else {
      i++;
    }
  }
  return script.length;
}

// Find the first anonymous class (`class {` / `class{`) in a component script,
// skipping string, template and regex literals and line/block comments so prose
// like `const s = "class {"` never splits a component. Named classes
// (`class Foo {`) do not match - they are not the component delimiter.
export function findAnonymousClass(script) {
  for (let i = 0; i < script.length; i++) {
    const c = script[i];
    const next = script[i + 1];
    if (c === '/' && next === '/') {
      i = skipLineComment(script, i);
    } else if (c === '/' && next === '*') {
      i = skipBlockComment(script, i);
    } else if (c === '/' && startsRegex(script, i)) {
      i = skipRegex(script, i);
    } else if (c === '"' || c === "'") {
      i = skipString(script, i, c);
    } else if (c === '`') {
      i = skipTemplate(script, i);
    } else if (c === 'c' && script.startsWith('class', i)) {
      const match = /^class[ \t\r\n]*\{/.exec(script.slice(i));
      if (match) {
        return { index: i, match: match[0], end: i + match[0].length };
      }
    }
  }
  return null;
}

// Split a component script into its module-level preamble and the anonymous
// class body. Returns { preamble, body, hasClass }; when no anonymous class is
// present the whole script is the body (the implicit class-body form).
export function splitScript(script) {
  const found = findAnonymousClass(script);
  if (!found) {
    return { preamble: '', body: script, hasClass: false };
  }
  return {
    preamble: script.slice(0, found.index),
    body: script.slice(found.end),
    hasClass: true,
  };
}

export function assertStyleScope(tagName, rawStyle, isGlobal) {
  if (!rawStyle) {
    return;
  }
  const style = withoutComments(rawStyle);

  const fail = (message) => {
    throw new Error(`<${tagName}> style error: ${message}`);
  };

  if (!isGlobal && /(?:^|\s)body\s*\{/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.body);
  }
  if (/:host\b/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.host);
  }
  if (/:fez\b/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.fez);
  }
  if (isGlobal && /:global\(/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.globalInGlobal);
  }
}

// Template utility functions for the Fez template compiler
// Extracted to keep main parser file smaller

const JS_GLOBALS = new Set([
  'console',
  'window',
  'document',
  'globalThis',
  'Math',
  'JSON',
  'Date',
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'RegExp',
  'Error',
  'TypeError',
  'RangeError',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Symbol',
  'Intl',
  'URL',
  'URLSearchParams',
  'FormData',
  'Blob',
  'CustomEvent',
  'localStorage',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',
  'structuredClone',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'alert',
  'confirm',
  'prompt',
  'fetch',
  'event',
  'Fez',
  'fez',
]);

// Control-flow keywords that can be followed by `(`; prefixing them would
// produce `fez.if(`, `fez.return(` and the like.
const JS_KEYWORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'typeof',
  'function',
  'new',
  'delete',
  'void',
  'do',
  'else',
  'in',
  'of',
  'instanceof',
]);

// Template scope names a handler body reaches through the component
const COMPONENT_NAMES = new Set(['state', 'props', 'globalState']);

/**
 * Rewrite the identifiers of a JS snippet, skipping string literals, property
 * names (`a.name`) and object keys (`{ name: 1 }`). `fn(name, next)` gets the
 * identifier and the next non-space character, and returns its replacement.
 */
export function mapIdentifiers(code, fn) {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        j += code[j] === '\\' ? 2 : 1;
      }
      out += code.slice(i, j + 1);
      i = j + 1;
    } else if (/[0-9]/.test(ch)) {
      // whole number literal, so `1e5` never yields an identifier `e5`
      let j = i + 1;
      while (j < code.length && /[\w.]/.test(code[j])) {
        j++;
      }
      out += code.slice(i, j);
      i = j;
    } else if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < code.length && /[\w$]/.test(code[j])) {
        j++;
      }
      const name = code.slice(i, j);
      const before = out.trimEnd();
      const prev = before[before.length - 1];
      const next = code.slice(j).trimStart()[0];
      const isProperty = prev === '.' && before[before.length - 2] !== '.';
      const isKey = next === ':' && (prev === '{' || prev === ',');
      out += isProperty || isKey ? name : fn(name, next);
      i = j;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

// A bare call `save()` runs on the component, and `state.x` / `props.x` are
// the component's: handler bodies run as attribute code, outside the template scope
function prefixComponentNames(body, keep = []) {
  return mapIdentifiers(body, (name, next) => {
    if (keep.includes(name)) {
      return name;
    }
    if (COMPONENT_NAMES.has(name) || (next === '(' && !JS_GLOBALS.has(name) && !JS_KEYWORDS.has(name))) {
      return `fez.${name}`;
    }
    return name;
  });
}

/**
 * Parse loop binding to get params and detect object iteration
 */
export function parseLoopBinding(binding) {
  const isDestructured = binding.startsWith('[');

  if (isDestructured) {
    const match = binding.match(/^\[([^\]]+)\](?:\s*,\s*(\w+))?$/);
    if (match) {
      return {
        params: match[1].split(',').map((s) => s.trim()),
        indexParam: match[2] || null,
        isDestructured: true,
      };
    }
  }

  const parts = binding.split(',').map((s) => s.trim());

  // 2 params without brackets = destructuring
  // Runtime auto-converts: Array.isArray(c) ? c : Object.entries(c)
  if (parts.length === 2) {
    return { params: parts, indexParam: null, isDestructured: true };
  }

  return { params: parts, indexParam: null, isDestructured: false };
}

/**
 * Get loop variable names from binding. `implicitIndex` says whether the loop
 * binds the implicit `i` (see buildLoopParams).
 */
export function getLoopVarNames(binding, implicitIndex = true) {
  const parsed = parseLoopBinding(binding);
  const names = [...parsed.params];
  if (parsed.indexParam) {
    names.push(parsed.indexParam);
  }
  if (implicitIndex && !names.includes('i') && (parsed.params.length === 1 || parsed.isDestructured)) {
    names.push('i');
  }
  return names;
}

/**
 * Get loop item variables (non-index) from binding
 * These are variables that could be objects/arrays (not primitives like indices)
 */
export function getLoopItemVars(binding, objectPairs = false) {
  const parsed = parseLoopBinding(binding);
  // 2-param binding: for `{#each arr as value, index}` only the first is an
  // item; for `{#for key, value in obj}` both are (object keys/values).
  if (parsed.isDestructured && parsed.params.length === 2) {
    return objectPairs ? [parsed.params[0], parsed.params[1]] : [parsed.params[0]];
  }
  // For other destructured bindings, all params are item vars
  if (parsed.isDestructured) {
    return parsed.params;
  }
  // For {#each items as item, index}, only 'item' is the item var
  // For {#each obj as key, value, index}, 'key' and 'value' are item vars
  if (parsed.params.length >= 3) {
    // Last param is index, rest are item vars
    return parsed.params.slice(0, -1);
  }
  if (parsed.params.length === 2) {
    // Could be "item, index" - first is item, second is index
    return [parsed.params[0]];
  }
  // Single param is the item var
  return parsed.params;
}

/**
 * Build collection expression for iteration
 */
export function buildCollectionExpr(collection, binding) {
  const parsed = parseLoopBinding(binding);

  // 2-param destructuring uses Fez.toPairs for unified array/object handling
  // Array: ['a', 'b'] → [['a', 0], ['b', 1]] (value, index)
  // Object: {x: 1} → [['x', 1]] (key, value)
  if (parsed.isDestructured && parsed.params.length === 2) {
    return `Fez.toPairs(${collection})`;
  }

  // 3+ params: object iteration with explicit index
  if (parsed.isDestructured || parsed.params.length >= 3) {
    return `((_c)=>Array.isArray(_c)?_c:(_c&&typeof _c==="object")?Object.entries(_c):[])(${collection})`;
  }

  return `(${collection}||[])`;
}

/**
 * Build loop callback params. Every loop binds a hidden index `_fezI<depth>`,
 * unique per nesting level - auto keys and {#await} ids are built from it, so
 * nested loops never collide whatever the user named their variables. The
 * user's index name is a default parameter aliasing it.
 *
 * A destructured loop (`k, v` / `[a, b]`) also binds an implicit `i`, unless
 * an enclosing loop already has one: hiding the outer `i` would break
 * `pick(i, j)` style handlers.
 *
 * Returns { params, implicitIndex }.
 */
export function buildLoopParams(binding, depth = 0, outerVars = []) {
  const parsed = parseLoopBinding(binding);
  let head;
  let index;
  if (parsed.isDestructured) {
    head = '[' + parsed.params.join(', ') + ']';
    index =
      parsed.indexParam ||
      (parsed.params.includes('i') || outerVars.includes('i') ? null : 'i');
  } else if (parsed.params.length >= 3) {
    const params = [...parsed.params];
    index = params.pop();
    head = '[' + params.join(', ') + ']';
  } else {
    head = parsed.params[0];
    // an item named `i` moves the index to `_i`
    index = head === 'i' ? '_i' : 'i';
  }
  const hidden = `_fezI${depth}`;
  return {
    params: `${head}, ${hidden}, _fezA${depth}` + (index ? `, ${index} = ${hidden}` : ''),
    implicitIndex: index === 'i',
  };
}

/**
 * Check if expression is an arrow function
 */
export function isArrowFunction(expr) {
  // Match: () => ..., (e) => ..., (e, foo) => ..., e => ...
  return /^\s*(\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/.test(expr);
}

/**
 * Transform arrow function to onclick-compatible string
 * Input: "(e) => removeTask(index)" with loopVars = ['item', 'index', 'i']
 *
 * For loop variables that are item references (not indices), we store the handler
 * in fezGlobals to capture the value at render time. For index-only references,
 * we use simple interpolation since indices are primitives.
 *
 * Output for index-only: "fez.removeTask(${index})"
 * Output for item refs: "${'Fez(' + UID + ').fezGlobals.handler(' + fez.fezGlobals.setHandler((event) => fez.removeTask(item)) + ')(event)'}"
 */
export function transformArrowToHandler(expr, loopVars = [], loopItemVars = []) {
  // Extract the arrow function body
  const arrowMatch = expr.match(/^\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*(.+)$/s);
  if (!arrowMatch) {
    return expr;
  }

  let body = arrowMatch[1].trim();

  // Check if arrow has event param: (e) => or (event) => or e =>
  const paramMatch = expr.match(/^\s*\(?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*(?:,\s*[^)]+)?\)?\s*=>/);
  const eventParam = paramMatch?.[1];
  if (eventParam && eventParam !== 'event' && ['e', 'ev'].includes(eventParam)) {
    body = mapIdentifiers(body, (name) => (name === eventParam ? 'event' : name));
  }

  // Item variables (non-index loop vars, possibly objects) in the body
  const used = new Set();
  mapIdentifiers(body, (name) => {
    used.add(name);
    return name;
  });
  const usedItemVars = loopItemVars.filter((name) => used.has(name));

  // Item references: store the function in fezGlobals so the object is
  // captured at render time, and call it from the attribute. Handler slots are
  // positional per render; stale ones are dropped on commit.
  if (usedItemVars.length > 0) {
    body = prefixComponentNames(body, loopVars);
    return `\${'Fez(' + UID + ').fezGlobals.handler(' + fez.fezGlobals.setHandler((event) => ${body}) + ')(event)'}`;
  }

  // Index-only references are primitives - interpolate them at render time
  body = prefixComponentNames(body, loopVars);
  return mapIdentifiers(body, (name) => (loopVars.includes(name) ? `\${${name}}` : name));
}

/**
 * Extract a braced expression with proper depth counting
 */
export function extractBracedExpression(text, startIndex) {
  let depth = 0;
  let i = startIndex;

  while (i < text.length) {
    const char = text[i];
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return { expression: text.slice(startIndex + 1, i), endIndex: i };
      }
    } else if (char === '"' || char === "'" || char === '`') {
      // Skip string literals
      const quote = char;
      i++;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') {
          i++;
        }
        i++;
      }
    }
    i++;
  }
  throw new Error(`Unmatched brace at ${startIndex}`);
}

/**
 * Index of the `>` closing the tag whose attributes start at `pos`, skipping
 * quoted values and {expressions} (which may hold `>`, quotes or braces).
 * Returns -1 when the tag never closes.
 */
export function scanTagEnd(text, pos) {
  let j = pos;
  while (j < text.length) {
    const ch = text[j];
    if (ch === '"' || ch === "'") {
      const close = text.indexOf(ch, j + 1);
      if (close < 0) {
        return -1;
      }
      j = close + 1;
    } else if (ch === '{') {
      try {
        j = extractBracedExpression(text, j).endIndex + 1;
      } catch {
        j++;
      }
    } else if (ch === '>') {
      return j;
    } else {
      j++;
    }
  }
  return -1;
}

/**
 * Attributes of one tag (`<name ...>` or `<name .../>`), as
 * { name, value, quote, start, end }: `quote` is `"`, `'`, `{` or '' (bare or
 * no value), `start` is the whitespace before the attribute, `end` is exclusive.
 */
export function scanAttributes(tag) {
  const attrs = [];
  let j = tag.search(/[\s/>]/);
  while (j >= 0 && j < tag.length) {
    const start = j;
    while (/\s/.test(tag[j] || '')) {
      j++;
    }
    if (j >= tag.length || tag[j] === '>' || (tag[j] === '/' && tag[j + 1] === '>')) {
      break;
    }
    const nameStart = j;
    while (j < tag.length && !/[\s=>]/.test(tag[j]) && !(tag[j] === '/' && tag[j + 1] === '>')) {
      j++;
    }
    const attr = { name: tag.slice(nameStart, j), value: '', quote: '', start };
    if (j === nameStart) {
      j++;
      continue;
    }
    if (tag[j] === '=') {
      j++;
      const q = tag[j];
      if (q === '"' || q === "'") {
        const close = tag.indexOf(q, j + 1);
        attr.value = tag.slice(j + 1, close);
        attr.quote = q;
        j = close + 1;
      } else if (q === '{') {
        const { expression, endIndex } = extractBracedExpression(tag, j);
        attr.value = expression;
        attr.quote = '{';
        j = endIndex + 1;
      } else {
        const valueStart = j;
        while (j < tag.length && !/[\s>]/.test(tag[j])) {
          j++;
        }
        attr.value = tag.slice(valueStart, j);
      }
    }
    attr.end = j;
    attrs.push(attr);
  }
  return attrs;
}

/**
 * Rewrite every opening tag outside {expressions}: `fn(tag)` returns the new
 * tag text. Escaped braces (`\{`) are plain text.
 */
export function mapTags(text, fn) {
  let out = '';
  let pos = 0;
  while (pos < text.length) {
    const ch = text[pos];
    if (ch === '\\' && text[pos + 1] === '{') {
      out += '\\{';
      pos += 2;
    } else if (ch === '{') {
      let end;
      try {
        end = extractBracedExpression(text, pos).endIndex;
      } catch {
        end = pos;
      }
      out += text.slice(pos, end + 1);
      pos = end + 1;
    } else if (ch === '<' && /[a-zA-Z]/.test(text[pos + 1] || '')) {
      const end = scanTagEnd(text, pos + 1);
      if (end < 0) {
        out += text.slice(pos);
        break;
      }
      out += fn(text.slice(pos, end + 1));
      pos = end + 1;
    } else {
      out += ch;
      pos++;
    }
  }
  return out;
}

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'" };
const RAW_TEXT_RE = /<(script|style)\b[\s\S]*?<\/\1\s*>/gi;

/**
 * Decode HTML entities inside {expressions} only. For template source read
 * back from the DOM (`<template>.innerHTML`, a tag's outerHTML), which escapes
 * `<`, `>` and `&` - text and attributes are valid HTML as serialized, but an
 * expression needs its raw `a > b && c`. <script> and <style> bodies serialize
 * raw and are left alone.
 */
export function decodeExpressionEntities(text) {
  const raw = [];
  const masked = text.replace(RAW_TEXT_RE, (block) => {
    raw.push(block);
    return `\u0000${raw.length - 1}\u0000`;
  });
  let out = '';
  let pos = 0;
  while (pos < masked.length) {
    if (masked[pos] !== '{') {
      out += masked[pos++];
      continue;
    }
    let end;
    try {
      end = extractBracedExpression(masked, pos).endIndex;
    } catch {
      out += masked[pos++];
      continue;
    }
    out += masked.slice(pos, end + 1).replace(/&(?:lt|gt|amp|quot|#39);/g, (e) => ENTITIES[e]);
    pos = end + 1;
  }
  return out.replace(/\u0000(\d+)\u0000/g, (_, index) => raw[index]);
}

/**
 * Check if position is inside an attribute (attr={...})
 * Returns the attribute name if inside one, null otherwise
 */
export function getAttributeContext(text, pos) {
  // Look backwards for pattern like: attr={
  // We need to find the last '=' before pos that's preceded by an attribute name
  let j = pos - 1;
  // Skip whitespace and opening brace
  while (j >= 0 && (text[j] === '{' || text[j] === ' ' || text[j] === '\t')) {
    j--;
  }
  if (j >= 0 && text[j] === '=') {
    // Found '=', now look for attribute name
    j--;
    while (j >= 0 && (text[j] === ' ' || text[j] === '\t')) {
      j--;
    }
    // Extract attribute name
    const attrEnd = j + 1;
    while (j >= 0 && /[a-zA-Z0-9_:-]/.test(text[j])) {
      j--;
    }
    const attrName = text.slice(j + 1, attrEnd);
    if (
      attrName &&
      /^[a-zA-Z]/.test(attrName) &&
      (j < 0 || /\s/.test(text[j])) &&
      !quotedAttrContext(text, j)
    ) {
      return attrName.toLowerCase();
    }
  }
  return null;
}

/**
 * When `pos` sits inside an already-quoted attribute value of the enclosing
 * tag - the `{x}` in onclick="fez.rm('{x}')" or fez:in="fly, y={state.y}" -
 * returns { name } of that attribute, else null. {expressions} earlier in the
 * tag are skipped whole, so their quotes do not count.
 */
export function quotedAttrContext(text, pos) {
  const tagStart = text.lastIndexOf('<', pos);
  if (tagStart < 0) {
    return null;
  }
  let quote = null;
  let name = null;
  let k = tagStart;
  while (k < pos) {
    const ch = text[k];
    if (quote) {
      if (ch === quote) {
        quote = null;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      name = text.slice(tagStart, k).match(/([^\s=]+)\s*=\s*$/)?.[1] || '';
    } else if (ch === '{') {
      try {
        k = extractBracedExpression(text, k).endIndex;
      } catch {
        // unbalanced - treat as text
      }
    } else if (ch === '>') {
      return null; // tag closed before pos - we are in text content
    }
    k++;
  }
  return quote ? { name } : null;
}

/**
 * Check if position is inside an event attribute (onclick=, onchange=, etc.)
 * Returns the attribute name if inside one, null otherwise
 */
export function getEventAttributeContext(text, pos) {
  const attr = getAttributeContext(text, pos);
  if (attr && /^on[a-z]+$/.test(attr)) {
    return attr;
  }
  return null;
}

// <pre>/<textarea> bodies keep their whitespace as written
const PRESERVE_WHITESPACE_RE = /<(pre|textarea)\b[\s\S]*?<\/\1\s*>/gi;
// a whitespace-only run after a tag or {#..} {:..} {/..} directive and before the next one
const NODE_GAP_RE = /(>|\{[#:/][^{}]*\})\s+(?=<|\{[#:/])/g;

/**
 * Drop whitespace-only runs between nodes (`</div>  <div>` -> `</div><div>`).
 * Inter-node whitespace renders as a font-dependent space, so spacing belongs
 * in CSS or an explicit `{' '}`. Text keeps its own spaces.
 */
export function stripNodeWhitespace(text) {
  const kept = [...text.matchAll(PRESERVE_WHITESPACE_RE)].map((m) => [
    m.index,
    m.index + m[0].length,
  ]);
  return text.replace(NODE_GAP_RE, (gap, lead, offset) => {
    const start = offset + lead.length;
    return kept.some(([from, to]) => start >= from && start < to) ? gap : lead;
  });
}

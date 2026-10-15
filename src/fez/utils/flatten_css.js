// Flatten nested CSS into plain CSS.
//
// Fez has to support browsers older than native CSS nesting (Chrome 120 /
// Safari 17.2 / Firefox 117, late 2023), so the nesting cannot be left to the
// engine - anything it does not understand it drops silently. We parse the
// component's stylesheet and emit flat rules, the way goober used to and the
// way SCSS does.
//
// Selector resolution follows SCSS, not native nesting:
//
//   .a, .b { &:hover { } }   ->  .a:hover, .b:hover
//
// rather than native's `:is(.a, .b):hover`. Cartesian expansion keeps the
// specificity each selector would have had on its own, and needs no :is()
// support in the target engine.
//
// At-rules split three ways:
//   - conditional groups (@media, @supports, @container, @layer, @scope) wrap
//     back around the resolved selector, so a nested @media hoists outward
//   - @keyframes and friends cannot be nested at all and are emitted at the
//     top level, with their inner blocks (from/to/50%) left untouched
//   - statement at-rules (@import, @charset, `@layer a, b;`) are emitted first,
//     as required, wherever they were written

const CONDITIONAL = /^@(media|supports|container|layer|scope|document|starting-style)\b/i;
const VERBATIM =
  /^@(-\w+-)?(keyframes|font-face|property|counter-style|page|namespace|font-feature-values|viewport|position-try|view-transition)\b/i;
// @import, @charset and the block-less `@layer a, b;` order statement
const STATEMENT = /^@(import|charset|layer\s+[^{]*$)/i;

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

/**
 * Build a tree of { prelude, declarations[], children[] } from CSS text.
 * Strings, comments and parens are skipped so braces inside them - `content:
 * "}"`, `url(a{b})` - do not break the structure.
 */
function parse(css) {
  const root = { prelude: '', declarations: [], children: [] };
  const stack = [root];
  let buf = '';

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];

    // comment
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }

    // string - copy through verbatim
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) {
        if (css[j] === '\\') {
          j++;
        }
        j++;
      }
      buf += css.slice(i, j + 1);
      i = j;
      continue;
    }

    // parens - copy through verbatim, they can hold braces and semicolons
    if (ch === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < css.length && depth) {
        if (css[j] === '\\') {
          j += 2;
          continue;
        }
        if (css[j] === '(') {
          depth++;
        } else if (css[j] === ')') {
          depth--;
        }
        j++;
      }
      buf += css.slice(i, j);
      i = j - 1;
      continue;
    }

    if (ch === '{') {
      const node = { prelude: buf.trim(), declarations: [], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      buf = '';
      continue;
    }

    if (ch === '}') {
      const tail = buf.trim();
      if (tail) {
        stack[stack.length - 1].declarations.push(tail);
      }
      buf = '';
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    if (ch === ';') {
      const decl = buf.trim();
      if (decl) {
        stack[stack.length - 1].declarations.push(decl);
      }
      buf = '';
      continue;
    }

    buf += ch;
  }

  const tail = buf.trim();
  if (tail) {
    root.declarations.push(tail);
  }
  return root;
}

// ---------------------------------------------------------------------------
// selector resolution
// ---------------------------------------------------------------------------

// split on commas that are not inside parens, brackets or quotes -
// `:is(a, b)` and `[data-x="a,b"]` stay one part
function splitSelectors(selector) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let buf = '';
  for (const ch of selector) {
    if (quote) {
      if (ch === quote) {
        quote = null;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === ']') {
      depth--;
    }
    if (ch === ',' && !depth && !quote) {
      parts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) {
    parts.push(buf.trim());
  }
  return parts;
}

// end index (exclusive) of the :global( group that opens at start
function globalEnd(sel, start) {
  let depth = 1;
  let j = start + 8;
  while (j < sel.length && depth) {
    if (sel[j] === '(') {
      depth++;
    } else if (sel[j] === ')') {
      depth--;
    }
    j++;
  }
  return j;
}

// `.x :global(.a, .b)` -> ['.x :global(.a)', '.x :global(.b)']: a list inside
// :global would otherwise split the selector it sits in
function expandGlobalLists(sel) {
  const start = sel.indexOf(':global(');
  if (start < 0) {
    return [sel];
  }
  const end = globalEnd(sel, start);
  const items = splitSelectors(sel.slice(start + 8, end - 1));
  const rest = expandGlobalLists(sel.slice(end));
  return items.flatMap((item) => rest.map((tail) => `${sel.slice(0, start)}:global(${item})${tail}`));
}

// :global(x) -> x, with nested parens inside x (:global(:is(.a, .b) .c))
function unwrapGlobal(sel) {
  let out = '';
  let pos = 0;
  let start;
  while ((start = sel.indexOf(':global(', pos)) >= 0) {
    const j = globalEnd(sel, start);
    out += sel.slice(pos, start) + sel.slice(start + 8, j - 1);
    pos = j;
  }
  return (out + sel.slice(pos)).trim();
}

// Replace the nesting `&` with the parent, but not inside quoted attribute
// values (a[title="x&y"])
function replaceAmp(selector, parent) {
  return selector.replace(/"[^"]*"|'[^']*'|&/g, (m) => (m === '&' ? parent : m));
}

const hasAmp = (selector) => /&/.test(selector.replace(/"[^"]*"|'[^']*'/g, ''));

/**
 * Resolve a nested selector against its parents, SCSS style.
 *
 * A :global(...) selector is never scoped itself, Svelte style:
 *   :global(.x)          -> .x                (escapes the component)
 *   :global(.dark) .btn  -> .dark <parent> .btn (the global part sits above the scope)
 *   :global(.dark) & .b  -> .dark <parent> .b   (& places the scope explicitly)
 */
function resolve(parents, selector) {
  const out = [];

  for (const rawChild of splitSelectors(selector).flatMap(expandGlobalLists)) {
    if (/^:global\(/.test(rawChild) && !hasAmp(rawChild)) {
      const end = globalEnd(rawChild, 0);
      const head = rawChild.slice(8, end - 1).trim();
      const rest = rawChild.slice(end).trim();
      if (!rest || !parents.length) {
        out.push(unwrapGlobal(rawChild));
      } else {
        for (const parent of parents) {
          out.push(`${head} ${parent} ${unwrapGlobal(rest)}`);
        }
      }
      continue;
    }
    const child = unwrapGlobal(rawChild);

    if (!parents.length) {
      out.push(child);
      continue;
    }

    for (const parent of parents) {
      out.push(hasAmp(child) ? replaceAmp(child, parent) : `${parent} ${child}`);
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------

function serialize(node, parents, conditions, sink) {
  for (const child of node.children) {
    const prelude = child.prelude;

    if (VERBATIM.test(prelude)) {
      // cannot be nested in anything selector-shaped; keep its body as written
      sink.verbatim.push(wrap(conditions, `${prelude}{${stringifyRaw(child)}}`));
      continue;
    }

    if (CONDITIONAL.test(prelude)) {
      const inner = [...conditions, prelude];
      // `.a { @media ... { color: red } }` - the declarations belong to .a
      const declarations = takeStatements(child, sink);
      if (declarations.length && parents.length) {
        sink.rules.push(wrap(inner, `${parents.join(',')}{${declarations.join(';')};}`));
      }
      serialize(child, parents, inner, sink);
      continue;
    }

    if (STATEMENT.test(prelude)) {
      continue;
    } // handled from declarations

    const resolved = resolve(parents, prelude);
    const declarations = takeStatements(child, sink);
    if (declarations.length) {
      sink.rules.push(wrap(conditions, `${resolved.join(',')}{${declarations.join(';')};}`));
    }
    serialize(child, resolved, conditions, sink);
  }
}

// A statement at-rule (`@import x;`) parses as a declaration of the rule it
// sits in - a scoped <style> wraps everything in one rule. Move it out.
function takeStatements(node, sink) {
  return node.declarations.filter((d) => {
    if (STATEMENT.test(d)) {
      sink.statements.push(d);
      return false;
    }
    return true;
  });
}

// a verbatim at-rule's body is emitted as written, nested blocks and all
function stringifyRaw(node) {
  let out = node.declarations.length ? node.declarations.join(';') + ';' : '';
  for (const child of node.children) {
    out += `${child.prelude}{${stringifyRaw(child)}}`;
  }
  return out;
}

const wrap = (conditions, inner) => conditions.reduceRight((acc, cond) => `${cond}{${acc}}`, inner);

/**
 * @param {string} css - possibly nested CSS
 * @returns {string} flat CSS
 */
export default function flattenCss(css) {
  if (!css || !css.trim()) {
    return '';
  }

  const root = parse(css);
  // statement at-rules must come first in the sheet
  const sink = { rules: [], verbatim: [], statements: [] };
  takeStatements(root, sink);

  // bare declarations at the top level have no selector to belong to; the
  // caller wraps component CSS in :fez { } so this only happens in a global
  // block, where they are meaningless - drop them rather than emit broken CSS
  serialize(root, [], [], sink);

  return [...sink.statements.map((s) => s + ';'), ...sink.verbatim, ...sink.rules].join('\n');
}

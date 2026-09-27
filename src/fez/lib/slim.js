// Slim-like template dialect for the <slim> block, converted to a Fez template.
//
//   div.flex.gap-1.5#main title="x"   element, Tailwind-safe class shorthand
//   .card / #main                     div shorthand
//   p Some text / p | a=b as text     inline text (first token without `=`), `|` forces it
//   h1= expr / h1 == raw              inline output, stuck or spaced
//   li: a href="/" Home               inline nesting, the rest of the line is the only child
//   | text / {expr}                   text line
//   = expr / == raw                   {expr} / {@html raw}
//   - if / else if / elsif / else / unless / each / for / await / then / catch
//   - list.each do |item|             Ruby alias for `- each list as item`
//   / comment                         dropped with its children
//   <raw html>                        passed through
//
// Nodes are joined without whitespace, `#{expr}` becomes `{expr}`.

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
const OPENERS = new Set(['if', 'unless', 'each', 'for', 'await']);
const CONTINUATIONS = {
  if: ['else if', 'else'],
  unless: ['else'],
  each: ['else'],
  for: ['else'],
  await: ['then', 'catch'],
};
const KEYWORDS = '- if, - else if, - else, - unless, - each, - for, - await, - then, - catch';
const EACH_HINT = 'use `- each list as item` (or `- list.each do |item|`)';

/**
 * @param {string} source - dedented <slim> block content
 * @param {Object} [opts]
 * @param {boolean} [opts.pretty] - one node per line, indented, prefixed with the source line (dump only)
 * @param {number} [opts.lineOffset] - added to the line numbers of the pretty dump
 * @returns {{ html: string, map: Array<[number, number]>, errors: Array<{message, line, column}> }}
 */
export function slimToFez(source, { pretty = false, lineOffset = 0 } = {}) {
  const errors = [];
  const error = (message, line, column = 1) => errors.push({ message, line, column });
  const root = buildTree(readLines(source), error);
  const pieces = [];
  renderChildren(root.children, 0, pieces, error);

  if (pretty) {
    const html = pieces
      .map(
        (p) =>
          `${p.close ? '    ' : String(p.line + lineOffset).padStart(4)} | ${'  '.repeat(p.depth)}${p.text}`,
      )
      .join('\n');
    return { html, map: [], errors };
  }

  let html = '';
  const map = [];
  for (const piece of pieces) {
    map.push([html.length, piece.line]);
    html += piece.text;
  }
  return { html, map, errors };
}

/**
 * Source line of the first `{...}` in a converted template that is not valid
 * JS, for template compiler errors that carry no position. `map` is the
 * [outputOffset, sourceLine] list from slimToFez.
 */
export function locateSlimError(html, map) {
  const lineAt = (offset) => map.findLast(([start]) => start <= offset)?.[1] ?? null;
  for (let pos = html.indexOf('{'); pos !== -1; pos = html.indexOf('{', pos + 1)) {
    if (html[pos - 1] === '\\') {
      continue;
    }
    const end = braceEnd(html, pos);
    if (end === -1) {
      return lineAt(pos);
    }
    const expr = directiveExpression(html.slice(pos + 1, end).trim());
    if (expr && !isExpression(expr)) {
      return lineAt(pos);
    }
    pos = end;
  }
  return null;
}

function directiveExpression(body) {
  const directive = body.match(/^(#if|#unless|#await|:else if|@html|@json)\s+([\s\S]*)$/);
  if (directive) {
    return directive[2];
  }
  if (/^#each\s/.test(body)) {
    return body.slice(5).split(/\sas\s/)[0];
  }
  if (/^#for\s/.test(body)) {
    return body
      .split(/\sin\s/)
      .slice(1)
      .join(' in ');
  }
  return /^[#:/@]/.test(body) ? null : body;
}

function isExpression(expr) {
  try {
    new Function(`return (${expr});`);
    return true;
  } catch {
    return false;
  }
}

// Logical lines: a trailing ` \` joins the next physical line.
function readLines(source) {
  const lines = [];
  const physical = source.split(/\r?\n/);
  for (let i = 0; i < physical.length; i++) {
    const line = i + 1;
    let text = physical[i].replace(/\s+$/, '');
    while (/(^|\s)\\$/.test(text) && i + 1 < physical.length) {
      text = `${text.slice(0, -1).trimEnd()} ${physical[++i].trim()}`;
    }
    if (text.trim()) {
      const indent = text.match(/^[ \t]*/)[0];
      lines.push({ line, indent, column: indent.length + 1, text: text.slice(indent.length) });
    }
  }
  return lines;
}

function buildTree(lines, error) {
  const root = { indent: -1, children: [] };
  const stack = [root];
  let indentChar = null;

  for (const node of lines) {
    node.children = [];
    const width = node.indent.length;
    if (node.indent) {
      const chars = new Set(node.indent);
      indentChar ||= node.indent[0];
      if (chars.size > 1 || !chars.has(indentChar)) {
        error('Mixed tabs and spaces in indentation', node.line);
      }
    }

    while (stack.at(-1).indent >= width) {
      stack.pop();
    }
    const parent = stack.at(-1);
    if (parent.childIndent === undefined) {
      parent.childIndent = width;
    } else if (parent.childIndent !== width) {
      error(
        `Inconsistent indentation: expected ${parent.childIndent} columns, got ${width}`,
        node.line,
      );
    }
    node.indent = width;
    parent.children.push(node);
    stack.push(node);
  }

  return root;
}

function renderChildren(nodes, depth, out, error) {
  // adjacent text lines read as one sentence
  let prevText = false;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const control = node.text[0] === '-' ? parseControl(node, error) : null;

    if (!control) {
      const start = out.length;
      renderNode(node, depth, out, error);
      const piece = out[start];
      if (piece?.isText && prevText) {
        piece.text = ` ${piece.text}`;
      }
      prevText = !!piece?.isText;
      continue;
    }
    prevText = false;
    if (control.skip) {
      continue;
    }
    if (!OPENERS.has(control.keyword)) {
      error(`\`- ${control.keyword}\` without a matching opener`, node.line, node.column);
      continue;
    }

    out.push({
      text: `{#${control.keyword}${control.expr ? ` ${control.expr}` : ''}}`,
      line: node.line,
      depth,
    });
    renderChildren(node.children, depth + 1, out, error);

    // - else / - then / - catch siblings continue the open block
    const allowed = CONTINUATIONS[control.keyword];
    let closed = false;
    while (i + 1 < nodes.length && nodes[i + 1].text[0] === '-' && !closed) {
      const next = parseControl(nodes[i + 1], error);
      if (!next || next.skip || !allowed.includes(next.keyword)) {
        break;
      }
      i++;
      if (control.keyword === 'if' && next.keyword === 'else') {
        closed = true;
      }
      const expr = next.expr ? ` ${next.expr}` : '';
      out.push({ text: `{:${next.keyword}${expr}}`, line: nodes[i].line, depth });
      renderChildren(nodes[i].children, depth + 1, out, error);
    }

    out.push({ text: `{/${control.keyword}}`, line: node.line, depth, close: true });
  }
}

function parseControl(node, error) {
  if (node._control !== undefined) {
    return node._control;
  }
  const body = node.text.slice(1).trim();
  const fail = (message) => {
    error(message, node.line, node.column);
    return (node._control = { skip: true });
  };

  const ruby = body.match(/^(.+?)\.(each|each_with_index)\s+do\s*\|\s*([^|]*?)\s*\|$/);
  if (ruby) {
    if (!ruby[3]) {
      return fail(`Empty block parameters - ${EACH_HINT}`);
    }
    return (node._control = { keyword: 'each', expr: `${ruby[1]} as ${ruby[3]}` });
  }
  if (/\.(each|each_with_index|map|times|each_pair)\b/.test(body)) {
    return fail(`Unsupported Ruby iterator \`- ${body}\` - ${EACH_HINT}`);
  }

  const [, word = '', rest = ''] = body.match(/^(\S*)\s*(.*)$/);
  if (word === 'end') {
    return fail('`- end` is not needed - nesting comes from indentation');
  }
  if (word === 'elsif' || (word === 'else' && /^if\b/.test(rest))) {
    const expr = word === 'elsif' ? rest : rest.slice(2).trim();
    return expr
      ? (node._control = { keyword: 'else if', expr })
      : fail('`- else if` needs a condition');
  }
  if (!OPENERS.has(word) && !['else', 'then', 'catch'].includes(word)) {
    return fail(`Unknown \`- ${word}\` - use ${KEYWORDS}`);
  }
  if (['if', 'unless', 'await'].includes(word) && !rest) {
    return fail(`\`- ${word}\` needs an expression`);
  }
  if (word === 'each' && !/\sas\s/.test(` ${rest} `)) {
    return fail(`\`- each\` is missing " as " - ${EACH_HINT}`);
  }
  if (word === 'for' && !/\sin\s/.test(` ${rest} `)) {
    return fail('`- for` is missing " in " - use `- for item in list`');
  }
  if (word === 'else' && rest) {
    return fail('`- else` takes no expression - did you mean `- else if`?');
  }
  return (node._control = { keyword: word, expr: rest });
}

function renderNode(node, depth, out, error) {
  const { text, line, column } = node;
  const first = text[0];

  if (first === '/') {
    return;
  }
  if (first === '<') {
    out.push({ text: interpolate(text), line, depth });
    renderChildren(node.children, depth + 1, out, error);
    return;
  }
  if (first === '|' || first === '{' || text.startsWith('#{')) {
    const own = first === '|' ? text.slice(1).replace(/^ /, '') : text;
    const more = node.children.map((child) => childText(child));
    const joined = [own, ...more].filter(Boolean).join(' ');
    out.push({ text: interpolate(joined), line, depth, isText: true });
    return;
  }
  if (first === '=') {
    const output = renderOutput(text, node, error);
    if (output) {
      out.push({ text: output, line, depth });
    }
    if (node.children.length) {
      error('An output line cannot have children', node.children[0].line, node.children[0].column);
    }
    return;
  }
  if (!/[a-zA-Z.#]/.test(first)) {
    error(`Unexpected \`${first}\` - start text lines with \`| \``, line, column);
    return;
  }

  const el = parseElement(node, error);
  if (!el) {
    return;
  }
  const open = `<${el.tag}${el.attrs}>`;
  if (el.nested && !VOID_TAGS.has(el.tag)) {
    out.push({ text: open, line, depth });
    renderNode(el.nested, depth + 1, out, error);
    out.push({ text: `</${el.tag}>`, line, depth, close: true });
    return;
  }
  if (VOID_TAGS.has(el.tag)) {
    if (el.content || el.nested || node.children.length) {
      error(`<${el.tag}> is a void element and cannot have content`, line, column);
    }
    out.push({ text: open, line, depth });
    return;
  }
  if (!node.children.length) {
    out.push({ text: `${open}${el.content}</${el.tag}>`, line, depth });
    return;
  }
  out.push({ text: `${open}${el.content}`, line, depth });
  renderChildren(node.children, depth + 1, out, error);
  out.push({ text: `</${el.tag}>`, line, depth, close: true });
}

// Nested lines under a `|` text line continue the text
function childText(node) {
  const own = node.text[0] === '|' ? node.text.slice(1).trim() : node.text;
  return [own, ...node.children.map(childText)].filter(Boolean).join(' ');
}

function renderOutput(text, node, error) {
  const raw = text.startsWith('==');
  const expr = text.slice(raw ? 2 : 1).trim();
  if (!expr) {
    error(`Empty \`${raw ? '==' : '='}\` output`, node.line, node.column);
    return '';
  }
  return raw ? `{@html ${expr}}` : `{${expr}}`;
}

function parseElement(node, error) {
  const { text, line, column } = node;
  const fail = (message, offset = 0) => {
    error(message, line, column + offset);
    return null;
  };

  let pos = 0;
  let tag = 'div';
  const named = text.match(/^[a-zA-Z][\w-]*/);
  if (named) {
    tag = named[0];
    pos = tag.length;
    if (/[A-Z]/.test(tag)) {
      return fail(`Unknown tag \`${tag}\` - start text lines with \`| \``);
    }
  }

  const classes = [];
  let id = null;
  while (text[pos] === '.' || text[pos] === '#') {
    const kind = text[pos];
    const token = readShorthand(text, pos + 1);
    if (token.error) {
      return fail(token.error, pos);
    }
    if (!token.value) {
      return fail(`Empty ${kind === '.' ? 'class' : 'id'} after \`${kind}\``, pos);
    }
    if (kind === '#') {
      if (id) {
        return fail('Element has two ids', pos);
      }
      id = token.value;
    } else {
      classes.push(token.value);
    }
    pos = token.end;
  }

  // `li: a href="/" Home` - the rest of the line is the only child
  if (text[pos] === ':' && /\s/.test(text[pos + 1] || '')) {
    const start = pos + 1 + text.slice(pos + 1).match(/^\s*/)[0].length;
    return {
      tag,
      attrs: renderAttrs(classes, id, [], fail),
      content: '',
      nested: { text: text.slice(start), line, column: column + start, children: node.children },
    };
  }

  if (pos < text.length && !/[\s=]/.test(text[pos])) {
    return fail(`Unexpected \`${text[pos]}\` after tag`, pos);
  }

  const attrs = [];
  let content = '';
  while (pos < text.length) {
    if (text[pos] === '=') {
      content = renderOutput(text.slice(pos), node, error);
      break;
    }
    while (/\s/.test(text[pos] || '')) {
      pos++;
    }
    if (pos >= text.length) {
      break;
    }
    if (text[pos] === '=') {
      continue;
    }
    if (text[pos] === '|') {
      content = interpolate(text.slice(pos + 1).replace(/^ /, ''));
      break;
    }

    const name = text.slice(pos).match(/^[^\s="'{}|]+(?==)/);
    if (!name) {
      content = interpolate(text.slice(pos));
      break;
    }
    const valueStart = pos + name[0].length + 1;
    const value = readValue(text, valueStart);
    if (value.error) {
      return fail(value.error, valueStart);
    }
    attrs.push({ name: name[0], ...value });
    pos = value.end;
    if (pos < text.length && text[pos] !== '=' && !/\s/.test(text[pos])) {
      return fail(`Expected a space after attribute \`${name[0]}\``, pos);
    }
  }

  return { tag, attrs: renderAttrs(classes, id, attrs, fail), content };
}

// Class/id token: `.` splits unless inside [..]/(..) or a decimal (p-0.5);
// a top-level `=` or whitespace ends the tag token.
function readShorthand(text, start) {
  let depth = 0;
  let pos = start;
  for (; pos < text.length; pos++) {
    const ch = text[pos];
    if (ch === '[' || ch === '(') {
      depth++;
    } else if (ch === ']' || ch === ')') {
      depth--;
    } else if (depth === 0) {
      if (
        /\s/.test(ch) ||
        ch === '=' ||
        ch === '#' ||
        (ch === ':' && /\s/.test(text[pos + 1] || ''))
      ) {
        break;
      }
      if (ch === '.' && !isDecimalDot(text, pos, start)) {
        break;
      }
    }
  }
  if (depth > 0) {
    return { error: `Unclosed \`[\` or \`(\` in \`${text.slice(start, pos)}\`` };
  }
  return { value: text.slice(start, pos), end: pos };
}

// `.5` in p-0.5 / gap-1.5 / bg-black/2.5; `.2xl:flex` still starts a class
function isDecimalDot(text, pos, start) {
  if (pos === start || !/\d/.test(text[pos - 1])) {
    return false;
  }
  const digits = text.slice(pos + 1).match(/^\d+/);
  return !!digits && !/[a-zA-Z_-]/.test(text[pos + 1 + digits[0].length] || '');
}

function readValue(text, start) {
  const ch = text[start];
  if (ch === '"' || ch === "'") {
    const end = text.indexOf(ch, start + 1);
    if (end === -1) {
      return { error: `Unclosed ${ch} in attribute value` };
    }
    return { quote: ch, value: text.slice(start + 1, end), end: end + 1 };
  }
  if (ch === '{') {
    const end = braceEnd(text, start);
    if (end === -1) {
      return { error: 'Unclosed `{` in attribute value' };
    }
    return { expr: text.slice(start, end + 1), end: end + 1 };
  }
  const bare = text.slice(start).match(/^\S+/);
  if (!bare) {
    return { error: 'Missing attribute value - write `name=""` for a boolean attribute' };
  }
  return { quote: '"', value: bare[0], end: start + bare[0].length };
}

function braceEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') {
        i++;
      } else if (ch === quote) {
        quote = null;
      }
    } else if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

function renderAttrs(classes, id, attrs, fail) {
  let html = '';
  if (id !== null) {
    if (attrs.some((a) => a.name === 'id')) {
      fail('Element has both `#id` shorthand and an `id` attribute');
    }
    html += ` id="${escapeQuote(id)}"`;
  }

  const classAttr = attrs.find((a) => a.name === 'class');
  if (classes.length || classAttr) {
    const parts = classes.map(escapeQuote);
    if (classAttr) {
      parts.push(classAttr.expr ?? interpolate(classAttr.value));
    }
    html += ` class="${parts.join(' ')}"`;
  }

  for (const attr of attrs) {
    if (attr.name === 'class') {
      continue;
    }
    if (attr.expr) {
      html += ` ${attr.name}=${attr.expr}`;
    } else {
      html += ` ${attr.name}=${attr.quote}${interpolate(attr.value)}${attr.quote}`;
    }
  }
  return html;
}

function escapeQuote(value) {
  return value.replaceAll('"', '&quot;');
}

// Ruby `#{expr}` -> Fez `{expr}`
function interpolate(text) {
  let out = '';
  let pos = 0;
  while (pos < text.length) {
    const at = text.indexOf('#{', pos);
    if (at === -1) {
      break;
    }
    const end = braceEnd(text, at + 1);
    if (end === -1) {
      break;
    }
    out += `${text.slice(pos, at)}${text.slice(at + 1, end + 1)}`;
    pos = end + 1;
  }
  return out + text.slice(pos);
}

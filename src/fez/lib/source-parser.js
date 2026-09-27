import { slimToFez } from './slim.js';

const BLOCK_TAG_RE = /(^|\n)[ \t]*<(demo|info|script|head|style|slim)\b([^>]*)>/gi;
const DEFINITION_TAG_RE = /<(xmp|template)\b([^>]*)>/gi;
const GLOBAL_ATTR = /(?:^|\s)global(?:\s*=\s*(?:""|''|"global"|'global'|global))?(?=\s|$)/i;
const FEZ_ATTR = /(?:^|\s)fez\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i;
// `fez static` prepends this to every built file (HTML comment, or `//` for JS)
const GENERATED_NOTICE_RE =
  /^(?:<!-- |\/\/ )generated from src: [^\r\n|]* \| DO NOT EDIT OR READ THIS FILE(?: -->)?\r?\n?/;

export function stripGeneratedNotice(source) {
  return source.replace(GENERATED_NOTICE_RE, '');
}

function lineAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

function blockContent(raw) {
  return raw.replace(/^\r?\n/, '').replace(/\r?\n[ \t]*$/, '');
}

function contentLine(source, index, raw) {
  return lineAt(source, index) + (/^\r?\n/.test(raw) ? 1 : 0);
}

function findClosingTag(source, tag, from) {
  const close = new RegExp(`</${tag}\\s*>`, 'gi');
  close.lastIndex = from;
  return close.exec(source);
}

function appendBlock(result, type, content) {
  const repeatable = type === 'style' || type === 'styleGlobal';
  if (repeatable && result[type]) {
    result[type] += `\n${content}`;
  } else {
    result[type] = content;
  }
}

function minIndent(text) {
  const nonEmpty = text.split('\n').filter((line) => line.trim());
  return nonEmpty.length ? Math.min(...nonEmpty.map((line) => line.match(/^(\s*)/)[1].length)) : 0;
}

export function dedent(text) {
  const indent = minIndent(text);
  return indent
    ? text
        .split('\n')
        .map((line) => line.slice(indent))
        .join('\n')
    : text;
}

// "<slim> line 12:5: message" for Slim errors, the plain message otherwise
export function formatSourceError(error) {
  if (error.kind !== 'Slim') {
    return error.message;
  }
  return `<slim> line ${error.line}${error.column ? `:${error.column}` : ''}: ${error.message}`;
}

export function isGlobalStyleTag(attributes) {
  return GLOBAL_ATTR.test(attributes || '');
}

const LANG_ATTR = /\blang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const TAG_NAMES =
  'a|abbr|address|area|article|aside|audio|b|bdi|bdo|blockquote|br|button|canvas|caption|circle|cite|' +
  'code|col|colgroup|data|datalist|dd|defs|del|details|dfn|dialog|div|dl|dt|ellipse|em|embed|fieldset|' +
  'figcaption|figure|footer|form|g|h[1-6]|header|hgroup|hr|i|iframe|img|input|ins|kbd|label|legend|li|' +
  'line|main|map|mark|menu|meter|nav|noscript|object|ol|optgroup|option|output|p|path|picture|polygon|' +
  'polyline|pre|progress|q|rect|s|samp|section|select|slot|small|source|span|strong|sub|summary|sup|' +
  'svg|table|tbody|td|template|textarea|tfoot|th|thead|time|tr|track|u|ul|use|var|video|wbr';
// A template whose first line opens like Slim is Slim - no <slim> block needed.
// A bare tag word must be followed by shorthand, `: `, `=`, an attribute or the
// line end, so text templates such as `a new item` stay HTML.
const SLIM_START_RE = new RegExp(
  '^(?:' +
    '[.#][a-zA-Z_!@*\\[(-]' +
    `|(?:${TAG_NAMES}|[a-z][a-z0-9]*-[a-z0-9-]*)(?=[.#]|:\\s|=|\\s*$|\\s+[^\\s=]+=)` +
    '|-\\s*(?:if|unless|each|for|await)\\s' +
    '|-\\s*\\S.*\\.each(?:_with_index)?\\s+do\\s*\\|' +
    '|==?\\s' +
    ')',
);
const TYPE_ATTR = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const TS_LANGS = new Set(['ts', 'typescript']);
const TS_TYPES = new Set(['ts', 'text/typescript']);

// `<script lang="ts">` (or type="text/typescript") marks a block the bundler
// plugin or CLI must strip before the runtime can evaluate it.
export function isTypeScriptTag(attributes) {
  const lang = LANG_ATTR.exec(attributes || '');
  if (lang && TS_LANGS.has((lang[1] ?? lang[2] ?? lang[3] ?? '').toLowerCase())) {
    return true;
  }
  const type = TYPE_ATTR.exec(attributes || '');
  return !!type && TS_TYPES.has((type[1] ?? type[2] ?? type[3] ?? '').toLowerCase());
}

export function parseFezSource(source, { dedentDocs = false } = {}) {
  const result = {
    script: '',
    scriptLang: null,
    style: '',
    styleGlobal: '',
    html: '',
    slim: '',
    template: { lang: 'html', map: null },
    head: '',
    demo: '',
    info: '',
    blocks: [],
    errors: [],
  };
  const counts = new Map();
  const segments = [];
  let cursor = 0;
  let match;

  BLOCK_TAG_RE.lastIndex = 0;
  while ((match = BLOCK_TAG_RE.exec(source))) {
    const openStart = match.index + match[1].length;
    const tag = match[2].toLowerCase();
    const type = tag === 'style' && isGlobalStyleTag(match[3]) ? 'styleGlobal' : tag;
    const rawStart = BLOCK_TAG_RE.lastIndex;
    const close = findClosingTag(source, tag, rawStart);

    result.html += source.slice(cursor, openStart);
    segments.push([cursor, openStart]);

    if (!close) {
      result.errors.push({
        kind: 'Source',
        message: `Unclosed <${tag}> block`,
        line: lineAt(source, openStart),
      });
      cursor = source.length;
      break;
    }

    const raw = source.slice(rawStart, close.index);
    let content = blockContent(raw);
    // Script/style/head keep their relative indentation - per-line trim would
    // corrupt multi-line strings and template literals.
    if (type !== 'demo' && type !== 'info') {
      content = dedent(content);
    }
    if (dedentDocs && (type === 'demo' || type === 'info')) {
      content = dedent(content);
    }

    const count = (counts.get(type) || 0) + 1;
    counts.set(type, count);
    if (count > 1 && type !== 'style' && type !== 'styleGlobal') {
      result.errors.push({
        kind: 'Source',
        message: `Duplicate <${tag}> block`,
        line: lineAt(source, openStart),
      });
    }

    const lang = type === 'script' && isTypeScriptTag(match[3]) ? 'ts' : null;
    if (lang) {
      result.scriptLang = lang;
    }

    const block = {
      type,
      tag,
      content,
      lang,
      line: lineAt(source, openStart),
      contentLine: contentLine(source, rawStart, raw),
      indent: minIndent(blockContent(raw)),
    };
    result.blocks.push(block);
    appendBlock(result, type, content);

    cursor = close.index + close[0].length;
    BLOCK_TAG_RE.lastIndex = cursor;
  }

  result.html += source.slice(cursor);
  segments.push([cursor, source.length]);
  result.html = stripGeneratedNotice(result.html);

  const slim = result.blocks.find((block) => block.type === 'slim');
  if (slim) {
    if (withoutComments(result.html).trim()) {
      result.errors.push({
        kind: 'Source',
        message: '<slim> block and an HTML template are both present - keep one',
        line: slim.line,
      });
    }
    applySlim(result, slim);
  } else {
    const detected = detectSlim(source, segments);
    if (detected) {
      applySlim(result, detected);
    }
  }
  return result;
}

function withoutComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

// The template outside the blocks, when its first line reads as Slim.
// segments are the [start, end] source ranges between blocks.
function detectSlim(source, segments) {
  const filled = segments
    .map(([start, end]) => ({ start, text: source.slice(start, end) }))
    .filter((segment) => withoutComments(stripGeneratedNotice(segment.text)).trim());
  if (filled.length !== 1) {
    return null;
  }

  const { start, text } = filled[0];
  const first = text.match(/^[ \t]*\S/m);
  if (!first || !SLIM_START_RE.test(text.slice(first.index).split('\n')[0].trim())) {
    return null;
  }

  const lineStart = start + first.index;
  const raw = source.slice(lineStart, start + text.length).replace(/\s+$/, '');
  const line = lineAt(source, lineStart);
  return { content: dedent(raw), contentLine: line, indent: minIndent(raw), line };
}

function applySlim(result, block) {
  const { html, map, errors } = slimToFez(block.content);
  result.html = html;
  result.template = {
    lang: 'slim',
    line: block.line,
    content: block.content,
    contentLine: block.contentLine,
    map: map.map(([offset, line]) => [offset, block.contentLine + line - 1]),
  };
  for (const error of errors) {
    result.errors.push({
      kind: 'Slim',
      message: error.message,
      line: block.contentLine + error.line - 1,
      column: error.column + block.indent,
    });
  }
}

function protectedRanges(source) {
  const ranges = [];
  const open = /(^|\n)[ \t]*<(demo|info)\b[^>]*>/gi;
  let match;

  while ((match = open.exec(source))) {
    const close = findClosingTag(source, match[2], open.lastIndex);
    if (!close) {
      break;
    }
    ranges.push([match.index + match[1].length, close.index + close[0].length]);
    open.lastIndex = close.index + close[0].length;
  }

  return ranges;
}

export function extractFezDefinitions(source) {
  const definitions = [];
  const errors = [];
  const protectedSections = protectedRanges(source);
  let match;

  DEFINITION_TAG_RE.lastIndex = 0;
  while ((match = DEFINITION_TAG_RE.exec(source))) {
    const openStart = match.index;
    if (protectedSections.some(([start, end]) => openStart >= start && openStart < end)) {
      continue;
    }

    const fez = match[2].match(FEZ_ATTR);
    if (!fez) {
      continue;
    }

    const tag = match[1].toLowerCase();
    const name = fez[1] || fez[2] || fez[3];
    const rawStart = DEFINITION_TAG_RE.lastIndex;
    const close = findClosingTag(source, tag, rawStart);
    if (!close) {
      errors.push({
        kind: 'Source',
        message: `Unclosed <${tag} fez="${name}"> definition`,
        line: lineAt(source, openStart),
      });
      break;
    }

    const raw = source.slice(rawStart, close.index);
    definitions.push({
      name,
      tag,
      source: blockContent(raw),
      line: lineAt(source, openStart),
      contentLine: contentLine(source, rawStart, raw),
      start: openStart,
      end: close.index + close[0].length,
    });
    DEFINITION_TAG_RE.lastIndex = close.index + close[0].length;
  }

  return { definitions, errors };
}

// Everything outside the <xmp fez>/<template fez> definitions. Each definition
// carries its own script/style/html, so a caller reading the file-level
// <info>/<demo> must not see the per-component blocks - otherwise a file with
// two components looks like it has duplicate <script> blocks.
export function stripFezDefinitions(source) {
  const { definitions } = extractFezDefinitions(source);
  if (!definitions.length) {
    return source;
  }

  let outer = '';
  let cursor = 0;

  for (const definition of definitions) {
    outer += source.slice(cursor, definition.start);
    cursor = definition.end;
  }

  return outer + source.slice(cursor);
}

export function hasFezDefinitions(source) {
  return extractFezDefinitions(source).definitions.length > 0;
}

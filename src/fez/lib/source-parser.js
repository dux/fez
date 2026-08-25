const BLOCK_TAG_RE = /(^|\n)[ \t]*<(demo|info|script|head|style)\b([^>]*)>/gi;
const DEFINITION_TAG_RE = /<(xmp|template)\b([^>]*)>/gi;
const GLOBAL_ATTR = /(?:^|\s)global(?:\s*=\s*(?:""|''|"global"|'global'|global))?(?=\s|$)/i;
const FEZ_ATTR = /(?:^|\s)fez\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i;
const GENERATED_NOTICE_RE =
  /^<!-- generated from src: fez-static\/root\/[^\r\n]* \| DO NOT EDIT OR READ THIS FILE -->\r?\n?/;

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

export function dedent(text) {
  const lines = text.split('\n');
  const nonEmpty = lines.filter((line) => line.trim());
  if (!nonEmpty.length) {
    return text;
  }

  const indent = Math.min(...nonEmpty.map((line) => line.match(/^(\s*)/)[1].length));
  return indent ? lines.map((line) => line.slice(indent)).join('\n') : text;
}

export function isGlobalStyleTag(attributes) {
  return GLOBAL_ATTR.test(attributes || '');
}

export function parseFezSource(source, { dedentDocs = false } = {}) {
  const result = {
    script: '',
    style: '',
    styleGlobal: '',
    html: '',
    head: '',
    demo: '',
    info: '',
    blocks: [],
    errors: [],
  };
  const counts = new Map();
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
    if (type !== 'demo' && type !== 'info') {
      content = content
        .split('\n')
        .map((line) => line.trim())
        .join('\n');
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

    const block = {
      type,
      tag,
      content,
      line: lineAt(source, openStart),
      contentLine: contentLine(source, rawStart, raw),
    };
    result.blocks.push(block);
    appendBlock(result, type, content);

    cursor = close.index + close[0].length;
    BLOCK_TAG_RE.lastIndex = cursor;
  }

  result.html += source.slice(cursor);
  result.html = result.html.replace(GENERATED_NOTICE_RE, '');
  return result;
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

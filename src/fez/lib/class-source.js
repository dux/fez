// Assemble a component class source from parsed .fez parts. Shared by the
// runtime compiler (compile.js), the bundler plugin (compile-module.js) and
// `fez compile`, so all three emit the same class.

import { splitScript } from './validate.js';

// <pre>/<textarea> bodies keep their indentation
const PRESERVE_RE = /<(pre|textarea)\b[\s\S]*?<\/\1\s*>/gi;

export function escapeTemplateLiteral(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('$', '\\$');
}

/**
 * Trim every template line, except inside <pre> and <textarea>.
 */
export function trimTemplateLines(html) {
  const kept = [];
  const masked = String(html).replace(PRESERVE_RE, (block) => {
    kept.push(block);
    return `\u0000${kept.length - 1}\u0000`;
  });
  return masked
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => kept[index]);
}

/**
 * Wrap a bare script body in `class { }` and append the CSS, CSS_GLOBAL and
 * HTML fields as template literals.
 */
export function buildClassSource(parts) {
  const [style, styleGlobal, html] = [parts.style, parts.styleGlobal, parts.html].map((v) =>
    String(v || ''),
  );
  let klass = parts.script || '';
  if (!splitScript(klass).hasClass) {
    klass = `class {\n${klass}\n}`;
  }

  // function replacer: the field source may contain `$&` and friends
  const addField = (field) => {
    klass = klass.replace(/\}\s*$/, () => `\n  ${field}\n}`);
  };

  if (style.trim()) {
    addField(`CSS = \`:fez {\n${escapeTemplateLiteral(style)}\n}\``);
  }
  if (styleGlobal.trim()) {
    addField(`CSS_GLOBAL = \`${escapeTemplateLiteral(styleGlobal)}\``);
  }
  if (/\w/.test(html)) {
    addField(`HTML = \`${escapeTemplateLiteral(html.trim())}\``);
  }

  return klass;
}

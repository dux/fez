/**
 * Build-time compiler: turn a .fez source into an ES module.
 *
 * The module reads the fez runtime from `window.Fez` (the runtime is loaded once
 * by the host page), defines the component class, registers it with
 * `Fez(name, Klass)` and default-exports the class. All checks run at build time:
 * component name, script syntax, style scope and template compilation (strict).
 *
 * The runtime `<script fez="...">` / `Fez.compile` path is unchanged; this is
 * the bundler entry used by the Vite and Rollup plugins.
 */

import path from 'node:path';
import { extractFezDefinitions, parseFezSource } from './lib/source-parser.js';
import { assertStyleScope, splitScript } from './lib/validate.js';
import { stripTypeScript } from './lib/strip-types.js';
import createTemplate from './lib/template.js';

function escapeTemplateLiteral(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('$', '\\$');
}

function escapeHtmlLiteral(value) {
  return value.replaceAll('`', '&#x60;').replaceAll('$', '\\$');
}

function normalizeHtml(html) {
  return html
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
}

function assertName(name) {
  if (!name.includes('-')) {
    throw new Error(
      `Invalid component name "${name}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`,
    );
  }
}

function assertScriptSyntax(name, script) {
  if (!script.trim()) {
    return;
  }
  const withoutImports = script.replace(/^\s*import\s.*$/gm, '');
  const { preamble, body, hasClass } = splitScript(withoutImports);
  try {
    if (hasClass) {
      if (preamble.trim()) {
        new Function(preamble);
      }
      new Function(`return (class {${body})`);
    } else {
      new Function(`return (class {${body}})`);
    }
  } catch (error) {
    throw new Error(`<${name}> script error: ${error.message}`);
  }
}

function assertTemplate(name, html) {
  if (!html.trim()) {
    return;
  }
  try {
    createTemplate(html, { name, strict: true });
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * Compile a single component into a JS module body. Returns
 * `{ preamble, classCode, registration }` strings, or throws on any error.
 */
function compileUnit(name, source, { minify }) {
  const parts = parseFezSource(source, { dedentDocs: true });
  if (parts.errors.length) {
    throw new Error(parts.errors[0].message);
  }

  assertName(name);
  let klass = parts.script;
  if (parts.scriptLang === 'ts') {
    try {
      klass = stripTypeScript(klass);
    } catch (error) {
      const location = error.location;
      throw new Error(
        location
          ? `${error.message} (line ${location.line}, column ${location.column})`
          : error.message,
      );
    }
  }
  assertScriptSyntax(name, klass);
  assertStyleScope(name, parts.style, false);
  assertStyleScope(name, parts.styleGlobal, true);
  parts.html = normalizeHtml(parts.html);
  assertTemplate(name, parts.html);

  if (!splitScript(klass).hasClass) {
    klass = `class {\n${klass}\n}`;
  }

  if (String(parts.style).includes(':')) {
    const css = escapeTemplateLiteral(parts.style);
    klass = klass.replace(/\}\s*$/, `\n  CSS = \`:fez {\n${css}\n}\`\n}`);
  }
  if (String(parts.styleGlobal).includes(':')) {
    const cssGlobal = escapeTemplateLiteral(parts.styleGlobal);
    klass = klass.replace(/\}\s*$/, `\n  CSS_GLOBAL = \`${cssGlobal}\`\n}`);
  }
  if (/\w/.test(String(parts.html))) {
    klass = klass.replace(/\}\s*$/, `\n  HTML = \`${escapeHtmlLiteral(parts.html.trim())}\`\n}`);
  }

  const { preamble, body } = splitScript(klass);
  const metadata = [];
  if (!minify && parts.info?.trim()) {
    metadata.push(`Fez.index.ensure('${name}').info = ${JSON.stringify(parts.info)};`);
  }
  if (!minify && parts.demo?.trim()) {
    metadata.push(`Fez.index.ensure('${name}').demo = ${JSON.stringify(parts.demo)};`);
  }

  return { preamble: preamble.trim(), classBody: body, registration: metadata.join('\n') };
}

/**
 * Compile a .fez file into a complete ES module source string.
 *
 * @param {string} filePath - Absolute path, used for the default component name
 * @param {string} source - .fez source
 * @param {Object} [options]
 * @param {boolean} [options.minify=false] - drop <info>/<demo> metadata
 * @returns {string}
 */
export function compileFileToModule(filePath, source, options = {}) {
  const minify = options.minify === true;

  const { definitions } = extractFezDefinitions(source);
  const units = definitions.length
    ? definitions.map((definition) => ({ name: definition.name, source: definition.source }))
    : [{ name: path.basename(filePath, '.fez'), source }];

  const preambles = [];
  const classBlocks = [];
  const registrations = [];
  const varNames = [];

  units.forEach((unit, index) => {
    const compiled = compileUnit(unit.name, unit.source, { minify });
    const varName = `__fez_component_${index}`;
    varNames.push(varName);
    if (compiled.preamble) {
      preambles.push(`// --- ${unit.name} ---\n${compiled.preamble}`);
    }
    classBlocks.push(`const ${varName} = class {${compiled.classBody}`);
    registrations.push(`Fez('${unit.name}', ${varName});`);
    if (compiled.registration) {
      registrations.push(compiled.registration);
    }
  });

  const lines = [
    `const Fez = window.Fez;`,
    `if (!Fez) throw new Error('fez runtime not loaded: load fez (window.Fez) before component modules');`,
    '',
    ...preambles,
    preambles.length ? '' : null,
    ...classBlocks,
    '',
    ...registrations,
    '',
    `export default ${varNames[0]};`,
    '',
  ].filter((line) => line !== null);

  return lines.join('\n');
}

/**
 * Build-time compiler: turn a .fez source into an ES module.
 *
 * The module imports the fez runtime, defines the component class, registers it
 * with `Fez(name, Klass)` and default-exports the class. All checks run at
 * build time: component name, script syntax, style scope and template
 * compilation (strict).
 *
 * The runtime `<script fez="...">` / `Fez.compile` path is unchanged; this is
 * the bundler entry used by the Vite and Rollup plugins.
 */

import path from 'node:path';
import { extractFezDefinitions, parseFezSource } from './lib/source-parser.js';
import { assertStyleScope } from './lib/validate.js';
import createTemplate from './lib/template.js';

const DEFAULT_RUNTIME = '@dinoreic/fez';

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
  const match = withoutImports.match(/class\s+\{/);
  try {
    if (match) {
      const preamble = withoutImports.slice(0, match.index);
      if (preamble.trim()) {
        new Function(preamble);
      }
      new Function(`return (class {${withoutImports.slice(match.index + match[0].length)})`);
    } else {
      new Function(`return (class {${withoutImports}})`);
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
  assertScriptSyntax(name, parts.script);
  assertStyleScope(name, parts.style, false);
  assertStyleScope(name, parts.styleGlobal, true);
  parts.html = normalizeHtml(parts.html);
  assertTemplate(name, parts.html);

  let klass = parts.script;
  if (!/class\s+\{/.test(klass)) {
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

  const classMatch = klass.match(/class\s+\{/);
  const preamble = classMatch ? klass.slice(0, classMatch.index).trim() : '';
  const body = classMatch ? klass.slice(classMatch.index + classMatch[0].length) : klass;

  const metadata = [];
  if (!minify && parts.info?.trim()) {
    metadata.push(`Fez.index.ensure('${name}').info = ${JSON.stringify(parts.info)};`);
  }
  if (!minify && parts.demo?.trim()) {
    metadata.push(`Fez.index.ensure('${name}').demo = ${JSON.stringify(parts.demo)};`);
  }

  return { preamble, classBody: body, registration: metadata.join('\n') };
}

/**
 * Compile a .fez file into a complete ES module source string.
 *
 * @param {string} filePath - Absolute path, used for the default component name
 * @param {string} source - .fez source
 * @param {Object} [options]
 * @param {string} [options.runtime='@dinoreic/fez'] - specifier to import Fez from
 * @param {boolean} [options.minify=false] - drop <info>/<demo> metadata
 * @returns {string}
 */
export function compileFileToModule(filePath, source, options = {}) {
  const runtime = options.runtime || DEFAULT_RUNTIME;
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
    `import { Fez } from '${runtime}';`,
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

export { DEFAULT_RUNTIME };

/**
 * Build-time compiler: turn a .fez source into an ES module.
 *
 * The module reads the fez runtime from `window.Fez` (the runtime is loaded once
 * by the host page), defines the component class, registers it with
 * `Fez(name, Klass)` and default-exports the class. All checks run at build time:
 * component name, script syntax, style scope and template compilation (strict).
 * The template itself is compiled into the module (`Klass.FEZ_TEMPLATE`), so the
 * browser evaluates no code from strings (see lib/template-precompile.js).
 *
 * The runtime `<script fez="...">` / `Fez.compile` path is unchanged; this is
 * the bundler entry used by the Vite and Rollup plugins.
 */

import path from 'node:path';
import { extractFezDefinitions, formatSourceError, parseFezSource } from './lib/source-parser.js';
import { assertStyleScope, splitScript, IMPORT_RE } from './lib/validate.js';
import { stripTypeScript } from './lib/strip-types.js';
import { precompileTemplate } from './lib/template-precompile.js';
import { locateSlimError } from './lib/slim.js';
import { buildClassSource, trimTemplateLines } from './lib/class-source.js';
import minifyCss from './lib/minify-css.js';

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
  const withoutImports = script.replace(IMPORT_RE, '');
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

// The template as module code (see lib/template-precompile.js), or null
function compileTemplate(name, html, template) {
  if (!/\w/.test(html)) {
    return null;
  }
  try {
    return precompileTemplate(html, { name });
  } catch (error) {
    const line = template.lang === 'slim' ? locateSlimError(html, template.map) : null;
    const message = `FEZ template compile error in <${name}>: ${error.message}`;
    throw new Error(line ? `<slim> line ${line}: ${message}` : message);
  }
}

/**
 * Compile a single component into a JS module body. Returns
 * `{ preamble, classCode, registration }` strings, or throws on any error.
 */
function compileUnit(name, source, { minify }) {
  const parts = parseFezSource(source, { dedentDocs: true });
  if (parts.errors.length) {
    throw new Error(formatSourceError(parts.errors[0]));
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
  parts.html = trimTemplateLines(parts.html);
  const template = compileTemplate(name, parts.html, parts.template);

  if (minify) {
    parts.style = minifyCss(parts.style);
    parts.styleGlobal = minifyCss(parts.styleGlobal);
  }
  klass = buildClassSource({ ...parts, script: klass, html: '' });

  const { preamble, body } = splitScript(klass);
  const metadata = [];
  if (!minify && parts.info?.trim()) {
    metadata.push(`Fez.index.ensure('${name}').info = ${JSON.stringify(parts.info)};`);
  }
  if (!minify && parts.demo?.trim()) {
    metadata.push(`Fez.index.ensure('${name}').demo = ${JSON.stringify(parts.demo)};`);
  }

  return {
    preamble: preamble.trim(),
    classBody: body,
    head: parts.head?.trim() || '',
    template,
    registration: metadata.join('\n'),
  };
}

/**
 * Compile a .fez file into a complete ES module source string.
 *
 * @param {string} filePath - Absolute path, used for the default component name
 * @param {string} source - .fez source
 * @param {Object} [options]
 * @param {boolean} [options.minify=false] - drop <info>/<demo> metadata and minify component CSS
 * @returns {string}
 */
export function compileFileToModule(filePath, source, options = {}) {
  const minify = options.minify === true;

  const { definitions, errors } = extractFezDefinitions(source);
  if (errors.length) {
    throw new Error(formatSourceError(errors[0]));
  }
  const units = definitions.length
    ? definitions.map((definition) => ({ name: definition.name, source: definition.source }))
    : [{ name: path.basename(filePath, '.fez'), source }];

  const imports = [];
  const classBlocks = [];
  const registrations = [];
  const varNames = [];

  units.forEach((unit, index) => {
    const compiled = compileUnit(unit.name, unit.source, { minify });
    const varName = `__fez_component_${index}`;
    varNames.push(varName);
    // imports go to the module top (deduped); the rest of each preamble gets a
    // block of its own, so two components may both declare `const helper`
    const preamble = compiled.preamble.replace(IMPORT_RE, (statement) => {
      if (!imports.includes(statement.trim())) {
        imports.push(statement.trim());
      }
      return '';
    });
    const head = compiled.head ? `Fez.head(${JSON.stringify(compiled.head)});\n` : '';
    // the template sits outside the preamble block: like a runtime template it
    // sees the component and globals, not the script's module-level names
    const template = compiled.template
      ? `${varName}.FEZ_TEMPLATE = { render: __fez_template_${index}, slotUnwrap: ${compiled.template.slotUnwrap} };\n`
      : '';
    const render = compiled.template ? `const __fez_template_${index} = ${compiled.template.code};\n` : '';
    classBlocks.push(
      `// --- ${unit.name} ---\nlet ${varName};\n${render}{\n${head}${preamble.trim()}\n${varName} = class {${compiled.classBody};\n}\n${template}`,
    );
    registrations.push(`Fez('${unit.name}', ${varName});`);
    if (compiled.registration) {
      registrations.push(compiled.registration);
    }
  });

  const lines = [
    ...imports,
    imports.length ? '' : null,
    `const Fez = window.Fez;`,
    `if (!Fez) throw new Error('fez runtime not loaded: load fez (window.Fez) before component modules');`,
    '',
    ...classBlocks,
    '',
    ...registrations,
    '',
    `export default ${varNames[0]};`,
    '',
  ].filter((line) => line !== null);

  return lines.join('\n');
}

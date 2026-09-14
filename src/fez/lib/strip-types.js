// Build-time TypeScript stripping for <script lang="ts"> blocks.
//
// The browser cannot evaluate TypeScript and the runtime compiler has no
// transpiler, so this only runs in the bundler plugin and the `fez compile`
// CLI. esbuild is imported lazily: Vite already ships it, and a Rollup user
// only needs to install it to use `.fez` TypeScript.
//
// The script is transformed in a single esbuild pass: the anonymous component
// class is given a placeholder name so the whole module (preamble + class) is
// valid TypeScript and esbuild can see every type-only usage. The placeholder
// is swapped back to `class {` afterwards, keeping the delimiter the rest of
// the compiler expects.

import { createRequire } from 'node:module';
import { findAnonymousClass } from './validate.js';

const require = createRequire(import.meta.url);
const PLACEHOLDER = '__FEZ_TS_CLASS__';
const PLACEHOLDER_RE = /\bclass\s+__FEZ_TS_CLASS__\s*\{/;
// `class {` -> `class __FEZ_TS_CLASS__ {` shifts columns at/after the `{` by
// the name plus its trailing space, on the declaration line only.
const COLUMN_SHIFT = PLACEHOLDER.length + 1;
const BRACE_COLUMN = 'class '.length + COLUMN_SHIFT;

let esbuild;

function transpile(code) {
  if (!esbuild) {
    try {
      esbuild = require('esbuild');
    } catch {
      throw new Error(
        'Fez <script lang="ts"> needs esbuild. Vite includes it; for Rollup add esbuild as a dependency.',
      );
    }
  }
  return esbuild.transformSync(code, { loader: 'ts', target: 'esnext' }).code;
}

function tsError(error, baseLine, classLine) {
  const entry = error.errors?.[0];
  const message = entry?.text || error.message;
  const result = new Error(`Fez TypeScript error: ${message}`);
  if (entry?.location) {
    const line = entry.location.line - baseLine;
    let { column } = entry.location;
    if (entry.location.line === classLine && column >= BRACE_COLUMN) {
      column -= COLUMN_SHIFT;
    }
    result.location = { line, column };
  }
  return result;
}

/**
 * Strip TypeScript types from a component `<script>` body, preserving the
 * `class { ... }` delimiter so the caller can keep treating it as Fez script.
 *
 * @param {string} script
 * @returns {string}
 */
export function stripTypeScript(script) {
  if (!script.trim()) {
    return script;
  }

  const found = findAnonymousClass(script);
  let moduleSource;
  let baseLine;
  let classLine;
  if (found) {
    const preamble = script.slice(0, found.index);
    classLine = preamble.split('\n').length;
    moduleSource = preamble + `class ${PLACEHOLDER} {` + script.slice(found.end);
    baseLine = 0;
  } else {
    classLine = 1;
    moduleSource = `class ${PLACEHOLDER} {\n${script}\n}`;
    baseLine = 1;
  }

  let out;
  try {
    out = transpile(moduleSource);
  } catch (error) {
    throw tsError(error, baseLine, classLine);
  }

  return out.replace(PLACEHOLDER_RE, 'class {');
}

// Build-time TypeScript stripping for <script lang="ts"> blocks.
//
// The browser cannot evaluate TypeScript and the runtime compiler has no
// transpiler, so this only runs in the bundler plugin and the `fez compile`
// CLI. esbuild is imported lazily: Vite already ships it, and a Rollup user
// only needs to install it to use `.fez` TypeScript.
//
// The output keeps the `class { ... }` delimiter shape the rest of the
// compiler expects, so a bundle without `lang="ts"` never reaches this file.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CLASS_RE = /class\s*\{/;

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
  try {
    return esbuild.transformSync(code, { loader: 'ts', target: 'esnext' }).code;
  } catch (error) {
    throw new Error(`Fez TypeScript error: ${error.message}`);
  }
}

// A bare class body is not valid TypeScript on its own, so wrap it in an
// anonymous class expression, transform, then put the delimiter back.
function transpileClass(body, wrapped) {
  const out = transpile(wrapped ? `(class {\n${body}\n})` : `(class {${body})`);
  const inner = out.slice(out.indexOf('{') + 1, out.lastIndexOf('}'));
  return `class {${inner}}`;
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

  const match = script.match(CLASS_RE);
  if (!match) {
    return transpileClass(script, true);
  }

  const preamble = script.slice(0, match.index);
  const jsClass = transpileClass(script.slice(match.index + match[0].length), false);
  const jsPreamble = preamble.trim() ? transpile(preamble).trimEnd() : '';
  return jsPreamble ? `${jsPreamble}\n${jsClass}` : jsClass;
}

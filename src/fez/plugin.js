import fs from 'node:fs';
import path from 'node:path';
import { compileFileToModule } from './compile-module.js';

/**
 * Fez bundler plugin. One implementation serves Vite and Rollup:
 * `enforce` and `configResolved` are Vite-only and ignored by Rollup, so the
 * mode-based minify default never fires for Rollup (it stays false).
 * Both import it as `@dinoreic/fez/plugin`.
 *
 * @param {Object} [options]
 * @param {boolean} [options.minify] - drop <info>/<demo> metadata. Vite defaults
 *   to `true` when `config.mode === 'production'`; Rollup has no mode, so it
 *   defaults to false. Pass true/false to override both.
 *
 * @example
 * // vite.config.js
 * import fez from '@dinoreic/fez/plugin';
 * export default { plugins: [fez()] };
 *
 * // rollup.config.js
 * import fez from '@dinoreic/fez/plugin';
 * export default { plugins: [fez()] };
 */
export default function fez(options = {}) {
  let minify = options.minify === true;

  return {
    name: 'fez',
    enforce: 'pre',

    configResolved(config) {
      if (options.minify === undefined && typeof config?.mode === 'string') {
        minify = config.mode === 'production';
      }
    },

    resolveId(source, importer) {
      if (!source.endsWith('.fez')) {
        return null;
      }
      if ((source.startsWith('./') || source.startsWith('../')) && importer) {
        return path.resolve(path.dirname(importer), source);
      }
      return null;
    },

    load(id) {
      if (!id.endsWith('.fez')) {
        return null;
      }
      const source = fs.readFileSync(id, 'utf8');
      const code = compileFileToModule(id, source, { minify });
      return { code, map: null };
    },
  };
}

export { fez as createFezPlugin };

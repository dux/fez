// import .fez files and import globing via fezImport(./foo/bar/*)
// svelte is transformed to component import, all other files are copied
//
// rollup.config.js
// import fezImport from '@dinoreic/fez/rollup';
// plugins: [fezImport(), ...]

import { glob } from 'glob';
import path from 'path';

// compile fez files
const transformFez = (code, filePath) => {
  const baseName = filePath.split('/').pop().split('.');

  if (baseName[1] === 'fez') {
    code = code.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    return `Fez.compile('${baseName[0]}', \`\n${code}\`)`;
  }
}

// glob import files
const transformGlob = async (code, filePath) => {
  // Only process .js files containing glob statements
  if (!filePath.endsWith('.js')) {
    return null;
  }

  // Check for fezImport() function calls
  const globImportMatch = code.match(/fezImport\(['"`]([^'"`]+)['"`]\)/);
  if (globImportMatch) {
    const globPattern = globImportMatch[1];

    // Resolve relative path from the file's directory
    const fileDir = path.dirname(filePath);
    const resolvedPattern = path.resolve(fileDir, globPattern);

    const files = await glob(resolvedPattern, { absolute: true });
    const imports = [];
    const bindings = [];

    console.log('fezGlob(', globPattern, '), files:', files.length);

    for (const file of files.sort()) {
      if (file.endsWith('.svelte')) {
        // Transform Svelte files with bindings
        const name = path.basename(file, '.svelte').replace(/-/g, '_');
        imports.push(`import Svelte_${name} from '${file}';`);
        bindings.push(`Svelte.connect('s-${name.replace(/_/g, '-')}', Svelte_${name});`);
      } else {
        // Regular import for all other files
        const name = path.basename(file, path.extname(file)).replace(/-/g, '_');
        imports.push(`import ${name} from '${file}';`);
      }
    }

    const replacement = [...imports, '', ...bindings].join('\n');
    return code.replace(globImportMatch[0], replacement);
  }

  return null;
}

export default function fezImport() {
  return {
    name: 'fez-plugin',

    async transform(code, filePath) {
      for (const func of [transformFez, transformGlob]) {
        const result = await func(code, filePath);
        if (result) {
          return {
            code: result,
            map: null,
          };
        }
      }

      return null;
    },
  };
}


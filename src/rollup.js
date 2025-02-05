function fezPlugin() {
  return {
    name: 'fez-plugin',

    transform(code, filePath) {
      const baseName = filePath.split('/').pop().split('.');

      if (baseName[1] === 'fez') {
        code = fezPluginTemplateStrings(code);
        code = code.replaceAll("\\", "\\\\")
        const transformedCode = `Fez.compile('${baseName[0]}', \`${code}\`)`;

        if (baseName[0] === 'ui-comment') {
          console.log('Transformed code:', baseName, transformedCode);
        }

        return {
          code: transformedCode,
          map: null,
        };
      }
    },
  };
}

function fezPluginTemplateStrings(code) {
  let inTemplate = false;
  let result = '';
  let current = '';

  for (let i = 0; i < code.length; i++) {
    if (code[i] === '`') {
      if (!inTemplate) {
        inTemplate = true;
        if (current) {
          result += current;
        }
        current = "'";
      } else {
        inTemplate = false;
        current += "'";
        result += fezPluginTemplateToString(current);
        current = '';
      }
    } else if (inTemplate) {
      current += code[i];
    } else {
      result += code[i];
    }
  }

  return result + current;
}

function fezPluginTemplateToString(str) {
  if (str === "''") return str;

  return str.replace(/\${(.*?)}/g, (match, expr) => {
    return "' + " + expr.trim() + " + '";
  });
}

// Export for ES modules
export default fezPlugin;

// Export for CommonJS
// if (typeof module !== 'undefined') {
//   module.exports = fezPlugin;
// }

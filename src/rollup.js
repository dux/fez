function fezPlugin() {
  return {
    name: 'fez-plugin',

    transform(code, filePath) {
      const baseName = filePath.split('/').pop().split('.');

      if (baseName[1] === 'fez') {
        code = code.replace(/`/g, '\\`').replace(/\$/g, '\\$');
        const transformedCode = `Fez.compile('${baseName[0]}', \`\n${code}\`)`;

        // if (baseName[0] === 'admin-menu') {
        //   console.log('Transformed code:', baseName, transformedCode);
        // }

        return {
          code: transformedCode,
          map: null,
        };
      }
    },
  };
}

// Export for ES modules
export default fezPlugin;

// Export for CommonJS
// if (typeof module !== 'undefined') {
//   module.exports = fezPlugin;
// }

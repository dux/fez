function fezPlugin() {
  return {
    name: 'fez-plugin',

    transform(code, filePath) {
      const baseName = filePath.split('/').pop().split('.')

      if (baseName[1] == 'fez') {
        const transformedCode = `Fez.compile('${baseName[0]}', \`${code}\`)`;
        // console.log('Transformed code:', baseName, transformedCode);

        return {
          code: transformedCode,
          map: null,
        }
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

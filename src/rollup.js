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

export default fezPlugin;

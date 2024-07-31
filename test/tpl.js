// const fs = require('fs')

// var tpl = fs.readFileSync('test/tpl.html', 'utf8')

// function parseTpl(text) {
//   let pushTo = 'html'

//   const out = {
//     script: [],
//     style: [],
//     html: []
//   }

//   for (const l of text.split("\n")) {
//     if (l.startsWith('<script')) {
//       pushTo = 'script'
//     } else if (l.startsWith('</script>')) {
//       pushTo = 'html'
//     } else if (l.startsWith('<style')) {
//       pushTo = 'style'
//     } else if (l.startsWith('</style>')) {
//       pushTo = 'html'
//     } else if (l) {
//       out[pushTo].push(l)
//     }
//   }

//   return out
// }

// const out = parseTpl(tpl)
// for (let k of Object.keys(out)) {
//   out[k] = out[k].join("\n").trim()
//   // console.log(out[k])
// }

// function generateFez(name, data) {
//   return `
// Fez('ui-todo', class extends FezBase {
//   static html = \`${data.html}\`

//   static css = \`${data.style}\`

//   ${data.script}
// }
// `
// }
// import tpl1 from './tpl.html'

// console.log(tpl1)


// console.log(generateFez('ui-foo', out))

import content from '../demo/fez/clock.fez';

console.log(content);

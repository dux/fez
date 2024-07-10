import gobber from "../src/lib/gobber.js"

const css = `
.foo {
  .bar { color: red; }
  &.baz { color: blue ; }
}
`

console.log(css)

const klass = gobber.css(css)
console.log(gobber.extractCss())

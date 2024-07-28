let base = class {
  root() { return 'root '}
  bar() { return 'root bar '}
}

let foo = class {
  bar() { return 123 }
  baz() { return 123 }
}

let object = {
  bar() { return 123 },
  baz() { return 123 }
}

let full = class Full extends base {}

console.log(Object.getOwnPropertyNames(object))
console.log(Object.getOwnPropertyNames(foo))
console.log(Object.getOwnPropertyNames(foo.prototype))


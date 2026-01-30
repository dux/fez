import { describe, test, expect } from 'bun:test'

// Simulate fez-for replacement logic
function fezForList(template, list, divider = ',') {
  return list.split(divider).map((item, index) => {
    return template
      .replace(/KEY/g, item.trim())
      .replace(/INDEX/g, index)
  }).join('')
}

function fezForObject(template, object) {
  return object.split(';').map(pair => {
    const [key, ...valueParts] = pair.split(':')
    const keyTrimmed = key.trim()
    if (!keyTrimmed) return ''
    return template
      .replace(/KEY/g, keyTrimmed)
      .replace(/VALUE/g, valueParts.join(':').trim())
  }).join('')
}

describe('fez-for list', () => {
  test('replaces KEY with item values', () => {
    const result = fezForList('<li>KEY</li>', 'apple, banana, cherry')
    expect(result).toBe('<li>apple</li><li>banana</li><li>cherry</li>')
  })

  test('replaces INDEX with item index', () => {
    const result = fezForList('<li>INDEX: KEY</li>', 'a, b, c')
    expect(result).toBe('<li>0: a</li><li>1: b</li><li>2: c</li>')
  })

  test('uses custom divider', () => {
    const result = fezForList('<span>KEY</span>', 'one|two|three', '|')
    expect(result).toBe('<span>one</span><span>two</span><span>three</span>')
  })

  test('trims whitespace from items', () => {
    const result = fezForList('<li>KEY</li>', '  foo  ,  bar  ')
    expect(result).toBe('<li>foo</li><li>bar</li>')
  })

  test('handles single item', () => {
    const result = fezForList('<li>KEY</li>', 'only')
    expect(result).toBe('<li>only</li>')
  })
})

describe('fez-for object', () => {
  test('replaces KEY and VALUE', () => {
    const result = fezForObject('<div>KEY = VALUE</div>', 'name: John; age: 30')
    expect(result).toBe('<div>name = John</div><div>age = 30</div>')
  })

  test('handles values with colons', () => {
    const result = fezForObject('<li>KEY: VALUE</li>', 'url: http://example.com')
    expect(result).toBe('<li>url: http://example.com</li>')
  })

  test('trims whitespace from keys and values', () => {
    const result = fezForObject('<li>KEY=VALUE</li>', '  foo  :  bar  ;  baz  :  qux  ')
    expect(result).toBe('<li>foo=bar</li><li>baz=qux</li>')
  })

  test('skips empty keys', () => {
    const result = fezForObject('<li>KEY</li>', 'a: 1; ; b: 2')
    expect(result).toBe('<li>a</li><li>b</li>')
  })

  test('handles single pair', () => {
    const result = fezForObject('<li>KEY: VALUE</li>', 'key: value')
    expect(result).toBe('<li>key: value</li>')
  })
})

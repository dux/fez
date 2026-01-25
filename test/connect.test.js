import { describe, test, expect } from 'bun:test'

// Simulate connect.js slot replacement logic
const SELF_CLOSING_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'
])

function closeCustomTags(html) {
  return html.replace(/<([a-z-]+)\b([^>]*)\/>/g, (match, tagName, attributes) => {
    return SELF_CLOSING_TAGS.has(tagName) ? match : `<${tagName}${attributes}></${tagName}>`
  })
}

function processSlot(html, slotTag = 'div') {
  return html
    .replace(/<slot(\s[^>]*)?>/, `<${slotTag} class="fez-slot" fez-keep="default-slot"$1>`)
    .replace('</slot>', `</${slotTag}>`)
}

describe('connect slot handling', () => {
  test('converts self-closing <slot /> to div', () => {
    let html = '<div>Header</div><slot />'
    html = closeCustomTags(html)
    html = processSlot(html)
    expect(html).toBe('<div>Header</div><div class="fez-slot" fez-keep="default-slot" ></div>')
  })

  test('converts <slot></slot> to div', () => {
    let html = '<div>Header</div><slot></slot>'
    html = processSlot(html)
    expect(html).toBe('<div>Header</div><div class="fez-slot" fez-keep="default-slot"></div>')
  })

  test('preserves slot attributes', () => {
    let html = '<slot name="content"></slot>'
    html = processSlot(html)
    expect(html).toBe('<div class="fez-slot" fez-keep="default-slot" name="content"></div>')
  })

  test('uses custom slot tag', () => {
    let html = '<slot></slot>'
    html = processSlot(html, 'section')
    expect(html).toBe('<section class="fez-slot" fez-keep="default-slot"></section>')
  })

  test('closeCustomTags converts custom elements', () => {
    const html = '<ui-icon name="star" />'
    expect(closeCustomTags(html)).toBe('<ui-icon name="star" ></ui-icon>')
  })

  test('closeCustomTags preserves self-closing HTML tags', () => {
    const html = '<input type="text" /><br />'
    expect(closeCustomTags(html)).toBe('<input type="text" /><br />')
  })
})

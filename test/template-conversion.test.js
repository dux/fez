import { describe, test, expect } from 'bun:test'
import createTemplate from '../src/fez/lib/template.js'

// Mock Fez.htmlEscape
globalThis.Fez = {
  htmlEscape: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

// Helper to render template
const render = (template, ctx, name) => {
  ctx.UID = ctx.UID || 123
  ctx.Fez = Fez
  const fn = createTemplate(template, { name })
  return fn(ctx)
}

describe('Old to new syntax conversion', () => {
  describe('expressions', () => {
    test('converts {{ expr }} to {expr}', () => {
      const html = render('{{ state.name }}', { state: { name: 'Alice' } })
      expect(html).toBe('Alice')
    })

    test('converts [[ expr ]] to {expr}', () => {
      const html = render('[[ state.name ]]', { state: { name: 'Bob' } })
      expect(html).toBe('Bob')
    })
  })

  describe('conditionals', () => {
    test('converts {{if}} to {#if}', () => {
      const html = render('{{if state.show}}yes{{/if}}', { state: { show: true } })
      expect(html).toBe('yes')
    })

    test('converts {{#if}} to {#if}', () => {
      const html = render('{{#if state.show}}yes{{/if}}', { state: { show: true } })
      expect(html).toBe('yes')
    })

    test('converts {{else}} to {:else}', () => {
      const html = render('{{if state.show}}yes{{else}}no{{/if}}', { state: { show: false } })
      expect(html).toBe('no')
    })

    test('converts {{unless}} to {#unless}', () => {
      const html = render('{{unless state.hidden}}visible{{/unless}}', { state: { hidden: false } })
      expect(html).toBe('visible')
    })
  })

  describe('loops', () => {
    test('converts {{for x in y}} to {#for x in y}', () => {
      const html = render('{{for item in state.items}}<li>{{item}}</li>{{/for}}', {
        state: { items: ['a', 'b'] }
      })
      expect(html).toBe('<li>a</li><li>b</li>')
    })

    test('converts {{each y as x}} to {#each y as x}', () => {
      const html = render('{{each state.items as item}}<li>{{item}}</li>{{/each}}', {
        state: { items: ['x', 'y'] }
      })
      expect(html).toBe('<li>x</li><li>y</li>')
    })
  })

  describe('special directives', () => {
    test('converts {{raw x}} to {@html x}', () => {
      const html = render('{{raw state.html}}', { state: { html: '<b>bold</b>' } })
      expect(html).toBe('<b>bold</b>')
    })

    test('converts {{html x}} to {@html x}', () => {
      const html = render('{{html state.html}}', { state: { html: '<i>italic</i>' } })
      expect(html).toBe('<i>italic</i>')
    })

    test('converts {{json x}} to {@json x}', () => {
      const html = render('{{json state.obj}}', { state: { obj: { a: 1 } } })
      expect(html).toContain('<pre class="json">')
      expect(html).toContain('&quot;a&quot;: 1')  // quotes are HTML escaped
    })
  })

  describe('blocks', () => {
    test('converts {{block name}}...{{/block}} and {{block:name}}', () => {
      const html = render('{{block avatar}}<img/>{{/block}}<div>{{block:avatar}}</div>', { state: {} })
      expect(html).toBe('<div><img/></div>')
    })

    test('block can be referenced multiple times', () => {
      const html = render('{{block icon}}<i>*</i>{{/block}}<span>{{block:icon}}</span><span>{{block:icon}}</span>', { state: {} })
      expect(html).toBe('<span><i>*</i></span><span><i>*</i></span>')
    })

    test('block with expressions inside', () => {
      const html = render('{{block item}}<li>{{state.name}}</li>{{/block}}{{block:item}}', { state: { name: 'Test' } })
      expect(html).toBe('<li>Test</li>')
    })
  })

  describe('mixed old and new in same template should not happen', () => {
    test('old syntax is fully converted before parsing', () => {
      // This tests that all old syntax is converted
      const html = render('<div>{{if state.show}}{{state.name}}{{/if}}</div>', {
        state: { show: true, name: 'Test' }
      })
      expect(html).toBe('<div>Test</div>')
    })
  })
})

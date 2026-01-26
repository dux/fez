import { describe, test, expect, beforeAll } from 'bun:test'
import { Window } from 'happy-dom'
import createSvelteTemplate from '../src/fez/lib/svelte-template.js'

// Setup happy-dom for DOM APIs
const window = new Window()
globalThis.document = window.document
globalThis.DocumentFragment = window.DocumentFragment
globalThis.Node = window.Node

// Mock Fez.htmlEscape
globalThis.Fez = {
  htmlEscape: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

// Helper to render template and get HTML string
const render = (template, ctx) => {
  ctx.UID = ctx.UID || 123
  ctx.Fez = Fez
  const fn = createSvelteTemplate(template)
  return fn(ctx)
}

describe('Svelte-style template', () => {
  describe('expressions', () => {
    test('simple expression', () => {
      const html = render('{state.name}', { state: { name: 'Alice' } })
      expect(html).toBe('Alice')
    })

    test('expression with state prefix works', () => {
      const html = render('{state.count}', { state: { count: 42 } })
      expect(html).toBe('42')
    })

    test('@html outputs raw HTML', () => {
      const html = render('{@html state.text}', { state: { text: '<b>bold</b>' } })
      expect(html).toContain('<b>bold</b>')
    })

    test('@json outputs formatted JSON', () => {
      const html = render('{@json state.obj}', { state: { obj: { a: 1 } } })
      expect(html).toContain('<pre class="json">')
      expect(html).toContain('&quot;a&quot;: 1')  // JSON keys are escaped
    })

    test('@block defines and references reusable content', () => {
      const html = render('{@block avatar}<img src="test.png"/>{/block}<div>{@block:avatar}</div><span>{@block:avatar}</span>', { state: {} })
      expect(html).toBe('<div><img src="test.png"/></div><span><img src="test.png"/></span>')
    })
  })

  describe('#if / #unless conditionals', () => {
    test('basic #if', () => {
      const html = render('{#if state.show}visible{/if}', { state: { show: true } })
      expect(html).toBe('visible')
    })

    test('#if false', () => {
      const html = render('{#if state.show}visible{/if}', { state: { show: false } })
      expect(html).toBe('')
    })

    test('#if with :else', () => {
      expect(render('{#if state.show}yes{:else}no{/if}', { state: { show: true } })).toBe('yes')
      expect(render('{#if state.show}yes{:else}no{/if}', { state: { show: false } })).toBe('no')
    })

    test('#if with :else if', () => {
      expect(render('{#if state.x === 1}one{:else if state.x === 2}two{:else}other{/if}', { state: { x: 1 } })).toBe('one')
      expect(render('{#if state.x === 1}one{:else if state.x === 2}two{:else}other{/if}', { state: { x: 2 } })).toBe('two')
      expect(render('{#if state.x === 1}one{:else if state.x === 2}two{:else}other{/if}', { state: { x: 3 } })).toBe('other')
    })

    test('#unless', () => {
      expect(render('{#unless state.hidden}visible{/unless}', { state: { hidden: false } })).toBe('visible')
      expect(render('{#unless state.hidden}visible{/unless}', { state: { hidden: true } })).toBe('')
    })

    test('nested #if in element', () => {
      const html = render('<div>{#if state.show}<span>inside</span>{/if}</div>', { state: { show: true } })
      expect(html).toBe('<div><span>inside</span></div>')
    })
  })

  describe('#each / #for loops', () => {
    test('#each array', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{/each}', {
        state: { items: ['a', 'b', 'c'] }
      })
      expect(html).toBe('<li>a</li><li>b</li><li>c</li>')
    })

    test('#each with index', () => {
      const html = render('{#each state.items as item, idx}<li>{idx}:{item}</li>{/each}', {
        state: { items: ['a', 'b'] }
      })
      expect(html).toBe('<li>0:a</li><li>1:b</li>')
    })

    test('#each with implicit i index', () => {
      const html = render('{#each state.items as item}<li>{i}:{item}</li>{/each}', {
        state: { items: ['x', 'y'] }
      })
      expect(html).toBe('<li>0:x</li><li>1:y</li>')
    })

    test('#for array', () => {
      const html = render('{#for item in state.items}<li>{item}</li>{/for}', {
        state: { items: ['a', 'b'] }
      })
      expect(html).toBe('<li>a</li><li>b</li>')
    })

    test('#for with index', () => {
      const html = render('{#for item, idx in state.items}<li>{idx}:{item}</li>{/for}', {
        state: { items: ['a', 'b'] }
      })
      expect(html).toBe('<li>0:a</li><li>1:b</li>')
    })

    test('#each object (3 params)', () => {
      const html = render('{#each state.obj as key, value, idx}<li>{idx}:{key}={value}</li>{/each}', {
        state: { obj: { a: 1, b: 2 } }
      })
      expect(html).toBe('<li>0:a=1</li><li>1:b=2</li>')
    })

    test('#for object (3 params)', () => {
      const html = render('{#for key, value, idx in state.obj}<li>{idx}:{key}={value}</li>{/for}', {
        state: { obj: { x: 10, y: 20 } }
      })
      expect(html).toBe('<li>0:x=10</li><li>1:y=20</li>')
    })

    test('#if inside #each', () => {
      const html = render(
        '{#each state.users as user}{#if user.active}<span>{user.name}</span>{/if}{/each}',
        { state: { users: [{ name: 'Alice', active: true }, { name: 'Bob', active: false }] } }
      )
      expect(html).toBe('<span>Alice</span>')
    })

    test('#each inside #if', () => {
      const html = render(
        '{#if state.showList}{#each state.items as item}<li>{item}</li>{/each}{/if}',
        { state: { showList: true, items: ['a', 'b'] } }
      )
      expect(html).toBe('<li>a</li><li>b</li>')
    })
  })

  describe('attributes', () => {
    test('static attribute preserved', () => {
      const html = render('<div class="box">test</div>', { state: {} })
      expect(html).toBe('<div class="box">test</div>')
    })

    test('embedded expression in quoted attribute value', () => {
      const html = render('<a name="section-{state.id}">link</a>', { state: { id: 'foo' } })
      expect(html).toBe('<a name="section-foo">link</a>')
    })

    test('multiple embedded expressions in attribute', () => {
      const html = render('<div id="{state.prefix}-{state.suffix}">test</div>', { state: { prefix: 'a', suffix: 'b' } })
      expect(html).toBe('<div id="a-b">test</div>')
    })

    test('conditional class expression', () => {
      expect(render('<div class="box {state.active ? \'on\' : \'\'}">test</div>', { state: { active: true } }))
        .toBe('<div class="box on">test</div>')
      expect(render('<div class="box {state.active ? \'on\' : \'\'}">test</div>', { state: { active: false } }))
        .toBe('<div class="box ">test</div>')
    })
  })

  describe('event handlers in HTML', () => {
    // Event handlers are rendered as attributes - the actual binding happens during morphing
    test('onclick attribute is preserved', () => {
      const html = render('<button onclick="fez.doIt()">click</button>', { state: {} })
      expect(html).toContain('onclick="fez.doIt()"')
    })

    test('onclick with expression in loop', () => {
      const html = render('{#each state.items as item}<button onclick="fez.click(\'{item}\')">click</button>{/each}', {
        state: { items: ['a', 'b'] }
      })
      expect(html).toContain("onclick=\"fez.click('a')\"")
      expect(html).toContain("onclick=\"fez.click('b')\"")
    })
  })

  describe('edge cases', () => {
    test('handles empty state.items array', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{/each}', { state: { items: [] } })
      expect(html).toBe('')
    })

    test('handles undefined state.items', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{/each}', { state: {} })
      expect(html).toBe('')
    })

    test('escapes HTML in expressions', () => {
      const html = render('{state.text}', { state: { text: '<script>evil</script>' } })
      expect(html).toBe('&lt;script&gt;evil&lt;/script&gt;')
    })

    test('preserves whitespace in text', () => {
      const html = render('<pre>{state.code}</pre>', { state: { code: 'line1\nline2' } })
      expect(html).toBe('<pre>line1\nline2</pre>')
    })

    test('JS template literal with object inside attribute is preserved', () => {
      const html = render('<span onclick="Dialog.load(`${state.path}/top_menu_dialog`, {d: \'top\'})">click</span>', {
        state: { path: '/app' }
      })
      expect(html).toContain('Dialog.load(`${state.path}/top_menu_dialog`, {d: \'top\'})')
    })

    test('JS template literal with interpolation is preserved', () => {
      const html = render('<a href="javascript:alert(`Hello ${state.name}`)">test</a>', {
        state: { name: 'World' }
      })
      expect(html).toContain('`Hello ${state.name}`')
    })

    test('simple object literal is preserved', () => {
      const html = render('<div data-opts="{foo: 1}">test</div>', { state: {} })
      expect(html).toContain('{foo: 1}')
    })

    test('object literal with multiple keys is preserved', () => {
      const html = render('<div onclick="fn({a: 1, b: 2, c: 3})">test</div>', { state: {} })
      expect(html).toContain('{a: 1, b: 2, c: 3}')
    })

    test('object literal with quoted keys is preserved', () => {
      const html = render('<div data-x="{\'key\': 1}">test</div>', { state: {} })
      expect(html).toContain('{\'key\': 1}')
    })

    test('object literal with double-quoted keys is preserved', () => {
      const html = render('<div data-x=\'{"key": 1}\'>test</div>', { state: {} })
      expect(html).toContain('{"key": 1}')
    })

    test('nested object literals are preserved', () => {
      const html = render('<div onclick="fn({a: {b: 1}})">test</div>', { state: {} })
      expect(html).toContain('{a: {b: 1}}')
    })

    test('object literal does not interfere with Fez expressions', () => {
      const html = render('<div>{state.name}</div><span data-x="{foo: 1}">test</span>', {
        state: { name: 'Alice' }
      })
      expect(html).toContain('Alice')
      expect(html).toContain('{foo: 1}')
    })

    test('object literal in onclick with Fez loop', () => {
      const html = render('{#each state.items as item}<button onclick="send({id: 1})">{item}</button>{/each}', {
        state: { items: ['a', 'b'] }
      })
      expect(html).toBe('<button onclick="send({id: 1})">a</button><button onclick="send({id: 1})">b</button>')
    })
  })
})

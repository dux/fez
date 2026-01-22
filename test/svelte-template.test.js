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
  htmlEscape: (s) => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

// Helper to render template and get HTML string
const render = (template, ctx) => {
  ctx.UID = ctx.UID || 123
  const fn = createSvelteTemplate(template)
  const result = fn(ctx)

  // Convert DocumentFragment to HTML string
  if (result instanceof DocumentFragment || result instanceof Node) {
    const div = document.createElement('div')
    div.appendChild(result.cloneNode(true))
    // Remove comment nodes from output for cleaner test comparisons
    return div.innerHTML.replace(/<!--[^>]*-->/g, '')
  }
  return result
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
      expect(html).toContain('"a": 1')
    })
  })

  describe('#if / #unless blocks', () => {
    test('#if true', () => {
      const html = render('{#if state.show}<p>visible</p>{/if}', { state: { show: true } })
      expect(html).toBe('<p>visible</p>')
    })

    test('#if false', () => {
      const html = render('{#if state.show}<p>visible</p>{/if}', { state: { show: false } })
      expect(html).toBe('')
    })

    test('#unless', () => {
      const html = render('{#unless state.hidden}<p>visible</p>{/unless}', { state: { hidden: false } })
      expect(html).toBe('<p>visible</p>')
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
    test('dynamic attribute', () => {
      const html = render('<div class={state.cls}>test</div>', { state: { cls: 'active' } })
      expect(html).toBe('<div class="active">test</div>')
    })

    test('expression in attribute', () => {
      const html = render('<div class={state.active ? "on" : "off"}>test</div>', { state: { active: true } })
      expect(html).toBe('<div class="on">test</div>')
    })
  })

  describe('event handlers', () => {
    test('onclick adds event listener', () => {
      const ctx = {
        state: {},
        clicked: false,
        doIt() { this.clicked = true }
      }
      const fn = createSvelteTemplate('<button onclick={this.doIt()}>click</button>')
      const frag = fn(ctx)
      const btn = frag.querySelector('button')

      // Simulate click
      btn.click()
      expect(ctx.clicked).toBe(true)
    })

    test('onclick inside loop captures loop variable', () => {
      const ctx = {
        state: { items: ['a', 'b', 'c'] },
        clickedItems: [],
        handleClick(item) { this.clickedItems.push(item) }
      }
      const fn = createSvelteTemplate(
        '{#each state.items as item}<button onclick={this.handleClick(item)}>{item}</button>{/each}'
      )
      const frag = fn(ctx)
      const buttons = frag.querySelectorAll('button')

      // Click all buttons
      buttons[0].click()
      buttons[1].click()
      buttons[2].click()

      // Each handler should capture correct item
      expect(ctx.clickedItems).toEqual(['a', 'b', 'c'])
    })

    test('onclick with object in loop preserves reference', () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ]
      const ctx = {
        state: { users },
        selected: null,
        select(user) { this.selected = user }
      }
      const fn = createSvelteTemplate(
        '{#each state.users as user}<div onclick={this.select(user)}>{user.name}</div>{/each}'
      )
      const frag = fn(ctx)
      const divs = frag.querySelectorAll('div')

      // Click first user
      divs[0].click()

      // Should be the same object reference, not a copy
      expect(ctx.selected).toBe(users[0])
      expect(ctx.selected.id).toBe(1)
    })
  })

  describe('edge cases', () => {
    test('empty array', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{/each}', { state: { items: [] } })
      expect(html).toBe('')
    })

    test('null/undefined collection', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{/each}', { state: { items: null } })
      expect(html).toBe('')
    })
  })
})

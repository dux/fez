import { describe, test, expect, beforeAll } from 'bun:test'
import { Window } from 'happy-dom'
import createSvelteTemplate from '../src/fez/lib/svelte-template.js'

// Setup happy-dom globals
let window, document

// Mock Fez.htmlEscape
const Fez = {
  htmlEscape: (str) => {
    if (str == null) return ''
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}

beforeAll(() => {
  window = new Window()
  document = window.document
  global.document = document
  global.window = window
  global.Fez = Fez
})

// Helper to render template and get HTML
function render(template, ctx) {
  const tpl = createSvelteTemplate(template)
  return tpl({ ...ctx, Fez })
}

describe('svelte template', () => {
  describe('basic rendering', () => {
    test('renders simple element', () => {
      const html = render('<div>Hello</div>', { state: {}, props: {} })
      expect(html).toBe('<div>Hello</div>')
    })

    test('renders expression', () => {
      const html = render('<div>{state.name}</div>', { state: { name: 'World' }, props: {} })
      expect(html).toBe('<div>World</div>')
    })

    test('escapes HTML in expressions', () => {
      const html = render('<div>{state.text}</div>', { state: { text: '<script>alert(1)</script>' }, props: {} })
      expect(html).toBe('<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>')
    })
  })

  describe('conditionals', () => {
    test('renders #if when true', () => {
      const html = render('{#if state.show}<span>Visible</span>{/if}', { state: { show: true }, props: {} })
      expect(html).toBe('<span>Visible</span>')
    })

    test('does not render #if when false', () => {
      const html = render('{#if state.show}<span>Visible</span>{/if}', { state: { show: false }, props: {} })
      expect(html).toBe('')
    })

    test('renders #if with else', () => {
      const html = render('{#if state.show}<span>Yes</span>{:else}<span>No</span>{/if}', { state: { show: false }, props: {} })
      expect(html).toBe('<span>No</span>')
    })

    test('renders #if with else when true', () => {
      const html = render('{#if state.show}<span>Yes</span>{:else}<span>No</span>{/if}', { state: { show: true }, props: {} })
      expect(html).toBe('<span>Yes</span>')
    })

    test('renders nested elements inside #if', () => {
      const html = render(
        '<div class="outer">{#if state.kind === \'classic\'}<div class="classic">Classic</div>{:else}<div class="track"><div class="circle"></div></div>{/if}<span class="label">Label</span></div>',
        { state: { kind: 'toggle' }, props: {} }
      )
      expect(html).toContain('<div class="outer">')
      expect(html).toContain('<div class="track">')
      expect(html).toContain('<span class="label">Label</span>')
      expect(html).not.toContain('<div class="classic">')
    })

    test('renders #unless when false', () => {
      const html = render('{#unless state.hidden}<span>Visible</span>{/unless}', { state: { hidden: false }, props: {} })
      expect(html).toBe('<span>Visible</span>')
    })

    test('does not render #unless when true', () => {
      const html = render('{#unless state.hidden}<span>Visible</span>{/unless}', { state: { hidden: true }, props: {} })
      expect(html).toBe('')
    })
  })

  describe('loops', () => {
    test('renders #each', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{/each}', { state: { items: ['a', 'b', 'c'] }, props: {} })
      expect(html).toBe('<li>a</li><li>b</li><li>c</li>')
    })

    test('renders #each with index', () => {
      const html = render('{#each state.items as item, idx}<li>{idx}:{item}</li>{/each}', { state: { items: ['a', 'b'] }, props: {} })
      expect(html).toBe('<li>0:a</li><li>1:b</li>')
    })

    test('renders #for', () => {
      const html = render('{#for item in state.items}<li>{item}</li>{/for}', { state: { items: ['x', 'y'] }, props: {} })
      expect(html).toBe('<li>x</li><li>y</li>')
    })

    test('renders #for with index', () => {
      const html = render('{#for item, i in state.items}<li>{i}:{item}</li>{/for}', { state: { items: ['a', 'b'] }, props: {} })
      expect(html).toBe('<li>0:a</li><li>1:b</li>')
    })

    test('renders #each with :else for empty array', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{:else}<li>No items</li>{/each}', { state: { items: [] }, props: {} })
      expect(html).toBe('<li>No items</li>')
    })

    test('renders #each without :else when array has items', () => {
      const html = render('{#each state.items as item}<li>{item}</li>{:else}<li>No items</li>{/each}', { state: { items: ['a', 'b'] }, props: {} })
      expect(html).toBe('<li>a</li><li>b</li>')
    })

    test('renders #for with :else for empty array', () => {
      const html = render('{#for item in state.items}<li>{item}</li>{:else}<li>Empty</li>{/for}', { state: { items: [] }, props: {} })
      expect(html).toBe('<li>Empty</li>')
    })

    test('renders #each with object', () => {
      const html = render('{#each state.obj as key, value, idx}<li>{idx}:{key}={value}</li>{/each}', { state: { obj: { a: 1, b: 2 } }, props: {} })
      expect(html).toBe('<li>0:a=1</li><li>1:b=2</li>')
    })
  })

  describe('raw HTML', () => {
    test('renders @html without escaping', () => {
      const html = render('<div>{@html state.content}</div>', { state: { content: '<b>Bold</b>' }, props: {} })
      expect(html).toBe('<div><b>Bold</b></div>')
    })
  })

  describe('dynamic classes', () => {
    test('renders conditional class', () => {
      let html = render('<div class="box {state.active ? \'active\' : \'\'}"></div>', { state: { active: true }, props: {} })
      expect(html).toContain('active')

      html = render('<div class="box {state.active ? \'active\' : \'\'}"></div>', { state: { active: false }, props: {} })
      expect(html).not.toContain('active')
    })

    test('renders multiple conditional classes', () => {
      const html = render(
        '<div class="btn {state.primary ? \'primary\' : \'\'} {state.disabled ? \'disabled\' : \'\'}"></div>',
        { state: { primary: true, disabled: false }, props: {} }
      )
      expect(html).toContain('primary')
      expect(html).not.toContain('disabled')
    })
  })

  describe('mixed content', () => {
    test('renders loop inside conditional', () => {
      const html = render(
        '{#if state.show}{#each state.items as item}<li>{item}</li>{/each}{/if}',
        { state: { show: true, items: ['a', 'b'] }, props: {} }
      )
      expect(html).toBe('<li>a</li><li>b</li>')
    })

    test('renders conditional inside loop', () => {
      const html = render(
        '{#each state.users as user}{#if user.active}<span>{user.name}</span>{/if}{/each}',
        { state: { users: [{ name: 'Alice', active: true }, { name: 'Bob', active: false }] }, props: {} }
      )
      expect(html).toBe('<span>Alice</span>')
    })
  })

  describe('HTML entity decoding', () => {
    test('decodes &amp;&amp; in expressions', () => {
      // Browser DOM might encode && as &amp;&amp;
      const html = render('<div>{state.a &amp;&amp; state.b}</div>', { state: { a: true, b: 'yes' }, props: {} })
      expect(html).toBe('<div>yes</div>')
    })

    test('decodes &lt; and &gt; in expressions', () => {
      const html = render('<div>{state.n &gt; 5 ? "big" : "small"}</div>', { state: { n: 10 }, props: {} })
      expect(html).toBe('<div>big</div>')
    })
  })

  describe('self-closing custom elements', () => {
    test('converts self-closing custom element to paired tags', () => {
      const html = render('<ui-icon name="foo" />', { state: {}, props: {} })
      expect(html).toBe('<ui-icon name="foo"></ui-icon>')
    })

    test('converts custom element without space before />', () => {
      const html = render('<my-component attr="value"/>', { state: {}, props: {} })
      expect(html).toBe('<my-component attr="value"></my-component>')
    })

    test('does not convert standard void elements', () => {
      const html = render('<input type="text" /><br />', { state: {}, props: {} })
      expect(html).toBe('<input type="text" /><br />')
    })

    test('handles custom element with expression', () => {
      const html = render('<ui-icon name={state.icon} />', { state: { icon: 'star' }, props: {} })
      expect(html).toBe('<ui-icon name="star"></ui-icon>')
    })

    test('converts self-closing slot to paired tags', () => {
      const html = render('<div><slot /></div>', { state: {}, props: {} })
      expect(html).toBe('<div><slot></slot></div>')
    })
  })

  describe('attribute value quoting', () => {
    test('quotes attribute values with expressions', () => {
      const html = render('<input value={state.val} />', { state: { val: 'test' }, props: {} })
      expect(html).toBe('<input value="test" />')
    })

    test('quotes empty attribute values', () => {
      const html = render('<input value={state.val} />', { state: { val: '' }, props: {} })
      expect(html).toBe('<input value="" />')
    })

    test('quotes attribute values with special chars', () => {
      const html = render('<input value={state.val} />', { state: { val: 'hello world' }, props: {} })
      expect(html).toBe('<input value="hello world" />')
    })

    test('quotes class attribute with expression', () => {
      const html = render('<div class={state.cls}></div>', { state: { cls: 'foo bar' }, props: {} })
      expect(html).toBe('<div class="foo bar"></div>')
    })
  })

  describe('arrow function event handlers', () => {
    test('transforms simple arrow function in onclick', () => {
      const html = render('<button onclick={() => test()}>Click</button>', { state: {}, props: {} })
      expect(html).toBe('<button onclick="fez.test()">Click</button>')
    })

    test('transforms arrow function with event param', () => {
      const html = render('<button onclick={(e) => handleClick(e)}>Click</button>', { state: {}, props: {} })
      expect(html).toBe('<button onclick="fez.handleClick(event)">Click</button>')
    })

    test('transforms arrow function with loop variable', () => {
      const html = render(
        '{#each state.items as item, index}<button onclick={() => remove(index)}>X</button>{/each}',
        { state: { items: ['a', 'b'] }, props: {} }
      )
      expect(html).toBe('<button onclick="fez.remove(0)">X</button><button onclick="fez.remove(1)">X</button>')
    })

    test('transforms arrow function with multiple loop variables', () => {
      const html = render(
        '{#each state.items as item, idx}<button onclick={() => edit(item, idx)}>Edit</button>{/each}',
        { state: { items: ['foo', 'bar'] }, props: {} }
      )
      expect(html).toBe('<button onclick="fez.edit(foo, 0)">Edit</button><button onclick="fez.edit(bar, 1)">Edit</button>')
    })

    test('does not prefix global functions', () => {
      const html = render('<button onclick={() => console.log("test")}>Log</button>', { state: {}, props: {} })
      // Inner quotes are escaped for HTML attribute
      expect(html).toBe('<button onclick="console.log(&quot;test&quot;)">Log</button>')
    })

    test('transforms onchange handler', () => {
      const html = render('<input onchange={(e) => setValue(e.target.value)} />', { state: {}, props: {} })
      expect(html).toBe('<input onchange="fez.setValue(event.target.value)" />')
    })
  })
})

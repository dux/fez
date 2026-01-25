import { describe, test, expect, beforeAll } from 'bun:test'
import { Window } from 'happy-dom'

// Setup happy-dom globals
let document

beforeAll(() => {
  const window = new Window()
  document = window.document
  global.document = document
})

// Extract syncClassList logic for testing
function syncClassList(from, to) {
  const fromClasses = new Set(from.className.split(/\s+/).filter(Boolean));
  const toClasses = new Set(to.className.split(/\s+/).filter(Boolean));

  // Remove classes that are no longer present
  for (const cls of toClasses) {
    if (!fromClasses.has(cls)) {
      to.classList.remove(cls);
    }
  }

  // Add new classes
  for (const cls of fromClasses) {
    if (!toClasses.has(cls)) {
      to.classList.add(cls);
    }
  }
}

describe('syncClassList', () => {
  test('adds new class', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.className = 'box active'
    to.className = 'box'

    syncClassList(from, to)

    expect(to.classList.contains('box')).toBe(true)
    expect(to.classList.contains('active')).toBe(true)
  })

  test('removes class', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.className = 'box'
    to.className = 'box active'

    syncClassList(from, to)

    expect(to.classList.contains('box')).toBe(true)
    expect(to.classList.contains('active')).toBe(false)
  })

  test('handles multiple changes', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.className = 'b d e'
    to.className = 'a b c'

    syncClassList(from, to)

    expect(to.classList.contains('a')).toBe(false)  // removed
    expect(to.classList.contains('b')).toBe(true)   // kept
    expect(to.classList.contains('c')).toBe(false)  // removed
    expect(to.classList.contains('d')).toBe(true)   // added
    expect(to.classList.contains('e')).toBe(true)   // added
  })

  test('uses classList.add instead of setAttribute', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.className = 'box active'
    to.className = 'box'

    let addCalled = false
    const originalAdd = to.classList.add.bind(to.classList)
    to.classList.add = (...args) => {
      addCalled = true
      return originalAdd(...args)
    }

    syncClassList(from, to)

    expect(addCalled).toBe(true)
  })

  test('uses classList.remove instead of setAttribute', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.className = 'box'
    to.className = 'box active'

    let removeCalled = false
    const originalRemove = to.classList.remove.bind(to.classList)
    to.classList.remove = (...args) => {
      removeCalled = true
      return originalRemove(...args)
    }

    syncClassList(from, to)

    expect(removeCalled).toBe(true)
  })

  test('handles empty class', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.className = ''
    to.className = 'active'

    syncClassList(from, to)

    expect(to.classList.contains('active')).toBe(false)
  })

  test('handles extra whitespace', () => {
    const from = document.createElement('div')
    const to = document.createElement('div')
    from.className = '  box   active  '
    to.className = 'box'

    syncClassList(from, to)

    expect(to.classList.contains('box')).toBe(true)
    expect(to.classList.contains('active')).toBe(true)
  })
})

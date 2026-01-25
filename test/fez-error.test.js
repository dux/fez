import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import FezBase from '../src/fez/instance.js'

// Capture errors
let capturedErrors = []
const originalOnError = globalThis.Fez?.onError

beforeEach(() => {
  capturedErrors = []
  globalThis.Fez = globalThis.Fez || {}
  globalThis.Fez.onError = (kind, message, context) => {
    capturedErrors.push({ kind, message, context })
    return `Fez ${kind}: ${message}`
  }
})

afterEach(() => {
  capturedErrors = []
  if (originalOnError) {
    globalThis.Fez.onError = originalOnError
  }
})

describe('FezBase.fezError always includes component name', () => {
  test('includes fezName when set', () => {
    const instance = new FezBase()
    instance.fezName = 'my-component'
    instance.root = { tagName: 'MY-COMPONENT' }

    instance.fezError('test', 'Something went wrong')

    expect(capturedErrors.length).toBe(1)
    expect(capturedErrors[0].kind).toBe('test')
    expect(capturedErrors[0].message).toContain('<my-component>')
    expect(capturedErrors[0].message).toContain('Something went wrong')
  })

  test('falls back to tagName when fezName not set', () => {
    const instance = new FezBase()
    instance.fezName = null
    instance.root = { tagName: 'UI-BUTTON' }

    instance.fezError('attr', 'Invalid value')

    expect(capturedErrors[0].message).toContain('<ui-button>')
    expect(capturedErrors[0].message).toContain('Invalid value')
  })

  test('uses "unknown" when no name available', () => {
    const instance = new FezBase()
    instance.fezName = null
    instance.root = null

    instance.fezError('error', 'No component')

    expect(capturedErrors[0].message).toContain('<unknown>')
  })

  test('passes context through', () => {
    const instance = new FezBase()
    instance.fezName = 'test-comp'

    const errorContext = { line: 42, file: 'test.js' }
    instance.fezError('debug', 'With context', errorContext)

    expect(capturedErrors[0].context).toBe(errorContext)
    expect(capturedErrors[0].context.line).toBe(42)
  })
})

describe('Static method errors include component name', () => {
  test('getProps attr error includes tagName', () => {
    const node = {
      tagName: 'TEST-WIDGET',
      attributes: [{ name: ':bad', value: 'undefined_var' }]
    }
    const newNode = {}

    FezBase.getProps(node, newNode)

    expect(capturedErrors.length).toBe(1)
    expect(capturedErrors[0].kind).toBe('attr')
    expect(capturedErrors[0].message).toContain('<test-widget>')
  })

  test('getProps JSON error includes tagName', () => {
    const node = {
      tagName: 'DATA-VIEW',
      attributes: [{ name: 'data-props', value: 'invalid json{' }]
    }
    const newNode = {}

    FezBase.getProps(node, newNode)

    expect(capturedErrors.length).toBe(1)
    expect(capturedErrors[0].kind).toBe('props')
    expect(capturedErrors[0].message).toContain('<data-view>')
    expect(capturedErrors[0].message).toContain('Invalid JSON')
  })
})

describe('All error types include component name', () => {
  test('destroy error includes component name', () => {
    const instance = new FezBase()
    instance.fezName = 'cleanup-test'
    instance._onDestroyCallbacks = [() => { throw new Error('Cleanup failed') }]

    instance.fezOnDestroy()

    expect(capturedErrors.length).toBe(1)
    expect(capturedErrors[0].kind).toBe('destroy')
    expect(capturedErrors[0].message).toContain('<cleanup-test>')
    expect(capturedErrors[0].message).toContain('cleanup callback')
  })

  test('fez-use error includes component name', () => {
    const instance = new FezBase()
    instance.fezName = 'ui-modal'

    // Directly call fezError as afterRender would
    instance.fezError('fez-use', '"animate" is not a function')

    expect(capturedErrors.some(e =>
      e.kind === 'fez-use' && e.message.includes('<ui-modal>')
    )).toBe(true)
  })

  test('fez-bind error includes component name', () => {
    const instance = new FezBase()
    instance.fezName = 'form-input'

    // Directly call fezError as afterRender would
    instance.fezError('fez-bind', 'Can\'t bind "state.value" to DIV (needs INPUT, SELECT or TEXTAREA)')

    expect(capturedErrors.some(e =>
      e.kind === 'fez-bind' &&
      e.message.includes('<form-input>') &&
      e.message.includes('DIV')
    )).toBe(true)
  })
})

describe('Error message format consistency', () => {
  test('all errors follow <component-name> message format', () => {
    const instance = new FezBase()
    instance.fezName = 'test-component'

    // Trigger an error
    instance.fezError('custom', 'Custom error message')

    const error = capturedErrors[0]
    // Should match pattern: <component-name> message
    expect(error.message).toMatch(/^<[\w-]+> .+/)
  })

  test('component name is always lowercase', () => {
    const instance = new FezBase()
    instance.fezName = null
    instance.root = { tagName: 'MY-UPPERCASE-COMPONENT' }

    instance.fezError('test', 'Error')

    expect(capturedErrors[0].message).toContain('<my-uppercase-component>')
    expect(capturedErrors[0].message).not.toContain('MY-UPPERCASE')
  })
})

import { describe, test, expect } from 'bun:test'
import { $ } from 'bun'
import { glob } from 'glob'

const compile = async (...patterns) => {
  // Expand glob patterns
  const files = []
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      files.push(...await glob(pattern))
    } else {
      files.push(pattern)
    }
  }
  
  const result = await $`bin/fez-compile ${files}`.quiet().nothrow()
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

describe('fez compile', () => {
  describe('valid files', () => {
    test('compiles basic component', async () => {
      const result = await compile('spec/fixtures/valid/test-basic.fez')
      expect(result.exitCode).toBe(0)
    })

    test('compiles component with explicit class and const', async () => {
      const result = await compile('spec/fixtures/valid/test-with-class.fez')
      expect(result.exitCode).toBe(0)
    })

    test('compiles component with ES module import', async () => {
      const result = await compile('spec/fixtures/valid/test-with-import.fez')
      expect(result.exitCode).toBe(0)
    })

    test('compiles component with loops and conditionals', async () => {
      const result = await compile('spec/fixtures/valid/test-loops.fez')
      expect(result.exitCode).toBe(0)
    })

    test('compiles all valid files', async () => {
      const result = await compile('spec/fixtures/valid/*.fez')
      expect(result.exitCode).toBe(0)
    })
  })

  describe('invalid files - JavaScript errors', () => {
    test('detects incomplete assignment syntax error', async () => {
      const result = await compile('spec/fixtures/invalid/test-js-syntax.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unexpected')
    })

    test('detects missing closing brace', async () => {
      const result = await compile('spec/fixtures/invalid/test-js-missing-brace.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unexpected')
    })
  })

  describe('invalid files - template errors', () => {
    test('detects unmatched {{if}} block', async () => {
      const result = await compile('spec/fixtures/invalid/test-unmatched-if.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unmatched {{if}}')
    })

    test('detects unmatched {{for}} block', async () => {
      const result = await compile('spec/fixtures/invalid/test-unmatched-for.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unmatched {{for}}')
    })

    test('detects {{if}} inside attribute', async () => {
      const result = await compile('spec/fixtures/invalid/test-if-in-attribute.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('attribute')
    })
  })

  describe('invalid files - naming errors', () => {
    test('detects component name without dash', async () => {
      const result = await compile('spec/fixtures/invalid/badname.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('must contain a dash')
    })
  })

  describe('multiple files', () => {
    test('reports errors from multiple invalid files', async () => {
      const result = await compile('spec/fixtures/invalid/*.fez')
      expect(result.exitCode).toBe(1)
      // Should have multiple errors reported
      expect(result.stderr.split('\n').filter(l => l.trim()).length).toBeGreaterThan(1)
    })

    test('mixed valid and invalid files fails', async () => {
      const result = await compile('spec/fixtures/valid/test-basic.fez spec/fixtures/invalid/test-js-syntax.fez')
      expect(result.exitCode).toBe(1)
    })
  })

  describe('file not found', () => {
    test('reports error for missing file', async () => {
      const result = await compile('spec/fixtures/nonexistent.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('File not found')
    })
  })
})

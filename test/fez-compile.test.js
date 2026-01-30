import { describe, test, expect } from 'bun:test'
import { $ } from 'bun'

const compile = async (...files) => {
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
      const result = await compile('test/fixtures/valid/test-basic.fez')
      expect(result.exitCode).toBe(0)
    })

    test('compiles component with explicit class and const', async () => {
      const result = await compile('test/fixtures/valid/test-with-class.fez')
      expect(result.exitCode).toBe(0)
    })

    test('compiles component with ES module import', async () => {
      const result = await compile('test/fixtures/valid/test-with-import.fez')
      expect(result.exitCode).toBe(0)
    })

    test('compiles component with loops and conditionals', async () => {
      const result = await compile('test/fixtures/valid/test-loops.fez')
      expect(result.exitCode).toBe(0)
    })


  })

  describe('invalid files - JavaScript errors', () => {
    test('detects incomplete assignment syntax error', async () => {
      const result = await compile('test/fixtures/invalid/test-js-syntax.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unexpected')
    })

    test('detects missing closing brace', async () => {
      const result = await compile('test/fixtures/invalid/test-js-missing-brace.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unexpected')
    })
  })

  describe('invalid files - template errors', () => {
    test('detects unmatched {{if}} block', async () => {
      const result = await compile('test/fixtures/invalid/test-unmatched-if.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unmatched {{if}}')
    })

    test('detects unmatched {{for}} block', async () => {
      const result = await compile('test/fixtures/invalid/test-unmatched-for.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unmatched {{for}}')
    })

    test('detects {{if}} inside attribute', async () => {
      const result = await compile('test/fixtures/invalid/test-if-in-attribute.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('attribute')
    })
  })

  describe('invalid files - naming errors', () => {
    test('detects component name without dash', async () => {
      const result = await compile('test/fixtures/invalid/badname.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('must contain a dash')
    })
  })

  describe('single file only', () => {
    test('rejects multiple files', async () => {
      const result = await compile('test/fixtures/valid/test-basic.fez', 'test/fixtures/valid/test-loops.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Only one file')
    })
  })

  describe('output flag', () => {
    test('outputs compiled JavaScript with -o flag', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-basic.fez`.quiet().nothrow()
      expect(result.exitCode).toBe(0)
      const stdout = result.stdout.toString()
      expect(stdout).toMatch(/Fez\(\s*(["'])test-basic\1,/)
      expect(stdout).toContain('class {')
    })

    test('does not output on error even with -o flag', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/invalid/test-js-syntax.fez`.quiet().nothrow()
      expect(result.exitCode).toBe(1)
      expect(result.stdout.toString()).toBe('')
    })
  })

  describe('file not found', () => {
    test('reports error for missing file', async () => {
      const result = await compile('test/fixtures/nonexistent.fez')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('File not found')
    })
  })
})

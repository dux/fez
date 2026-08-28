import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';
import fs from 'fs';
import os from 'os';
import path from 'path';

const runTemplate = async (...args) => {
  const result = await $`bin/fez-template ${args}`.quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

const fixture = (name, content) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-template-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
};

describe('fez template', () => {
  test('validates a valid component template', async () => {
    const result = await runTemplate('test/fixtures/valid/test-basic.fez');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('template ok');
  });

  test('reports template compiler errors', async () => {
    const result = await runTemplate('test/fixtures/invalid/test-template-compiler-expression.fez');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Template compiler error');
    expect(result.stderr).toContain('Unexpected');
  });

  test('reports repeated invalid templates independently', async () => {
    const result = await runTemplate(
      'test/fixtures/invalid/test-template-compiler-expression.fez',
      'test/fixtures/invalid/test-template-compiler-expression.fez',
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).not.toContain('template ok');
    expect(result.stderr.match(/Template compiler error/g)?.length).toBe(2);
  });

  test('prints generated function body with --debug', async () => {
    const result = await runTemplate(
      '--debug',
      'test/fixtures/invalid/test-template-compiler-expression.fez',
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Generated template function');
    expect(result.stderr).toContain('const fez = this');
  });

  test('validates component definitions independently', async () => {
    const result = await runTemplate('docs/fez/bubble-alerter.fez');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('2 components');
  });

  test('does not discard normal header elements', async () => {
    const file = fixture('invalid-header.fez', `<header>\n  {state.}\n</header>`);
    const result = await runTemplate(file);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Template compiler error');
    expect(result.stderr).toContain('Unexpected');
  });

  test('reports directories without a runtime stack trace', async () => {
    const result = await runTemplate('test/fixtures/valid');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not a file');
    expect(result.stderr).not.toContain('Bun v');
  });

  test('reports unknown options without a runtime stack trace', async () => {
    const result = await runTemplate('--nope');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown option '--nope'");
    expect(result.stderr).not.toContain('TypeError');
  });
});

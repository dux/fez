import { describe, expect, test } from 'bun:test';
import { $ } from 'bun';
import fs from 'fs';
import os from 'os';
import path from 'path';

const FEZ = path.resolve(import.meta.dir, '../bin/fez');
const root = path.resolve(import.meta.dir, '..');

const run = async (args = [], cwd = root) => {
  const result = await $`${FEZ} ${args}`.cwd(cwd).quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fez-bin-'));

describe('fez dispatcher', () => {
  test('lists every supported command', async () => {
    const result = await run(['--help']);

    expect(result.exitCode).toBe(0);
    for (const command of ['agents', 'compile', 'debug', 'index', 'refactor', 'template']) {
      expect(result.stdout).toMatch(new RegExp(`^\\s+${command}\\s+`, 'm'));
    }
  });

  test('rejects invalid command names without invoking a shell', async () => {
    const result = await run(['../compile']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('is not a fez command');
    expect(result.stderr).not.toContain('TypeError');
  });
});

describe('fez index', () => {
  test('indexes a directory', async () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'one.js'), 'one\n');
    fs.writeFileSync(path.join(dir, 'two.css'), 'two\n');

    const result = await run(['index', dir]);
    const index = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(index.map((entry) => entry.file.base)).toEqual(['one', 'two']);
    expect(index.every((entry) => Number.isInteger(entry.file.created))).toBe(true);
  });

  test('accepts shell-expanded file arguments', async () => {
    const dir = tempDir();
    const first = path.join(dir, 'first.js');
    const second = path.join(dir, 'second.js');
    fs.writeFileSync(first, 'first\n');
    fs.writeFileSync(second, 'second\n');

    const result = await run(['index', first, second]);
    const index = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(0);
    expect(index.map((entry) => entry.file.path)).toEqual([first, second]);
  });

  test('reports unknown options cleanly', async () => {
    const result = await run(['index', '--nope']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown option '--nope'");
    expect(result.stderr).not.toContain('Bun v');
  });
});

describe('fez debug', () => {
  test('rejects invalid URLs before launching Playwright', async () => {
    const result = await run(['debug', 'not-a-url']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('invalid URL');
    expect(result.stderr).not.toContain('Protocol error');
    expect(result.stderr).not.toContain('Bun v');
  });

  test('opens a real page and exits its async REPL cleanly', async () => {
    const child = Bun.spawn({
      cmd: [FEZ, 'debug', '--headless', `file://${path.join(root, 'dev.html')}`],
      cwd: root,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });
    child.stdin.write('await page.title()\n.exit\n');
    child.stdin.end();

    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Page loaded:');
    expect(stdout).toContain("'Test page'");
    expect(stderr).toBe('');
  });
});

describe('fez refactor', () => {
  test('is exposed as a report-only command', async () => {
    const help = await run(['refactor', '--help']);
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain('report-only');

    const rejected = await run(['refactor', '--fix']);
    expect(rejected.exitCode).toBe(1);
    expect(rejected.stderr).toContain('Automatic fixes are intentionally unavailable');
  });
});

describe('published CLI wiring', () => {
  test('declares runtime dependencies and package scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

    expect(pkg.bin).toEqual({ fez: 'bin/fez' });
    expect(pkg.dependencies.playwright).toBeDefined();
    expect(pkg.devDependencies.playwright).toBeUndefined();
    expect(pkg.scripts.refactor).toBe('bun bin/fez-refactor');
    expect(pkg.scripts.release).toStartWith('bun publish');
    expect(Object.values(pkg.scripts).join('\n')).not.toMatch(/\b(?:npm|npx)\b/);
  });

  test('keeps every dispatched command executable', () => {
    for (const file of fs.readdirSync(path.join(root, 'bin'))) {
      if (file !== 'fez' && !file.startsWith('fez-')) continue;
      expect(fs.statSync(path.join(root, 'bin', file)).mode & 0o111).not.toBe(0);
    }
  });

  test('VS Code invokes the published fez binary', () => {
    const extension = fs.readFileSync(path.join(root, 'vscode/src/extension.js'), 'utf8');

    expect(extension).toContain('bunx @dinoreic/fez compile');
    expect(extension).not.toContain('bunx fez-compile');
  });
});

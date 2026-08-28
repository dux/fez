import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';
import fs from 'fs';
import os from 'os';
import path from 'path';

const compile = async (...files) => {
  const result = await $`bin/fez-compile ${files}`.quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

const fixture = (name, content) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fez-compile-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
};

const compileOutput = async (name, content) => {
  const file = fixture(name, content);
  const result = await $`bin/fez-compile -o ${file}`.quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

describe('fez compile', () => {
  describe('valid files', () => {
    test('compiles basic component', async () => {
      const result = await compile('test/fixtures/valid/test-basic.fez');
      expect(result.exitCode).toBe(0);
    });

    test('compiles component with explicit class and const', async () => {
      const result = await compile('test/fixtures/valid/test-with-class.fez');
      expect(result.exitCode).toBe(0);
    });

    test('compiles component with ES module import', async () => {
      const result = await compile('test/fixtures/valid/test-with-import.fez');
      expect(result.exitCode).toBe(0);
    });

    test('compiles component with loops and conditionals', async () => {
      const result = await compile('test/fixtures/valid/test-loops.fez');
      expect(result.exitCode).toBe(0);
    });

    test('compiles nested loop else inside if', async () => {
      const result = await compile('test/fixtures/valid/test-nested-loop-else.fez');
      expect(result.exitCode).toBe(0);
    });

    test('compiles files containing multiple component definitions', async () => {
      const result = await $`bin/fez-compile -o docs/fez/bubble-alerter.fez`.quiet().nothrow();
      const stdout = result.stdout.toString();

      expect(result.exitCode).toBe(0);
      expect(stdout).toContain('"bubble-parent"');
      expect(stdout).toContain('"bubble-trigger"');
    });

    test('compiles input-html component with ESM imports and template logic', async () => {
      const result = await compile('docs/fez/input-html.fez');
      expect(result.exitCode).toBe(0);
    });

    test('parses head blocks after script outside template HTML', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-head-after-script.fez`
        .quiet()
        .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain('<div>Body</div>');
      expect(stdout).not.toContain('<head>');
      expect(stdout).not.toContain('after-script.css');
    });

    test('preserves header elements in template HTML', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-header-element.fez`
        .quiet()
        .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain('<header');
      expect(stdout).toContain('<nav');
      expect(stdout).toContain('<div>Body</div>');
    });

    test('wraps a plain <style> block in :fez', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-basic.fez`
        .quiet()
        .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain('CSS = `:fez {');
      expect(stdout).not.toContain('CSS_GLOBAL');
    });

    test('emits <style global> verbatim as CSS_GLOBAL', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-style-global.fez`
        .quiet()
        .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain('CSS_GLOBAL = `.app-card {');
      // the global block must not pick up the component wrapper
      expect(stdout.split('CSS_GLOBAL')[1]).not.toContain(':fez');
    });

    test('passes :global() and at-rules through to the flattener', async () => {
      // Relocating these is the flattener's job at injection time (see
      // test/flatten-css.test.js), so the compiler must emit them untouched
      // rather than doing its own half-parse.
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-style-global-fn.fez`
        .quiet()
        .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);

      const scoped = stdout.split('CSS_GLOBAL')[0];
      expect(scoped).toContain(':global(.third-party-widget)');
      expect(scoped).toContain('@keyframes fade-in');
      expect(scoped).toContain('@keyframes spin-one-line');
      expect(scoped).toContain('@font-face');
      expect(scoped).toContain('@media (max-width: 500px)');
    });

    test('keeps scoped and global blocks in the same file', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-style-global.fez`
        .quiet()
        .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain('CSS = `:fez {');
      expect(stdout).toContain('background: gold;');
      expect(stdout).toContain('CSS_GLOBAL = `');
      expect(stdout).toContain('border: 1px solid #ddd;');
    });

    test('escapes backticks in scoped styles', async () => {
      const result = await compileOutput(
        'test-css-scoped-backtick.fez',
        '<style>\n/* why it is `bg` */\n.x { color: red; }\n</style>\n<div class="x">x</div>',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('why it is \\`bg\\`');
    });

    test('escapes backticks in global styles', async () => {
      const result = await compileOutput(
        'test-css-global-backtick.fez',
        '<style global>\n/* why it is `bg` */\n.x { color: red; }\n</style>\n<div class="x">x</div>',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('why it is \\`bg\\`');
    });

    test('keeps CSS interpolation syntax literal', async () => {
      const result = await compileOutput(
        'test-css-interpolation.fez',
        '<style>\n/* ${accent} */\n.x { color: red; }\n</style>\n<div class="x">x</div>',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('\\${accent}');
    });

    test('preserves CSS backslashes through generated JavaScript', async () => {
      const result = await compileOutput(
        'test-css-backslash.fez',
        '<style>\n.quote::before { content: "\\201C"; }\n</style>\n<div class="quote">x</div>',
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('content: "\\\\201C";');
    });

    test('escapes template literal characters in the runtime compiler', () => {
      const Fez = globalThis.window.Fez;
      const oldGlobalFez = globalThis.Fez;

      try {
        globalThis.Fez = Fez;
        Fez.compile(
          'test-css-runtime-escaping',
          '<style>\n/* `bg` ${accent} */\n.quote::before { content: "\\201C"; }\n</style>',
        );

        expect(Fez.index['test-css-runtime-escaping'].class.css).toContain('`bg` ${accent}');
        expect(Fez.index['test-css-runtime-escaping'].class.css).toContain('content: "\\201C";');
      } finally {
        globalThis.Fez = oldGlobalFez;
      }
    });
  });

  describe('invalid files - JavaScript errors', () => {
    test('detects incomplete assignment syntax error', async () => {
      const result = await compile('test/fixtures/invalid/test-js-syntax.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unexpected');
    });

    test('detects missing closing brace', async () => {
      const result = await compile('test/fixtures/invalid/test-js-missing-brace.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unexpected');
    });
  });

  describe('invalid files - style errors', () => {
    test('detects unterminated string in style block', async () => {
      const result = await compile('test/fixtures/invalid/test-style-unterminated-string.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unterminated');
      expect(result.stderr).toContain('.fez:10:');
    });

    test('detects unclosed brace in style block', async () => {
      const result = await compile('test/fixtures/invalid/test-style-unclosed-brace.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('unclosed { brace');
    });

    test('detects unterminated comment in style block', async () => {
      const result = await compile('test/fixtures/invalid/test-style-unterminated-comment.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unterminated');
      expect(result.stderr).toContain('comment');
    });

    test('rejects body { } in a scoped <style>', async () => {
      const result = await compile('test/fixtures/invalid/test-style-body-scoped.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('<style global>');
    });

    test('rejects :host', async () => {
      const result = await compile('test/fixtures/invalid/test-style-host.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(':host is not supported');
    });

    test('rejects :global() inside <style global>', async () => {
      const result = await compile('test/fixtures/invalid/test-style-global-in-global.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('already global');
    });

    test('rejects an author-written :fez selector', async () => {
      const result = await compile('test/fixtures/invalid/test-style-fez-selector.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('no longer an author-facing selector');
    });
  });

  describe('invalid files - template errors', () => {
    test('detects unmatched {{if}} block', async () => {
      const result = await compile('test/fixtures/invalid/test-unmatched-if.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unmatched {{if}}');
    });

    test('detects unmatched {{for}} block', async () => {
      const result = await compile('test/fixtures/invalid/test-unmatched-for.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unmatched {{for}}');
    });

    test('detects {{if}} inside attribute', async () => {
      const result = await compile('test/fixtures/invalid/test-if-in-attribute.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('attribute');
    });

    test('detects template compiler syntax errors', async () => {
      const result = await compile('test/fixtures/invalid/test-template-compiler-expression.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Template compiler error');
      expect(result.stderr).toContain('Unexpected');
    });

    test('prints generated template function with --debug-template', async () => {
      const result =
        await $`bin/fez-compile --debug-template test/fixtures/invalid/test-template-compiler-expression.fez`
          .quiet()
          .nothrow();
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain('Generated template function');
      expect(result.stderr.toString()).toContain('const fez = this');
    });

    test('reports an unclosed source block', async () => {
      const file = fixture(
        'unclosed-source.fez',
        `<script>\n  class {\n</script>\n<style>\n  color: red;`,
      );
      const result = await compile(file);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unclosed <style> block');
      expect(result.stderr).not.toContain('Bun v');
    });
  });

  describe('invalid files - naming errors', () => {
    test('detects component name without dash', async () => {
      const result = await compile('test/fixtures/invalid/badname.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('must contain a dash');
    });
  });

  describe('multiple files', () => {
    test('compiles every supplied file', async () => {
      const result = await compile(
        'test/fixtures/valid/test-basic.fez',
        'test/fixtures/valid/test-loops.fez',
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.match(/compiled without errors/g)?.length).toBe(2);
    });

    test('expands quoted globs', async () => {
      const result = await compile('test/fixtures/valid/test-basic*.fez');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test-basic.fez');
    });
  });

  describe('output flag', () => {
    test('outputs compiled JavaScript with -o flag', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/valid/test-basic.fez`
        .quiet()
        .nothrow();
      expect(result.exitCode).toBe(0);
      const stdout = result.stdout.toString();
      expect(stdout).toMatch(/Fez\(\s*(["'])test-basic\1,/);
      expect(stdout).toContain('class {');
    });

    test('does not output on error even with -o flag', async () => {
      const result = await $`bin/fez-compile -o test/fixtures/invalid/test-js-syntax.fez`
        .quiet()
        .nothrow();
      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toBe('');
    });
  });

  describe('file not found', () => {
    test('reports error for missing file', async () => {
      const result = await compile('test/fixtures/nonexistent.fez');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('File not found');
    });

    test('reports directories without a runtime stack trace', async () => {
      const result = await compile('test/fixtures/valid');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Not a file');
      expect(result.stderr).not.toContain('Bun v');
    });

    test('reports unknown options without a runtime stack trace', async () => {
      const result = await compile('--nope');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unknown option '--nope'");
      expect(result.stderr).not.toContain('TypeError');
      expect(result.stderr).not.toContain('Bun v');
    });
  });
});

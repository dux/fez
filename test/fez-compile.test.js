import { describe, test, expect } from "bun:test";
import { $ } from "bun";

const compile = async (...files) => {
  const result = await $`bin/fez-compile ${files}`.quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

describe("fez compile", () => {
  describe("valid files", () => {
    test("compiles basic component", async () => {
      const result = await compile("test/fixtures/valid/test-basic.fez");
      expect(result.exitCode).toBe(0);
    });

    test("compiles component with explicit class and const", async () => {
      const result = await compile("test/fixtures/valid/test-with-class.fez");
      expect(result.exitCode).toBe(0);
    });

    test("compiles component with ES module import", async () => {
      const result = await compile("test/fixtures/valid/test-with-import.fez");
      expect(result.exitCode).toBe(0);
    });

    test("compiles component with loops and conditionals", async () => {
      const result = await compile("test/fixtures/valid/test-loops.fez");
      expect(result.exitCode).toBe(0);
    });

    test("compiles nested loop else inside if", async () => {
      const result = await compile(
        "test/fixtures/valid/test-nested-loop-else.fez",
      );
      expect(result.exitCode).toBe(0);
    });

    test("compiles input-html component with ESM imports and template logic", async () => {
      const result = await compile("demo/fez/input-html.fez");
      expect(result.exitCode).toBe(0);
    });

    test("parses head blocks after script outside template HTML", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-head-after-script.fez`
          .quiet()
          .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain("<div>Body</div>");
      expect(stdout).not.toContain("<head>");
      expect(stdout).not.toContain("after-script.css");
    });

    test("preserves header elements in template HTML", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-header-element.fez`
          .quiet()
          .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain("<header");
      expect(stdout).toContain("<nav");
      expect(stdout).toContain("<div>Body</div>");
    });

    test("wraps a plain <style> block in :fez", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-basic.fez`
          .quiet()
          .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain("CSS = `:fez {");
      expect(stdout).not.toContain("CSS_GLOBAL");
    });

    test("emits <style global> verbatim as CSS_GLOBAL", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-style-global.fez`
          .quiet()
          .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain("CSS_GLOBAL = `.app-card {");
      // the global block must not pick up the component wrapper
      expect(stdout.split("CSS_GLOBAL")[1]).not.toContain(":fez");
    });

    test("hoists :global(...) out of a scoped block", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-style-global-fn.fez`
          .quiet()
          .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);

      const [scoped, global] = stdout.split("CSS_GLOBAL");
      // scoped keeps its own rules and loses the hoisted ones
      expect(scoped).toContain(".card { color: red; }");
      expect(scoped).not.toContain("third-party-widget");
      // hoisted rules lose the wrapper but keep their nesting
      expect(global).toContain(".third-party-widget {");
      expect(global).toContain(".inner { color: blue; }");
      expect(global).toContain(".one-liner { margin: 0; }");
      expect(stdout).not.toContain(":global(");
    });

    test("hoists at-rules that cannot nest, keeps @media scoped", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-style-global-fn.fez`
          .quiet()
          .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);

      const [scoped, global] = stdout.split("CSS_GLOBAL");
      // wrapping these in :fez { } buries them and the browser drops them
      expect(scoped).not.toContain("@keyframes");
      expect(scoped).not.toContain("@font-face");
      expect(global).toContain("@keyframes fade-in {");
      expect(global).toContain("@font-face {");
      // @media nests legally, so it must stay with the component
      expect(scoped).toContain("@media (max-width: 500px)");
      expect(global).not.toContain("@media");
    });

    test("keeps scoped and global blocks in the same file", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-style-global.fez`
          .quiet()
          .nothrow();
      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(0);
      expect(stdout).toContain("CSS = `:fez {");
      expect(stdout).toContain("background: gold;");
      expect(stdout).toContain("CSS_GLOBAL = `");
      expect(stdout).toContain("border: 1px solid #ddd;");
    });
  });

  describe("invalid files - JavaScript errors", () => {
    test("detects incomplete assignment syntax error", async () => {
      const result = await compile("test/fixtures/invalid/test-js-syntax.fez");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unexpected");
    });

    test("detects missing closing brace", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-js-missing-brace.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unexpected");
    });
  });

  describe("invalid files - style errors", () => {
    test("detects unterminated string in style block", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-style-unterminated-string.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unterminated");
    });

    test("detects unclosed brace in style block", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-style-unclosed-brace.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("unclosed { brace");
    });

    test("detects unterminated comment in style block", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-style-unterminated-comment.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unterminated");
      expect(result.stderr).toContain("comment");
    });

    test("rejects body { } in a scoped <style>", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-style-body-scoped.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("<style global>");
    });

    test("rejects :host", async () => {
      const result = await compile("test/fixtures/invalid/test-style-host.fez");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(":host is not supported");
    });

    test("rejects :global() inside <style global>", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-style-global-in-global.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("already global");
    });

    test("rejects an author-written :fez selector", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-style-fez-selector.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("no longer an author-facing selector");
    });
  });

  describe("invalid files - template errors", () => {
    test("detects unmatched {{if}} block", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-unmatched-if.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unmatched {{if}}");
    });

    test("detects unmatched {{for}} block", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-unmatched-for.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Unmatched {{for}}");
    });

    test("detects {{if}} inside attribute", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-if-in-attribute.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("attribute");
    });

    test("detects template compiler syntax errors", async () => {
      const result = await compile(
        "test/fixtures/invalid/test-template-compiler-expression.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Template compiler error");
      expect(result.stderr).toContain("Unexpected");
    });

    test("prints generated template function with --debug-template", async () => {
      const result =
        await $`bin/fez-compile --debug-template test/fixtures/invalid/test-template-compiler-expression.fez`
          .quiet()
          .nothrow();
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain("Generated template function");
      expect(result.stderr.toString()).toContain("const fez = this");
    });
  });

  describe("invalid files - naming errors", () => {
    test("detects component name without dash", async () => {
      const result = await compile("test/fixtures/invalid/badname.fez");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("must contain a dash");
    });
  });

  describe("single file only", () => {
    test("rejects multiple files", async () => {
      const result = await compile(
        "test/fixtures/valid/test-basic.fez",
        "test/fixtures/valid/test-loops.fez",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Only one file");
    });
  });

  describe("output flag", () => {
    test("outputs compiled JavaScript with -o flag", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/valid/test-basic.fez`
          .quiet()
          .nothrow();
      expect(result.exitCode).toBe(0);
      const stdout = result.stdout.toString();
      expect(stdout).toMatch(/Fez\(\s*(["'])test-basic\1,/);
      expect(stdout).toContain("class {");
    });

    test("does not output on error even with -o flag", async () => {
      const result =
        await $`bin/fez-compile -o test/fixtures/invalid/test-js-syntax.fez`
          .quiet()
          .nothrow();
      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toBe("");
    });
  });

  describe("file not found", () => {
    test("reports error for missing file", async () => {
      const result = await compile("test/fixtures/nonexistent.fez");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("File not found");
    });
  });
});

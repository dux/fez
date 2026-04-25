import { describe, test, expect } from "bun:test";
import { $ } from "bun";

const runTemplate = async (...args) => {
  const result = await $`bin/fez-template ${args}`.quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

describe("fez template", () => {
  test("validates a valid component template", async () => {
    const result = await runTemplate("test/fixtures/valid/test-basic.fez");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("template ok");
  });

  test("reports template compiler errors", async () => {
    const result = await runTemplate(
      "test/fixtures/invalid/test-template-compiler-expression.fez",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Template compiler error");
    expect(result.stderr).toContain("Unexpected");
  });

  test("reports repeated invalid templates independently", async () => {
    const result = await runTemplate(
      "test/fixtures/invalid/test-template-compiler-expression.fez",
      "test/fixtures/invalid/test-template-compiler-expression.fez",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).not.toContain("template ok");
    expect(result.stderr.match(/Template compiler error/g)?.length).toBe(2);
  });

  test("prints generated function body with --debug", async () => {
    const result = await runTemplate(
      "--debug",
      "test/fixtures/invalid/test-template-compiler-expression.fez",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Generated template function");
    expect(result.stderr).toContain("const fez = this");
  });
});

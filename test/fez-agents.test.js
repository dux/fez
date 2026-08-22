import { describe, test, expect } from "bun:test";
import { $ } from "bun";
import fs from "fs";
import os from "os";
import path from "path";

const BIN = path.resolve(import.meta.dir, "../bin/fez-agents");
const FEZ = path.resolve(import.meta.dir, "../bin/fez");

const run = async (bin, args = [], cwd = process.cwd()) => {
  const result = await $`${bin} ${args}`.cwd(cwd).quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "fez-agents-"));

describe("fez agents", () => {
  test("--info prints a one-line description", async () => {
    const r = await run(BIN, ["--info"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.trim().split("\n").length).toBe(1);
    expect(r.stdout).toContain("AGENTS.md");
  });

  test("--help shows source path and repo", async () => {
    const r = await run(BIN, ["--help"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Source: ");
    expect(r.stdout).toContain("https://github.com/dux/fez");
    expect(r.stdout).toContain("--init");
  });

  test("default output skips the repo-local section", async () => {
    const r = await run(BIN);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("# Fez JS lib Quick Reference for AI Assistants");
    expect(r.stdout).not.toContain("Instructions for this local fez repo");
    expect(r.stdout).toContain("https://github.com/dux/fez");
  });

  test("--full prints the whole file", async () => {
    const r = await run(BIN, ["--full"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Instructions for this local fez repo");
    expect(r.stdout).toContain("# Fez JS lib Quick Reference for AI Assistants");
  });

  test("unknown option fails", async () => {
    const r = await run(BIN, ["--nope"]);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/unknown option '--nope'/i);
  });

  test("--init creates AGENTS.md and is idempotent", async () => {
    const dir = tmpDir();
    const agents = path.join(dir, "AGENTS.md");

    let r = await run(BIN, ["--init"], dir);
    expect(r.exitCode).toBe(0);
    expect(fs.existsSync(agents)).toBe(true);
    const first = fs.readFileSync(agents, "utf8");
    expect(first).toContain("run `fez agents`");
    expect(fs.existsSync(path.join(dir, "CLAUDE.md"))).toBe(false);

    r = await run(BIN, ["--init"], dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("skipped");
    expect(fs.readFileSync(agents, "utf8")).toBe(first);
  });

  test("--init appends to existing AGENTS.md and CLAUDE.md", async () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# My project\n");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Claude notes\n");

    const r = await run(BIN, ["--init"], dir);
    expect(r.exitCode).toBe(0);

    const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
    expect(agents.startsWith("# My project\n\n## Fez components")).toBe(true);
    expect(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8")).toContain("run `fez agents`");
  });

  test("--init leaves CLAUDE.md alone when it imports @AGENTS.md", async () => {
    const dir = tmpDir();
    const claude = "@AGENTS.md\n";
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), claude);

    const r = await run(BIN, ["--init"], dir);
    expect(r.exitCode).toBe(0);
    expect(fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8")).toBe(claude);
    expect(fs.existsSync(path.join(dir, "AGENTS.md"))).toBe(true);
  });
});

describe("fez (dispatcher)", () => {
  test("no-arg help lists agents command, source and repo", async () => {
    const r = await run(FEZ);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^\s+agents\s+/m);
    expect(r.stdout).toContain("Source: ");
    expect(r.stdout).toContain("https://github.com/dux/fez");
  });
});

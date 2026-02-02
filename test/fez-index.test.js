import { describe, test, expect, beforeEach } from "bun:test";
import { $ } from "bun";

// Get Fez from global scope (set up by test preload)
const getFez = () => globalThis.window.Fez;

const compile = async (...files) => {
  const result = await $`bin/fez-compile ${files}`.quiet().nothrow();
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
};

describe("Fez.index", () => {
  describe("structure", () => {
    test("Fez.index exists as an object", () => {
      const Fez = getFez();
      expect(typeof Fez.index).toBe("object");
    });

    test("Fez.index.ensure exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.index.ensure).toBe("function");
    });

    test("Fez.index.get exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.index.get).toBe("function");
    });

    test("Fez.index.apply exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.index.apply).toBe("function");
    });

    test("Fez.index.names exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.index.names).toBe("function");
    });

    test("Fez.index.withDemo exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.index.withDemo).toBe("function");
    });

    test("Fez.index.all exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.index.all).toBe("function");
    });

    test("Fez.index.info exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.index.info).toBe("function");
    });
  });

  describe("ensure()", () => {
    test("creates entry with all fields", () => {
      const Fez = getFez();
      const entry = Fez.index.ensure("test-ensure-component");

      expect(entry).toHaveProperty("class");
      expect(entry).toHaveProperty("meta");
      expect(entry).toHaveProperty("demo");
      expect(entry).toHaveProperty("info");
      expect(entry).toHaveProperty("source");
    });

    test("returns existing entry if already exists", () => {
      const Fez = getFez();
      const entry1 = Fez.index.ensure("test-ensure-existing");
      entry1.demo = "<p>Test</p>";

      const entry2 = Fez.index.ensure("test-ensure-existing");
      expect(entry2.demo).toBe("<p>Test</p>");
      expect(entry1).toBe(entry2);
    });
  });

  describe("get()", () => {
    test("returns object with all fields for non-existent component", () => {
      const Fez = getFez();
      const result = Fez.index.get("non-existent-component");

      expect(typeof result).toBe("object");
      expect(result.class).toBeNull();
      expect(result.meta).toBeNull();
      expect(result.demo).toBeNull();
      expect(result.info).toBeNull();
      expect(result.source).toBeNull();
    });

    test("returns DIV wrapper with demo content", () => {
      const Fez = getFez();
      Fez.index.ensure("test-get-demo").demo = "<p>Hello World</p>";

      const result = Fez.index.get("test-get-demo");
      expect(result.demo).not.toBeNull();
      expect(result.demo.tagName.toUpperCase()).toBe("DIV");
      expect(result.demo.innerHTML).toBe("<p>Hello World</p>");
    });

    test("returns DIV wrapper with info content", () => {
      const Fez = getFez();
      Fez.index.ensure("test-get-info").info = "<h1>Title</h1>";

      const result = Fez.index.get("test-get-info");
      expect(result.info).not.toBeNull();
      expect(result.info.tagName.toUpperCase()).toBe("DIV");
      expect(result.info.innerHTML).toBe("<h1>Title</h1>");
    });

    test("returns meta object", () => {
      const Fez = getFez();
      Fez.index.ensure("test-get-meta").meta = {
        version: "1.0",
        author: "Test",
      };

      const result = Fez.index.get("test-get-meta");
      expect(result.meta).toEqual({ version: "1.0", author: "Test" });
    });
  });

  describe("names()", () => {
    test("returns array of component names", () => {
      const Fez = getFez();
      Fez.index.ensure("test-names-one");
      Fez.index.ensure("test-names-two");

      const names = Fez.index.names();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain("test-names-one");
      expect(names).toContain("test-names-two");
    });

    test("does not include method names", () => {
      const Fez = getFez();
      const names = Fez.index.names();

      expect(names).not.toContain("ensure");
      expect(names).not.toContain("get");
      expect(names).not.toContain("apply");
      expect(names).not.toContain("names");
      expect(names).not.toContain("withDemo");
      expect(names).not.toContain("all");
    });
  });

  describe("withDemo()", () => {
    test("returns only components with demos", () => {
      const Fez = getFez();
      Fez.index.ensure("test-with-demo-yes").demo = "<p>Demo</p>";
      Fez.index.ensure("test-with-demo-no");

      const withDemo = Fez.index.withDemo();
      expect(withDemo).toContain("test-with-demo-yes");
      expect(withDemo).not.toContain("test-with-demo-no");
    });
  });

  describe("all()", () => {
    test("returns object with all components", () => {
      const Fez = getFez();
      Fez.index.ensure("test-all-one").demo = "<p>Demo One</p>";
      Fez.index.ensure("test-all-two").info = "<h1>Info Two</h1>";

      const all = Fez.index.all();
      expect(typeof all).toBe("object");
      expect(all["test-all-one"]).toBeDefined();
      expect(all["test-all-two"]).toBeDefined();
    });
  });
});

describe("META support", () => {
  test("META is stored in Fez.index[name].meta", () => {
    const Fez = getFez();
    const meta = { version: "2.0", tags: ["ui", "button"] };
    Fez.index.ensure("test-meta-store").meta = meta;

    expect(Fez.index["test-meta-store"].meta).toEqual(meta);
  });

  test("Fez.index.get() returns meta", () => {
    const Fez = getFez();
    const meta = { author: "John" };
    Fez.index.ensure("test-meta-get").meta = meta;

    const result = Fez.index.get("test-meta-get");
    expect(result.meta).toEqual(meta);
  });
});

describe("component compilation with index", () => {
  test("compiles component with demo section", async () => {
    const result = await compile("test/fixtures/valid/test-with-demo.fez");
    expect(result.exitCode).toBe(0);
  });

  test("compiles component with info section", async () => {
    const result = await compile("test/fixtures/valid/test-with-info.fez");
    expect(result.exitCode).toBe(0);
  });

  test("compiles component with META section", async () => {
    const result = await compile("test/fixtures/valid/test-with-meta.fez");
    expect(result.exitCode).toBe(0);
  });
});

describe("demo section parsing", () => {
  // Test the parsing logic by simulating what compileToClass does
  const parseDemoAndInfo = (html) => {
    const result = { demo: "", info: "", script: "" };
    const lines = html.split("\n");
    let block = [];
    let type = "";

    for (let line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("<demo") && !result.demo && !type) {
        type = "demo";
      } else if (trimmedLine.startsWith("<info") && !result.info && !type) {
        type = "info";
      } else if (
        trimmedLine.startsWith("<script") &&
        !result.script &&
        type !== "demo" &&
        type !== "info"
      ) {
        type = "script";
      } else if (trimmedLine.endsWith("</demo>") && type === "demo") {
        result.demo = block.join("\n");
        block = [];
        type = "";
      } else if (trimmedLine.endsWith("</info>") && type === "info") {
        result.info = block.join("\n");
        block = [];
        type = "";
      } else if (
        trimmedLine.endsWith("</script>") &&
        type === "script" &&
        !result.script
      ) {
        result.script = block.join("\n");
        block = [];
        type = "";
      } else if (type === "demo" || type === "info") {
        block.push(line);
      } else if (type === "script") {
        block.push(trimmedLine);
      }
    }

    return result;
  };

  test("extracts demo content from component", () => {
    const html = `<demo>
<ui-button>Click me</ui-button>
</demo>
<script>
  init() {}
</script>`;

    const result = parseDemoAndInfo(html);
    expect(result.demo).toContain("<ui-button>Click me</ui-button>");
  });

  test("extracts info content from component", () => {
    const html = `<info>
<h1>Component Title</h1>
<p>Description here</p>
</info>
<script>
  init() {}
</script>`;

    const result = parseDemoAndInfo(html);
    expect(result.info).toContain("<h1>Component Title</h1>");
    expect(result.info).toContain("<p>Description here</p>");
  });

  test("extracts both demo and info from component", () => {
    const html = `<info>
<h1>Title</h1>
</info>
<demo>
<my-component></my-component>
</demo>
<script>
  init() {}
</script>`;

    const result = parseDemoAndInfo(html);
    expect(result.info).toContain("<h1>Title</h1>");
    expect(result.demo).toContain("<my-component></my-component>");
  });

  test("preserves script tags inside demo (not captured as component script)", () => {
    const html = `<demo>
<div id="app"></div>
<script>
  document.getElementById('app').textContent = 'loaded'
</script>
</demo>
<script>
  init() {}
</script>`;

    const result = parseDemoAndInfo(html);
    expect(result.demo).toContain("<script>");
    expect(result.demo).toContain("document.getElementById('app')");
    expect(result.script).toContain("init()");
    expect(result.script).not.toContain("getElementById");
  });

  test("preserves indentation in demo and info", () => {
    const html = `<info>
  <div class="info">
    <span>Nested</span>
  </div>
</info>
<demo>
  <div class="demo">
    <span>Nested</span>
  </div>
</demo>`;

    const result = parseDemoAndInfo(html);
    expect(result.info).toContain('  <div class="info">');
    expect(result.demo).toContain('  <div class="demo">');
  });
});

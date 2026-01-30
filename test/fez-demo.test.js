import { describe, test, expect } from "bun:test";
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

describe("fez demo feature", () => {
  describe("Fez.demo namespace", () => {
    test("Fez.demo exists as an object", () => {
      const Fez = getFez();
      expect(typeof Fez.demo).toBe("object");
    });

    test("Fez.demo.list exists as an object", () => {
      const Fez = getFez();
      expect(typeof Fez.demo.list).toBe("object");
    });

    test("Fez.demo.infoList exists as an object", () => {
      const Fez = getFez();
      expect(typeof Fez.demo.infoList).toBe("object");
    });

    test("Fez.demo.get exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.demo.get).toBe("function");
    });

    test("Fez.demo.all exists as a function", () => {
      const Fez = getFez();
      expect(typeof Fez.demo.all).toBe("function");
    });
  });

  describe("Fez.demo.get()", () => {
    test("returns object with info and demo keys", () => {
      const Fez = getFez();
      const result = Fez.demo.get("non-existent-component");
      expect(typeof result).toBe("object");
      expect("info" in result).toBe(true);
      expect("demo" in result).toBe(true);
    });

    test("returns null values for non-existent component", () => {
      const Fez = getFez();
      const result = Fez.demo.get("non-existent-component");
      expect(result.info).toBeNull();
      expect(result.demo).toBeNull();
    });

    test("returns DIV wrapper with demo content", () => {
      const Fez = getFez();

      Fez.demo.list["test-demo-component"] = "<p>Hello World</p>";

      const result = Fez.demo.get("test-demo-component");
      expect(result.demo).not.toBeNull();
      expect(result.demo.tagName.toUpperCase()).toBe("DIV");
      expect(result.demo.innerHTML).toBe("<p>Hello World</p>");
    });

    test("returns DIV wrapper with info content", () => {
      const Fez = getFez();

      Fez.demo.infoList["test-info-component"] = "<h1>Title</h1>";

      const result = Fez.demo.get("test-info-component");
      expect(result.info).not.toBeNull();
      expect(result.info.tagName.toUpperCase()).toBe("DIV");
      expect(result.info.innerHTML).toBe("<h1>Title</h1>");
    });

    test("returns both demo and info when both exist", () => {
      const Fez = getFez();

      Fez.demo.list["test-both"] = "<p>Demo content</p>";
      Fez.demo.infoList["test-both"] = "<h1>Info content</h1>";

      const result = Fez.demo.get("test-both");
      expect(result.demo).not.toBeNull();
      expect(result.info).not.toBeNull();
      expect(result.demo.innerHTML).toBe("<p>Demo content</p>");
      expect(result.info.innerHTML).toBe("<h1>Info content</h1>");
    });

    test("preserves script tags in demo content", () => {
      const Fez = getFez();

      Fez.demo.list["test-script-demo"] =
        '<div>Content</div>\n<script>console.log("test")</script>';

      const result = Fez.demo.get("test-script-demo");
      expect(result.demo.innerHTML).toContain("<script>");
      expect(result.demo.innerHTML).toContain("console.log");
    });

    test("preserves indentation in demo content", () => {
      const Fez = getFez();

      const demoContent = "  <div>\n    <span>Indented</span>\n  </div>";
      Fez.demo.list["test-indent-demo"] = demoContent;

      const result = Fez.demo.get("test-indent-demo");
      expect(result.demo.innerHTML).toBe(demoContent);
    });

    test("preserves indentation in info content", () => {
      const Fez = getFez();

      const infoContent = "  <div>\n    <span>Indented</span>\n  </div>";
      Fez.demo.infoList["test-indent-info"] = infoContent;

      const result = Fez.demo.get("test-indent-info");
      expect(result.info.innerHTML).toBe(infoContent);
    });
  });

  describe("Fez.demo.all()", () => {
    test("returns all components as object with info and demo keys", () => {
      const Fez = getFez();

      // Clear existing data
      for (const key of Object.keys(Fez.demo.list)) delete Fez.demo.list[key];
      for (const key of Object.keys(Fez.demo.infoList))
        delete Fez.demo.infoList[key];

      Fez.demo.list["comp-one"] = "<p>Demo One</p>";
      Fez.demo.infoList["comp-one"] = "<h1>Info One</h1>";
      Fez.demo.list["comp-two"] = "<p>Demo Two</p>";

      const allDemos = Fez.demo.all();
      expect(typeof allDemos).toBe("object");
      expect(Object.keys(allDemos)).toContain("comp-one");
      expect(Object.keys(allDemos)).toContain("comp-two");

      expect(allDemos["comp-one"].demo.innerHTML).toBe("<p>Demo One</p>");
      expect(allDemos["comp-one"].info.innerHTML).toBe("<h1>Info One</h1>");
      expect(allDemos["comp-two"].demo.innerHTML).toBe("<p>Demo Two</p>");
      expect(allDemos["comp-two"].info).toBeNull();
    });

    test("returns empty object when no demos or infos defined", () => {
      const Fez = getFez();

      // Clear all data
      for (const key of Object.keys(Fez.demo.list)) delete Fez.demo.list[key];
      for (const key of Object.keys(Fez.demo.infoList))
        delete Fez.demo.infoList[key];

      const allDemos = Fez.demo.all();
      expect(typeof allDemos).toBe("object");
      expect(Object.keys(allDemos).length).toBe(0);
    });

    test("includes components that only have info", () => {
      const Fez = getFez();

      // Clear all data
      for (const key of Object.keys(Fez.demo.list)) delete Fez.demo.list[key];
      for (const key of Object.keys(Fez.demo.infoList))
        delete Fez.demo.infoList[key];

      Fez.demo.infoList["info-only"] = "<h1>Only info</h1>";

      const allDemos = Fez.demo.all();
      expect(Object.keys(allDemos)).toContain("info-only");
      expect(allDemos["info-only"].info.innerHTML).toBe("<h1>Only info</h1>");
      expect(allDemos["info-only"].demo).toBeNull();
    });
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

describe("fez compile with demo and info", () => {
  test("compiles component with demo section", async () => {
    const result = await compile("test/fixtures/valid/test-with-demo.fez");
    expect(result.exitCode).toBe(0);
  });

  test("compiles component with info section", async () => {
    const result = await compile("test/fixtures/valid/test-with-info.fez");
    expect(result.exitCode).toBe(0);
  });
});

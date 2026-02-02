import { test, expect } from "bun:test";
import fs from "fs";

test("Fez source file exists", () => {
  const fezExists = fs.existsSync("./src/fez.js");
  expect(fezExists).toBe(true);
});

test("Fez can be imported", async () => {
  const Fez = globalThis.window.Fez;

  expect(typeof Fez).toBe("function");
  expect(typeof Fez.index).toBe("object");
});

test("Components can be defined", async () => {
  const Fez = globalThis.window.Fez;

  // Only test if Fez is properly loaded
  if (Fez) {
    Fez(
      "test-component",
      class {
        init() {
          this.state = { value: "test" };
        }
      },
    );

    expect(Fez.index["test-component"]).toBeDefined();
    expect(Fez.index["test-component"].class).toBeDefined();
  } else {
    throw new Error("Fez not properly loaded");
  }
});

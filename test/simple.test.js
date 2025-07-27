import { test, expect } from "bun:test";
import fs from 'fs';

// Set up minimal globals for Fez BEFORE import
globalThis.document = {
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
  querySelector: () => null,
  addEventListener: () => {},
  documentElement: { matches: () => false },
  head: { appendChild: () => {} },
  body: { 
    appendChild: () => {},
    parentElement: { classList: { add: () => {} } }
  }
};

globalThis.window = {
  customElements: {
    define: () => {},
    get: () => null
  },
  document: globalThis.document,
  requestAnimationFrame: (callback) => setTimeout(callback, 16),
  Fez: null,
  FezBase: null
};

globalThis.HTMLElement = function() {};
globalThis.CustomEvent = function() {};
globalThis.MutationObserver = function() {
  this.observe = () => {};
  this.disconnect = () => {};
};
globalThis.customElements = {
  define: () => {},
  get: () => null
};

test("Fez source file exists", () => {
  const fezExists = fs.existsSync('./src/fez.js');
  expect(fezExists).toBe(true);
});

test("Fez can be imported", async () => {
  await import('../src/fez.js');
  const Fez = globalThis.window.Fez;
  
  expect(typeof Fez).toBe('function');
  expect(typeof Fez.classes).toBe('object');
});

test("Components can be defined", () => {
  const Fez = globalThis.window.Fez;
  Fez('test-component', class {
    init() {
      this.state = { value: 'test' };
    }
  });
  
  expect(Fez.classes['test-component']).toBeDefined();
});
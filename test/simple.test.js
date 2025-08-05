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

// Make Fez available globally for defaults.js
globalThis.Fez = null;

test("Fez source file exists", () => {
  const fezExists = fs.existsSync('./src/fez.js');
  expect(fezExists).toBe(true);
});

test("Fez can be imported", async () => {
  await import('../src/fez.js');
  const Fez = globalThis.window.Fez;
  
  // Load defaults after Fez is available
  if (Fez && typeof require === 'function') {
    await import('../src/fez/defaults.js');
  }
  
  expect(typeof Fez).toBe('function');
  expect(typeof Fez.classes).toBe('object');
});

test("Components can be defined", async () => {
  // Ensure Fez is imported if not already
  if (!globalThis.window.Fez) {
    await import('../src/fez.js');
  }
  
  const Fez = globalThis.window.Fez;
  
  // Only test if Fez is properly loaded
  if (Fez) {
    Fez('test-component', class {
      init() {
        this.state = { value: 'test' };
      }
    });
    
    expect(Fez.classes['test-component']).toBeDefined();
  } else {
    throw new Error('Fez not properly loaded');
  }
});
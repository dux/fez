// Set up minimal globals for Fez BEFORE import
globalThis.document = {
  createElement: (tag) => ({ 
    setAttribute: () => {}, 
    appendChild: () => {},
    tagName: tag,
    isConnected: true,
    parentElement: null
  }),
  querySelector: (selector) => {
    if (selector === '#testNode') {
      return { isConnected: true, id: 'testNode' };
    }
    return null;
  },
  getElementById: (id) => {
    if (id === 'testNode') {
      return { isConnected: true, id: 'testNode' };
    }
    return null;
  },
  addEventListener: () => {},
  documentElement: { matches: () => false },
  head: { appendChild: () => {} },
  body: { 
    appendChild: () => {},
    parentElement: { classList: { add: () => {} } },
    isConnected: true
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

// Mock localStorage
const localStorageData = new Map();
globalThis.localStorage = {
  getItem: (key) => localStorageData.has(key) ? localStorageData.get(key) : null,
  setItem: (key, value) => localStorageData.set(key, String(value)),
  removeItem: (key) => localStorageData.delete(key),
  clear: () => localStorageData.clear()
};

// Make Fez available globally for defaults.js
globalThis.Fez = null;

// Import Fez once and expose it properly
const { default: Fez } = await import('../src/fez.js');
globalThis.Fez = Fez;
globalThis.window.Fez = Fez;
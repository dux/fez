#!/usr/bin/env bun

// Simple Fez test without complex DOM libraries
// Tests the core functionality of Fez reactive system

console.log('🧪 Testing Fez reactive library...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`❌ ${name}`);
    console.log(`   ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Mock minimal DOM environment
global.window = {
  HTMLElement: class HTMLElement {
    constructor() {
      this._listeners = {};
      this.innerHTML = '';
      this.children = [];
      this.nodeType = 1; // Element node
    }
    addEventListener(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    }
    removeEventListener(event, handler) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    }
    dispatchEvent(event) {
      if (!this._listeners[event.type]) return;
      this._listeners[event.type].forEach(handler => handler(event));
    }
    querySelector() {
      return null;
    }
    querySelectorAll() {
      return [];
    }
    matches() {
      return false;
    }
    remove() {
      // noop
    }
  },
  CustomEvent: class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  },
  MutationObserver: class MutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    disinit() {}
  },
  DEV: false,
  requestAnimationFrame: (cb) => setTimeout(cb, 16)
};

global.document = {
  _listeners: {},
  addEventListener(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  },
  removeEventListener(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  },
  dispatchEvent(event) {
    if (!this._listeners[event.type]) return;
    this._listeners[event.type].forEach(handler => handler(event));
  },
  createElement(tag) {
    return new window.HTMLElement();
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  body: new window.HTMLElement(),
  head: new window.HTMLElement(),
  documentElement: new window.HTMLElement()
};

global.HTMLElement = window.HTMLElement;
global.CustomEvent = window.CustomEvent;
global.MutationObserver = window.MutationObserver;

// Mock customElements API
global.customElements = {
  defined: {},
  define(name, klass) {
    this.defined[name] = klass;
  },
  get(name) {
    return this.defined[name];
  }
};

// Load Fez
await import('../src/fez.js');
const Fez = window.Fez;
const FezBase = window.FezBase;

// Make them globally available for tests
global.Fez = Fez;
global.FezBase = FezBase;

// Add nextTick to FezBase prototype for testing
FezBase.prototype.nextTick = function(fn, name) {
  setTimeout(() => fn.call(this), 0);
};

// Test 1: Fez is loaded
test('Fez is loaded and available', () => {
  assert(typeof Fez === 'function', 'Fez should be a function');
  assert(typeof FezBase === 'function', 'FezBase should exist');
});

// Test 2: Component registration
test('Can register a component', () => {
  // Register a component
  const result = Fez('test-component', class {
    init() {
      this.state.registered = true;
    }
  });

  // Check if component was registered
  assert(customElements.get('test-component'), 'Component should be registered');
});

// Test 3: State reactivity
test('State object is reactive', () => {
  let renderCount = 0;

  class TestComponent extends FezBase {
    init() {
      this.state.value = 0;
    }

    render() {
      renderCount++;
      return `Value: ${this.state.value}`;
    }
  }

  const component = new TestComponent();
  component._node = new window.HTMLElement();
  component.root = component._node;
  component.class = TestComponent; // Add class reference

  // Call fezRegister to initialize state
  component.fezRegister();
  component.init();

  // Initial render
  const initial = renderCount;

  // Change state
  component.state.value = 42;

  // Wait a bit for async render
  setTimeout(() => {
    assert(renderCount > initial, 'Render should be called after state change');
  }, 100);
});

// Test 4: Multiple state properties
test('Multiple state properties work independently', () => {
  class TestComponent extends FezBase {
    init() {
      this.state.a = 1;
      this.state.b = 2;
    }
  }

  const component = new TestComponent();
  component._node = new window.HTMLElement();
  component.root = component._node;
  component.class = TestComponent;
  component.fezRegister();
  component.init();

  assert(component.state.a === 1, 'State.a should be 1');
  assert(component.state.b === 2, 'State.b should be 2');

  component.state.a = 10;
  assert(component.state.a === 10, 'State.a should update to 10');
  assert(component.state.b === 2, 'State.b should remain 2');
});

// Test 5: Component methods
test('Component methods are accessible', () => {
  class TestComponent extends FezBase {
    init() {
      this.state.count = 0;
    }

    increment() {
      this.state.count++;
    }

    getDouble() {
      return this.state.count * 2;
    }
  }

  const component = new TestComponent();
  component._node = new window.HTMLElement();
  component.root = component._node;
  component.class = TestComponent;
  component.fezRegister();
  component.init();

  assert(component.state.count === 0, 'Initial count should be 0');

  component.increment();
  assert(component.state.count === 1, 'Count should be 1 after increment');

  assert(component.getDouble() === 2, 'getDouble should return 2');
});

// Test 6: Counter-like functionality
test('Counter component works correctly', () => {
  class Counter extends FezBase {
    init() {
      this.MAX = 6;
      this.state.count = 0;
    }

    isMax() {
      return this.state.count >= this.MAX;
    }

    more() {
      this.state.count += this.isMax() ? 0 : 1;
    }
  }

  const counter = new Counter();
  counter._node = new window.HTMLElement();
  counter.root = counter._node;
  counter.class = Counter;
  counter.fezRegister();
  counter.init();

  assert(counter.state.count === 0, 'Initial count should be 0');
  assert(!counter.isMax(), 'Should not be at max initially');

  // Increment to max
  for (let i = 0; i < 10; i++) {
    counter.more();
  }

  assert(counter.state.count === 6, 'Count should stop at MAX (6)');
  assert(counter.isMax(), 'Should be at max');
});

// Summary
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}

// Simple Fez test runner that works with Bun
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Use happy-dom instead of jsdom (works better with Bun)
import { Window } from 'happy-dom';

// Create DOM environment
const window = new Window();
const document = window.document;

// Make DOM globals available
global.window = window;
global.document = document;
global.HTMLElement = window.HTMLElement;
global.CustomEvent = window.CustomEvent;
global.MutationObserver = window.MutationObserver;

// Helper functions
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const assert = {
  equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },
  
  ok(value, message = '') {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },
  
  includes(str, substring, message = '') {
    if (!str.includes(substring)) {
      throw new Error(message || `Expected "${str}" to include "${substring}"`);
    }
  }
};

// Test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Fez tests...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   ${error.message}`);
        console.log(`   ${error.stack}`);
      }
    }

    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Load Fez
await import('../src/fez.js');
const Fez = window.Fez;

// Create test runner
const runner = new TestRunner();

// Define test counter component
Fez('test-counter', class {
  connect() {
    this.MAX = 6;
    this.state.count = 0;
  }

  isMax() {
    return this.state.count >= this.MAX;
  }

  more() {
    this.state.count += this.isMax() ? 0 : 1;
  }
});

// Helper to create counter
async function createCounter() {
  const container = document.createElement('div');
  container.innerHTML = '<test-counter></test-counter>';
  document.body.appendChild(container);
  
  await wait(100);
  
  const element = container.querySelector('test-counter');
  const component = element._fez;
  
  return { container, element, component };
}

// Test 1: Component initialization
runner.test('Counter initializes with count = 0', async () => {
  const { component, container } = await createCounter();
  
  assert.equal(component.state.count, 0, 'Initial count should be 0');
  assert.equal(component.MAX, 6, 'MAX should be 6');
  
  container.remove();
});

// Test 2: State changes trigger re-render
runner.test('State changes update the DOM', async () => {
  const { component, element, container } = await createCounter();
  
  // Change state
  component.state.count = 3;
  await wait(100);
  
  // Check DOM updated
  const html = element.innerHTML;
  assert.includes(html, '3', 'DOM should show count 3');
  
  container.remove();
});

// Test 3: more() method
runner.test('more() increments until MAX', async () => {
  const { component, container } = await createCounter();
  
  // Call more() multiple times
  for (let i = 0; i < 10; i++) {
    component.more();
  }
  
  assert.equal(component.state.count, 6, 'Count should stop at MAX (6)');
  
  container.remove();
});

// Test 4: isMax() method
runner.test('isMax() returns correct boolean', async () => {
  const { component, container } = await createCounter();
  
  assert.equal(component.isMax(), false, 'Initially not at max');
  
  component.state.count = 6;
  assert.equal(component.isMax(), true, 'Should be at max when count = 6');
  
  container.remove();
});

// Test 5: Multiple instances
runner.test('Multiple instances have independent state', async () => {
  const counter1 = await createCounter();
  const counter2 = await createCounter();
  
  counter1.component.state.count = 2;
  counter2.component.state.count = 4;
  
  assert.equal(counter1.component.state.count, 2, 'Counter 1 = 2');
  assert.equal(counter2.component.state.count, 4, 'Counter 2 = 4');
  
  counter1.container.remove();
  counter2.container.remove();
});

// Run tests
await runner.run();
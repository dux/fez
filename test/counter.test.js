import { FezTestRunner, assert, wait } from './test-runner.js';
import '../src/fez.js';

const runner = new FezTestRunner();

// Load Fez global
const Fez = global.window.Fez;

// Define a test counter component
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

// Helper to create and mount a counter component
async function createCounter() {
  const container = document.createElement('div');
  container.innerHTML = '<test-counter></test-counter>';
  document.body.appendChild(container);
  
  // Wait for component to initialize
  await wait(50);
  
  const element = container.querySelector('test-counter');
  const component = element._fez;
  
  return { container, element, component };
}

// Test: Component initialization
runner.test('Counter component initializes with count = 0', async () => {
  const { component, container } = await createCounter();
  
  assert.equal(component.state.count, 0, 'Initial count should be 0');
  assert.equal(component.MAX, 6, 'MAX should be 6');
  
  // Cleanup
  container.remove();
});

// Test: State reactivity - increment
runner.test('Counter increments when state changes', async () => {
  const { component, element, container } = await createCounter();
  
  // Increment counter
  component.state.count = 1;
  await wait(50); // Wait for DOM update
  
  // Check if DOM updated
  const content = element.innerHTML;
  assert.includes(content, '1', 'DOM should contain count value 1');
  
  // Increment again
  component.state.count = 2;
  await wait(50);
  
  const content2 = element.innerHTML;
  assert.includes(content2, '2', 'DOM should contain count value 2');
  
  // Cleanup
  container.remove();
});

// Test: more() method respects MAX
runner.test('more() method respects MAX limit', async () => {
  const { component, container } = await createCounter();
  
  // Set count near max
  component.state.count = 5;
  assert.equal(component.state.count, 5);
  
  // Call more() - should increment to 6
  component.more();
  assert.equal(component.state.count, 6, 'Should increment to MAX (6)');
  
  // Call more() again - should not increment beyond MAX
  component.more();
  assert.equal(component.state.count, 6, 'Should not increment beyond MAX');
  
  // Cleanup
  container.remove();
});

// Test: isMax() method
runner.test('isMax() returns correct values', async () => {
  const { component, container } = await createCounter();
  
  // Initially not at max
  assert.equal(component.isMax(), false, 'Should not be at max initially');
  
  // Set to max
  component.state.count = 6;
  assert.equal(component.isMax(), true, 'Should be at max when count = 6');
  
  // Above max
  component.state.count = 7;
  assert.equal(component.isMax(), true, 'Should be at max when count > 6');
  
  // Cleanup
  container.remove();
});

// Test: Multiple component instances
runner.test('Multiple counter instances have independent state', async () => {
  const counter1 = await createCounter();
  const counter2 = await createCounter();
  
  // Modify first counter
  counter1.component.state.count = 3;
  await wait(50);
  
  // Check states are independent
  assert.equal(counter1.component.state.count, 3, 'Counter 1 should be 3');
  assert.equal(counter2.component.state.count, 0, 'Counter 2 should still be 0');
  
  // Modify second counter
  counter2.component.state.count = 5;
  await wait(50);
  
  assert.equal(counter1.component.state.count, 3, 'Counter 1 should still be 3');
  assert.equal(counter2.component.state.count, 5, 'Counter 2 should be 5');
  
  // Cleanup
  counter1.container.remove();
  counter2.container.remove();
});

// Test: Component lifecycle - connect method
runner.test('connect() lifecycle method is called', async () => {
  let connectCalled = false;
  
  // Define a test component that tracks connect() calls
  Fez('test-lifecycle', class {
    connect() {
      connectCalled = true;
      this.state.initialized = true;
    }
  });
  
  const container = document.createElement('div');
  container.innerHTML = '<test-lifecycle></test-lifecycle>';
  document.body.appendChild(container);
  
  await wait(50);
  
  assert.ok(connectCalled, 'connect() should be called');
  
  const element = container.querySelector('test-lifecycle');
  assert.equal(element._fez.state.initialized, true, 'State should be initialized');
  
  // Cleanup
  container.remove();
});

// Run all tests
runner.run();
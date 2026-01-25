import { test, expect } from "bun:test";

// =============================================================================
// BASIC FUNCTIONALITY
// =============================================================================

test("Publish/Subscribe - Basic functionality", async () => {
  const Fez = globalThis.window.Fez;

  let receivedData = null;
  const callback = (data) => { receivedData = data; };

  // Subscribe to an event
  const unsubscribe = Fez.subscribe('test-event', callback);

  // Publish event
  Fez.publish('test-event', 'hello world');

  expect(receivedData).toBe('hello world');

  // Cleanup
  unsubscribe();
});

test("Publish/Subscribe - Multiple subscribers", async () => {
  const Fez = globalThis.window.Fez;

  let count = 0;
  const callback1 = () => { count += 1; };
  const callback2 = () => { count += 10; };

  // Subscribe multiple callbacks
  const unsub1 = Fez.subscribe('multi-event', callback1);
  const unsub2 = Fez.subscribe('multi-event', callback2);

  // Publish event
  Fez.publish('multi-event');

  expect(count).toBe(11);

  // Cleanup
  unsub1();
  unsub2();
});

test("Publish/Subscribe - Multiple arguments", async () => {
  const Fez = globalThis.window.Fez;

  let receivedArgs = [];
  const callback = (...args) => { receivedArgs = args; };

  // Subscribe
  const unsubscribe = Fez.subscribe('args-event', callback);

  // Publish with multiple arguments
  Fez.publish('args-event', 'arg1', 'arg2', { key: 'value' });

  expect(receivedArgs).toEqual(['arg1', 'arg2', { key: 'value' }]);

  // Cleanup
  unsubscribe();
});

test("Publish/Subscribe - Unsubscribe functionality", async () => {
  const Fez = globalThis.window.Fez;

  let callCount = 0;
  const callback = () => { callCount++; };

  // Subscribe
  const unsubscribe = Fez.subscribe('unsub-event', callback);

  // First publish
  Fez.publish('unsub-event');
  expect(callCount).toBe(1);

  // Unsubscribe
  unsubscribe();

  // Second publish (should not trigger callback)
  Fez.publish('unsub-event');
  expect(callCount).toBe(1);
});

test("Publish/Subscribe - Replace subscription with same callback", async () => {
  const Fez = globalThis.window.Fez;

  let callCount = 0;
  const callback = () => { callCount++; };

  // Subscribe twice with same callback
  Fez.subscribe('replace-event', callback);
  Fez.subscribe('replace-event', callback);

  // Publish event (should only trigger once)
  Fez.publish('replace-event');

  expect(callCount).toBe(1);
});

// =============================================================================
// NODE REFERENCE SUBSCRIPTIONS
// =============================================================================

test("Publish/Subscribe - Node reference subscription", async () => {
  const Fez = globalThis.window.Fez;

  let receivedData = null;
  const callback = (data) => { receivedData = data; };

  // Use a mock node
  const mockNode = { isConnected: true, id: 'testNode' };

  // Subscribe using node object
  const unsubscribe = Fez.subscribe(mockNode, 'node-event', callback);

  // Publish event
  Fez.publish('node-event', 'test data');

  expect(receivedData).toBe('test data');

  // Cleanup
  unsubscribe();
});

test("Publish/Subscribe - Disconnected node skipped", async () => {
  const Fez = globalThis.window.Fez;

  let callCount = 0;
  const callback = () => { callCount++; };

  // Create a disconnected node
  const disconnectedNode = { isConnected: false };

  // Subscribe with disconnected node
  Fez.subscribe(disconnectedNode, 'disconnected-event', callback);

  // Publish event (should not trigger callback)
  Fez.publish('disconnected-event');

  expect(callCount).toBe(0);
});

test("Publish/Subscribe - Context binding with node", async () => {
  const Fez = globalThis.window.Fez;

  let contextCheck = null;
  const node = { isConnected: true, id: 'contextNode' };
  const callback = function() { contextCheck = this; };

  // Subscribe with specific node
  const unsubscribe = Fez.subscribe(node, 'context-event', callback);

  // Publish event
  Fez.publish('context-event');

  // Callback should be called with node as context
  expect(contextCheck).toBe(node);

  // Cleanup
  unsubscribe();
});

// =============================================================================
// SELECTOR SUBSCRIPTIONS (resolved at publish time)
// =============================================================================

test("Publish/Subscribe - Selector subscription (found)", async () => {
  const Fez = globalThis.window.Fez;

  let callCount = 0;
  const callback = () => { callCount++; };

  // Mock document.querySelector to return a node
  const originalQuerySelector = document.querySelector;
  const mockNode = { isConnected: true, id: 'found-node' };
  document.querySelector = (selector) => {
    if (selector === '#test-selector') return mockNode;
    return originalQuerySelector.call(document, selector);
  };

  try {
    // Subscribe with selector
    const unsubscribe = Fez.subscribe('#test-selector', 'selector-event', callback);

    // Publish event
    Fez.publish('selector-event');

    expect(callCount).toBe(1);

    // Cleanup
    unsubscribe();
  } finally {
    document.querySelector = originalQuerySelector;
  }
});

test("Publish/Subscribe - Selector subscription (not found)", async () => {
  const Fez = globalThis.window.Fez;

  let callCount = 0;
  const callback = () => { callCount++; };

  // Mock document.querySelector to return null (not found)
  const originalQuerySelector = document.querySelector;
  document.querySelector = (selector) => {
    if (selector === '#missing-selector') return null;
    return originalQuerySelector.call(document, selector);
  };

  try {
    // Subscribe with selector that won't be found
    const unsubscribe = Fez.subscribe('#missing-selector', 'missing-event', callback);

    // Publish event (callback should NOT be called)
    Fez.publish('missing-event');

    expect(callCount).toBe(0);

    // Cleanup
    unsubscribe();
  } finally {
    document.querySelector = originalQuerySelector;
  }
});

test("Publish/Subscribe - Selector resolved at publish time", async () => {
  const Fez = globalThis.window.Fez;

  let callCount = 0;
  const callback = () => { callCount++; };

  // Track querySelector calls
  let queryCount = 0;
  const originalQuerySelector = document.querySelector;
  const mockNode = { isConnected: true };
  document.querySelector = (selector) => {
    if (selector === '#dynamic-selector') {
      queryCount++;
      return mockNode;
    }
    return originalQuerySelector.call(document, selector);
  };

  try {
    // Subscribe (should NOT call querySelector yet)
    const unsubscribe = Fez.subscribe('#dynamic-selector', 'dynamic-event', callback);
    expect(queryCount).toBe(0);

    // First publish (should call querySelector)
    Fez.publish('dynamic-event');
    expect(queryCount).toBe(1);

    // Second publish (should call querySelector again)
    Fez.publish('dynamic-event');
    expect(queryCount).toBe(2);

    // Cleanup
    unsubscribe();
  } finally {
    document.querySelector = originalQuerySelector;
  }
});

test("Publish/Subscribe - Selector context binding", async () => {
  const Fez = globalThis.window.Fez;

  let contextCheck = null;
  const callback = function() { contextCheck = this; };

  // Mock querySelector
  const originalQuerySelector = document.querySelector;
  const mockNode = { isConnected: true, id: 'selector-context-node' };
  document.querySelector = (selector) => {
    if (selector === '#context-selector') return mockNode;
    return originalQuerySelector.call(document, selector);
  };

  try {
    // Subscribe with selector
    const unsubscribe = Fez.subscribe('#context-selector', 'selector-context-event', callback);

    // Publish event
    Fez.publish('selector-context-event');

    // Callback should be called with found node as context
    expect(contextCheck).toBe(mockNode);

    // Cleanup
    unsubscribe();
  } finally {
    document.querySelector = originalQuerySelector;
  }
});

// =============================================================================
// GLOBAL SUBSCRIPTION (no node)
// =============================================================================

test("Publish/Subscribe - Global subscription (no node check)", async () => {
  const Fez = globalThis.window.Fez;

  let callCount = 0;
  const callback = () => { callCount++; };

  // Subscribe without node
  const unsubscribe = Fez.subscribe('global-event', callback);

  // Publish multiple times
  Fez.publish('global-event');
  Fez.publish('global-event');
  Fez.publish('global-event');

  expect(callCount).toBe(3);

  // Cleanup
  unsubscribe();
});

test("Publish/Subscribe - Global subscription context is null", async () => {
  const Fez = globalThis.window.Fez;

  let contextCheck = 'not-set';
  const callback = function() { contextCheck = this; };

  // Subscribe without node
  const unsubscribe = Fez.subscribe('global-context-event', callback);

  // Publish event
  Fez.publish('global-context-event');

  // Context should be null for global subscriptions
  expect(contextCheck).toBe(null);

  // Cleanup
  unsubscribe();
});

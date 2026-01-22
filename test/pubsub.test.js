import { test, expect } from "bun:test";

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

test("Publish/Subscribe - Node selector", async () => {
  const Fez = globalThis.window.Fez;

  let receivedData = null;
  const callback = (data) => { receivedData = data; };

  // Use a mock node directly (more reliable than querySelector which depends on DOM state)
  const mockNode = { isConnected: true, id: 'testNode' };

  // Subscribe using node object
  const unsubscribe = Fez.subscribe(mockNode, 'selector-event', callback);

  // Publish event
  Fez.publish('selector-event', 'test data');

  expect(receivedData).toBe('test data');

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

test("Publish/Subscribe - Replace subscription with same node and callback", async () => {
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

test("Publish/Subscribe - Disconnected nodes are auto-cleaned", async () => {
  const Fez = globalThis.window.Fez;
  
  let callCount = 0;
  const callback = () => { callCount++; };
  
  // Create a disconnected node
  const disconnectedNode = { isConnected: false };
  
  // Subscribe with disconnected node
  Fez.subscribe(disconnectedNode, 'cleanup-event', callback);
  
  // Publish event (should not trigger callback and should clean up)
  Fez.publish('cleanup-event');
  
  expect(callCount).toBe(0);
  
  // Check that subscription was removed
  const subs = Fez._globalSubs.get('cleanup-event');
  expect(subs ? subs.size : 0).toBe(0);
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

test("Publish/Subscribe - Context binding", async () => {
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
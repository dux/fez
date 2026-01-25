import { test, expect, beforeEach } from "bun:test";

const Fez = globalThis.window.Fez;

beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();
});

// =============================================================================
// BASIC TYPES
// =============================================================================

test("localStorage - stores and retrieves integers", () => {
  Fez.localStorage.set('int', 42);
  const result = Fez.localStorage.get('int');

  expect(result).toBe(42);
  expect(typeof result).toBe('number');
});

test("localStorage - stores and retrieves floats", () => {
  Fez.localStorage.set('float', 3.14159);
  const result = Fez.localStorage.get('float');

  expect(result).toBe(3.14159);
  expect(typeof result).toBe('number');
});

test("localStorage - stores and retrieves strings", () => {
  Fez.localStorage.set('str', 'hello world');
  const result = Fez.localStorage.get('str');

  expect(result).toBe('hello world');
  expect(typeof result).toBe('string');
});

test("localStorage - stores and retrieves booleans", () => {
  Fez.localStorage.set('bool_true', true);
  Fez.localStorage.set('bool_false', false);

  expect(Fez.localStorage.get('bool_true')).toBe(true);
  expect(Fez.localStorage.get('bool_false')).toBe(false);
  expect(typeof Fez.localStorage.get('bool_true')).toBe('boolean');
});

test("localStorage - stores and retrieves null", () => {
  Fez.localStorage.set('null_val', null);
  const result = Fez.localStorage.get('null_val');

  expect(result).toBe(null);
});

// =============================================================================
// OBJECTS AND ARRAYS
// =============================================================================

test("localStorage - stores and retrieves objects", () => {
  const obj = { name: 'John', age: 30, active: true };
  Fez.localStorage.set('user', obj);
  const result = Fez.localStorage.get('user');

  expect(result).toEqual(obj);
  expect(result.name).toBe('John');
  expect(result.age).toBe(30);
  expect(result.active).toBe(true);
});

test("localStorage - stores and retrieves nested objects", () => {
  const obj = {
    user: { name: 'John', profile: { bio: 'Developer' } },
    settings: { theme: 'dark', notifications: true }
  };
  Fez.localStorage.set('data', obj);
  const result = Fez.localStorage.get('data');

  expect(result).toEqual(obj);
  expect(result.user.profile.bio).toBe('Developer');
});

test("localStorage - stores and retrieves arrays", () => {
  const arr = [1, 2, 3, 'four', { five: 5 }];
  Fez.localStorage.set('arr', arr);
  const result = Fez.localStorage.get('arr');

  expect(result).toEqual(arr);
  expect(result[3]).toBe('four');
  expect(result[4].five).toBe(5);
});

// =============================================================================
// DEFAULT VALUES
// =============================================================================

test("localStorage - returns default value for missing key", () => {
  const result = Fez.localStorage.get('missing', 'default');
  expect(result).toBe('default');
});

test("localStorage - returns null for missing key without default", () => {
  const result = Fez.localStorage.get('missing');
  expect(result).toBe(null);
});

test("localStorage - default value can be any type", () => {
  expect(Fez.localStorage.get('missing', 42)).toBe(42);
  expect(Fez.localStorage.get('missing', { a: 1 })).toEqual({ a: 1 });
  expect(Fez.localStorage.get('missing', [1, 2])).toEqual([1, 2]);
});

// =============================================================================
// REMOVE AND CLEAR
// =============================================================================

test("localStorage - remove deletes a key", () => {
  Fez.localStorage.set('toremove', 'value');
  expect(Fez.localStorage.get('toremove')).toBe('value');

  Fez.localStorage.remove('toremove');
  expect(Fez.localStorage.get('toremove')).toBe(null);
});

test("localStorage - clear removes all keys", () => {
  Fez.localStorage.set('key1', 'value1');
  Fez.localStorage.set('key2', 'value2');

  Fez.localStorage.clear();

  expect(Fez.localStorage.get('key1')).toBe(null);
  expect(Fez.localStorage.get('key2')).toBe(null);
});

// =============================================================================
// EDGE CASES
// =============================================================================

test("localStorage - handles empty string", () => {
  Fez.localStorage.set('empty', '');
  expect(Fez.localStorage.get('empty')).toBe('');
});

test("localStorage - handles zero", () => {
  Fez.localStorage.set('zero', 0);
  const result = Fez.localStorage.get('zero');

  expect(result).toBe(0);
  expect(typeof result).toBe('number');
});

test("localStorage - handles empty array", () => {
  Fez.localStorage.set('empty_arr', []);
  expect(Fez.localStorage.get('empty_arr')).toEqual([]);
});

test("localStorage - handles empty object", () => {
  Fez.localStorage.set('empty_obj', {});
  expect(Fez.localStorage.get('empty_obj')).toEqual({});
});

test("localStorage - overwrites existing value", () => {
  Fez.localStorage.set('key', 'first');
  Fez.localStorage.set('key', 'second');

  expect(Fez.localStorage.get('key')).toBe('second');
});

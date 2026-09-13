/**
 * localStorage wrapper with automatic JSON serialization
 * Preserves types: integers, floats, strings, objects, arrays, booleans, null
 *
 * @example
 * localStorage.set('count', 42)
 * localStorage.get('count') // 42 (number, not string)
 *
 * localStorage.set('user', { name: 'John', age: 30 })
 * localStorage.get('user') // { name: 'John', age: 30 }
 *
 * localStorage.get('missing', 'default') // 'default'
 */

const storage = () => globalThis.localStorage;

function set(key, value) {
  try {
    // JSON.stringify(undefined) is the string "undefined", which fails to parse
    // on read - treat it as a removal.
    if (value === undefined) {
      storage().removeItem(key);
      return;
    }
    storage().setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Fez localStorage: Failed to set "${key}"`, e);
  }
}

function get(key, defaultValue = null) {
  try {
    const item = storage().getItem(key);
    if (item === null) {
      return defaultValue;
    }
    return JSON.parse(item);
  } catch (e) {
    console.error(`Fez localStorage: Failed to get "${key}"`, e);
    return defaultValue;
  }
}

function remove(key) {
  try {
    storage().removeItem(key);
  } catch (e) {
    console.error(`Fez localStorage: Failed to remove "${key}"`, e);
  }
}

function clear() {
  try {
    storage().clear();
  } catch (e) {
    console.error('Fez localStorage: Failed to clear', e);
  }
}

export default { set, get, remove, clear };

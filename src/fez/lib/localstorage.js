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

const storage = () => globalThis.localStorage || window.localStorage

function set(key, value) {
  try {
    storage().setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Fez localStorage: Failed to set "${key}"`, e)
  }
}

function get(key, defaultValue = null) {
  try {
    const item = storage().getItem(key)
    if (item === null) return defaultValue
    return JSON.parse(item)
  } catch (e) {
    console.error(`Fez localStorage: Failed to get "${key}"`, e)
    return defaultValue
  }
}

function remove(key) {
  storage().removeItem(key)
}

function clear() {
  storage().clear()
}

export default { set, get, remove, clear }

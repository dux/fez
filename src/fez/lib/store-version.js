// Identity of values read out of a reactive store (instance.js fezReactiveStore).
//
// The store hands out one wrapper per object, so a value read twice is the same
// value and a parent that renders the same object hands a child the same prop.
// An in place write (state.list[0].done = true) keeps that identity, so every
// write also bumps a version on the written object and on every object it was
// read through. Code that compares by identity (render slots, prop refresh)
// compares the version too.

// store proxy -> its target, so a value read out of a store and written back
// (state.list = [...state.list, x]) lands raw instead of stacking wrappers
export const storeTargets = new WeakMap();
export const unwrapStore = (value) => storeTargets.get(value) || value;

// raw object -> write count
const versions = new WeakMap();

// `node` is { target, parent }: the written object and the chain it was read
// through. A store that holds itself (a.self = a) links a cycle, hence `seen`.
export function bumpStoreVersions(node) {
  const seen = new Set();
  for (; node && !seen.has(node); node = node.parent) {
    seen.add(node);
    versions.set(node.target, (versions.get(node.target) || 0) + 1);
  }
}

export function storeVersion(value) {
  if (typeof value !== 'object' || value === null) {
    return 0;
  }
  return versions.get(unwrapStore(value)) || 0;
}

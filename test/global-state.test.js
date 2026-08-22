import { describe, test, expect, beforeEach } from "bun:test";
import GlobalState from "../src/fez/lib/global-state.js";

// Minimal stand-in for a FezBase instance: what createProxy() touches
function fakeComponent(name) {
  const comp = {
    name,
    connected: true,
    destroyCallbacks: [],
    hookCalls: [],
    scheduled: [],
    renders: 0,
    _isRendering: false,
    _isInitializing: false,
    get isConnected() {
      return this.connected;
    },
    addOnDestroy(fn) {
      this.destroyCallbacks.push(fn);
    },
    onGlobalStateChange(key, value, oldValue) {
      this.hookCalls.push([key, value, oldValue]);
    },
    fezNextTick(fn, tag) {
      this.scheduled.push(tag);
    },
    fezRender() {
      this.renders++;
    },
    destroy() {
      this.destroyCallbacks.forEach((fn) => fn());
    },
  };
  comp.globalState = GlobalState.createProxy(comp);
  return comp;
}

let keyCounter = 0;
const uniq = (base) => `${base}_${++keyCounter}`;

beforeEach(() => {
  globalThis.Fez ||= {};
  globalThis.Fez.consoleLog ||= () => {};
});

describe("GlobalState", () => {
  test("set/get and no notify on identical value", () => {
    const key = uniq("k");
    const seen = [];
    const unsub = GlobalState.subscribe(key, (v, old) => seen.push([v, old]));
    GlobalState.set(key, 1);
    GlobalState.set(key, 1);
    GlobalState.set(key, 2);
    expect(GlobalState.get(key)).toBe(2);
    expect(seen).toEqual([[1, undefined], [2, 1]]);
    unsub();
    GlobalState.set(key, 3);
    expect(seen.length).toBe(2);
    expect(GlobalState.subs.has(key)).toBe(false); // empty set removed
  });

  test("subscribe(fn) hears every key", () => {
    const k1 = uniq("a"), k2 = uniq("b");
    const seen = [];
    const unsub = GlobalState.subscribe((key, v) => seen.push([key, v]));
    GlobalState.set(k1, "x");
    GlobalState.set(k2, "y");
    unsub();
    GlobalState.set(k1, "z");
    expect(seen).toEqual([[k1, "x"], [k2, "y"]]);
  });

  test("component reading a key subscribes once and is rendered via fezNextTick", () => {
    const key = uniq("count");
    const comp = fakeComponent("reader");

    expect(comp.globalState[key]).toBeUndefined();
    comp.globalState[key]; // second read must not double-subscribe
    expect(GlobalState.subs.get(key).size).toBe(1);

    GlobalState.set(key, 5);
    expect(comp.hookCalls).toEqual([[key, 5, undefined]]);
    expect(comp.scheduled).toEqual(["fezRender"]);
    expect(comp.renders).toBe(0); // not synchronous
  });

  test("several writes in one tick schedule one render per write but same debounce tag", () => {
    const k1 = uniq("x"), k2 = uniq("y");
    const comp = fakeComponent("multi");
    comp.globalState[k1];
    comp.globalState[k2];

    GlobalState.set(k1, 1);
    GlobalState.set(k2, 2);
    // fezNextTick dedupes by tag, so both land in a single frame render
    expect(comp.scheduled).toEqual(["fezRender", "fezRender"]);
    expect(new Set(comp.scheduled).size).toBe(1);
  });

  test("self-write during init or render skips the scheduled render, hook still fires", () => {
    const key = uniq("self");
    const comp = fakeComponent("self");
    comp.globalState[key];

    comp._isInitializing = true;
    comp.globalState[key] = "init";
    comp._isInitializing = false;

    comp._isRendering = true;
    comp.globalState[key] = "render";
    comp._isRendering = false;

    expect(comp.hookCalls.map((c) => c[1])).toEqual(["init", "render"]);
    expect(comp.scheduled).toEqual([]);

    comp.globalState[key] = "later";
    expect(comp.scheduled).toEqual(["fezRender"]);
  });

  test("write from another component while rendering still schedules", () => {
    const key = uniq("other");
    const reader = fakeComponent("reader");
    const writer = fakeComponent("writer");
    reader.globalState[key];

    reader._isRendering = true;
    writer.globalState[key] = 1;
    reader._isRendering = false;

    expect(reader.scheduled).toEqual(["fezRender"]);
  });

  test("forEach visits connected listening components and prunes dead ones", () => {
    const key = uniq("fe");
    const a = fakeComponent("a");
    const b = fakeComponent("b");
    a.globalState[key];
    b.globalState[key];
    GlobalState.subscribe(key, () => {}); // plain sub must be skipped

    const visited = [];
    GlobalState.forEach(key, (c) => visited.push(c.name));
    expect(visited.sort()).toEqual(["a", "b"]);

    b.connected = false;
    visited.length = 0;
    GlobalState.forEach(key, (c) => visited.push(c.name));
    expect(visited).toEqual(["a"]);
    expect([...GlobalState.subs.get(key)].filter((s) => s.fez).length).toBe(1);
  });

  test("notify prunes disconnected components without calling them", () => {
    const key = uniq("prune");
    const comp = fakeComponent("gone");
    comp.globalState[key];
    comp.connected = false;
    GlobalState.set(key, 1);
    expect(comp.hookCalls).toEqual([]);
    expect(GlobalState.subs.get(key)?.size || 0).toBe(0);
  });

  test("destroy unsubscribes every key the component read", () => {
    const k1 = uniq("d1"), k2 = uniq("d2");
    const comp = fakeComponent("d");
    comp.globalState[k1];
    comp.globalState[k2];
    comp.destroy();
    expect(GlobalState.subs.has(k1)).toBe(false);
    expect(GlobalState.subs.has(k2)).toBe(false);
    GlobalState.set(k1, 1);
    expect(comp.hookCalls).toEqual([]);
  });

  test("a throwing subscriber does not block the others", () => {
    const key = uniq("throw");
    const seen = [];
    const origError = console.error;
    console.error = () => {};
    try {
      GlobalState.subscribe(key, () => {
        throw new Error("boom");
      });
      GlobalState.subscribe(key, (v) => seen.push(v));
      GlobalState.set(key, 1);
    } finally {
      console.error = origError;
    }
    expect(seen).toEqual([1]);
  });

  test("'in' works on the proxy and symbols are ignored", () => {
    const key = uniq("in");
    const comp = fakeComponent("in");
    expect(key in comp.globalState).toBe(false);
    comp.globalState[key] = 0;
    expect(key in comp.globalState).toBe(true);
    expect(comp.globalState[Symbol.iterator]).toBeUndefined();
  });
});

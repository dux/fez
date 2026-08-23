import { describe, test, expect } from "bun:test";
import FezBase from "../src/fez/instance.js";

// fezReactiveStore backs this.state and this.props. Only plain objects and
// arrays are proxied - anything with internal slots (Date, Map, Set, RegExp,
// class instances) must come back untouched or its methods throw when they
// run with a Proxy as `this`.

const store = (obj, onWrite, options) => {
  const fez = new FezBase();
  const writes = [];
  const s = fez.fezReactiveStore(obj, (_t, key, value) => {
    writes.push([key, value]);
    onWrite?.(key, value);
  }, options);
  return [s, writes];
};

describe("fezReactiveStore", () => {
  test("plain objects and arrays stay reactive", () => {
    const [s, writes] = store({});
    s.name = "a";
    s.list = [1];
    s.list.push(2);
    s.nested = { deep: {} };
    s.nested.deep.x = 1;

    expect(s.name).toBe("a");
    expect(s.list).toEqual([1, 2]);
    expect(s.nested.deep.x).toBe(1);
    expect(writes.map(([k]) => k)).toContain("name");
    expect(writes.map(([k]) => k)).toContain("x");
  });

  test("Date is handed back unwrapped - its methods still work", () => {
    const [s] = store({ since: new Date("2024-05-01T00:00:00Z") });
    expect(s.since instanceof Date).toBe(true);
    expect(s.since.getUTCFullYear()).toBe(2024);
  });

  test("Map, Set and RegExp keep their internal slots", () => {
    const [s] = store({ map: new Map([["a", 1]]), set: new Set([1]), re: /x/ });
    expect(s.map.get("a")).toBe(1);
    expect(s.set.has(1)).toBe(true);
    expect(s.re.test("x")).toBe(true);
  });

  test("class instances are not proxied", () => {
    class Counter {
      value = 1;
      double() {
        return this.value * 2;
      }
    }
    const [s] = store({ counter: new Counter() });
    expect(s.counter.double()).toBe(2);
    expect(s.counter instanceof Counter).toBe(true);
  });

  test("promises pass through", async () => {
    const [s] = store({ p: Promise.resolve(7) });
    expect(await s.p).toBe(7);
  });
});

// { shallow: true } backs this.props: only the object itself is wrapped, so
// nested values keep plain identity - including across component boundaries.
describe("fezReactiveStore { shallow: true }", () => {
  test("nested values come back raw, identity intact", () => {
    const raw = { item: { id: 1 }, items: [{ id: 1 }, { id: 2 }] };
    const [s] = store(raw, null, { shallow: true });

    expect(s.item).toBe(raw.item);
    expect(s.items).toBe(raw.items);
    expect(s.items[0]).toBe(s.items[0]);
    expect(s.items.includes(s.items[0])).toBe(true);

    s.selected = s.items[0];
    expect(s.selected).toBe(s.items[0]);
    expect(raw.selected).toBe(raw.items[0]);
  });

  test("top level writes still notify", () => {
    const [s, writes] = store({ a: 1 }, null, { shallow: true });
    s.a = 2;
    s.b = [1];
    expect(writes).toEqual([["a", 2], ["b", [1]]]);
  });

  test("nested writes do not notify - assign the container instead", () => {
    const [s, writes] = store({ user: { name: "Ann" } }, null, { shallow: true });
    s.user.name = "Bob";
    expect(writes).toEqual([]);
    s.user = { ...s.user, name: "Cid" };
    expect(writes.length).toBe(1);
  });

  test("deep store (this.state) still wraps nested values", () => {
    const [s, writes] = store({ user: { name: "Ann" } });
    s.user.name = "Bob";
    expect(writes).toEqual([["name", "Bob"]]);
  });
});

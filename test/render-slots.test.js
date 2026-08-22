import { describe, test, expect } from "bun:test";
import RenderSlots from "../src/fez/lib/render-slots.js";

describe("RenderSlots", () => {
  describe("values (:attr props)", () => {
    test("keys are positional and reset every render", () => {
      const slots = new RenderSlots();
      const a = {}, b = {};

      slots.beginRender();
      expect(slots.set(a)).toBe(0);
      expect(slots.set(b)).toBe(1);
      slots.commitRender();

      slots.beginRender();
      expect(slots.set(a)).toBe(0);
      slots.commitRender();
    });

    test("value() reads without consuming, survives until next beginRender", () => {
      const slots = new RenderSlots();
      const obj = { id: 1 };

      slots.beginRender();
      const key = slots.set(obj);
      slots.commitRender();

      // still there after commit: children deferred to rAF at page load read late
      expect(slots.value(key)).toBe(obj);
      expect(slots.value(key)).toBe(obj);

      slots.beginRender();
      expect(slots.value(key)).toBeUndefined();
    });

    test("valuesChanged compares by identity per position", () => {
      const slots = new RenderSlots();
      const a = { n: 1 }, b = { n: 2 };

      slots.beginRender();
      slots.set(a);
      slots.set(b);
      slots.commitRender();
      expect(slots.valuesChanged).toBe(true); // first render, nothing to compare to

      slots.beginRender();
      slots.set(a);
      slots.set(b);
      slots.commitRender();
      expect(slots.valuesChanged).toBe(false);

      slots.beginRender();
      slots.set(a);
      slots.set({ n: 2 }); // equal shape, new object
      slots.commitRender();
      expect(slots.valuesChanged).toBe(true);

      slots.beginRender();
      slots.set(a);
      slots.commitRender();
      expect(slots.valuesChanged).toBe(true); // count shrank
    });

    test("primitives compare by value", () => {
      const slots = new RenderSlots();
      slots.beginRender();
      slots.set("x");
      slots.set(3);
      slots.commitRender();
      slots.beginRender();
      slots.set("x");
      slots.set(3);
      slots.commitRender();
      expect(slots.valuesChanged).toBe(false);
    });
  });

  describe("handlers (loop closures)", () => {
    test("keys are positional, stale keys dropped on commit, live ones kept", () => {
      const slots = new RenderSlots();
      const f0 = () => 0, f1 = () => 1, f0b = () => 10;

      slots.beginRender();
      expect(slots.setHandler(f0)).toBe(0);
      expect(slots.setHandler(f1)).toBe(1);
      slots.commitRender();
      expect(slots.handler(0)).toBe(f0);
      expect(slots.handler(1)).toBe(f1);

      slots.beginRender();
      slots.setHandler(f0b);
      slots.commitRender();
      expect(slots.handler(0)).toBe(f0b);
      expect(slots.handler(1)).toBeUndefined();
    });

    test("commitRender without beginRender is a no-op", () => {
      const slots = new RenderSlots();
      slots.beginRender();
      slots.setHandler(() => {});
      slots.commitRender();
      slots.commitRender();
      expect(slots.handler(0)).toBeDefined();
    });
  });

  test("clear() drops everything", () => {
    const slots = new RenderSlots();
    slots.beginRender();
    slots.set({});
    slots.setHandler(() => {});
    slots.commitRender();
    slots.clear();
    expect(slots.value(0)).toBeUndefined();
    expect(slots.handler(0)).toBeUndefined();
    expect(slots.renderValues).toEqual([]);
    expect(slots.prevValues).toEqual([]);
  });
});

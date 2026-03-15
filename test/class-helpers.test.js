import { describe, test, expect } from "bun:test";

// Create a mock element with classList
function mockElement() {
  const classes = new Set();
  return {
    classList: {
      add(...names) {
        names.forEach((n) => classes.add(n));
      },
      toggle(name, force) {
        if (force === undefined) {
          classes.has(name) ? classes.delete(name) : classes.add(name);
        } else if (force) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
      contains(name) {
        return classes.has(name);
      },
      _set: classes,
    },
  };
}

// Import FezBase to test instance methods
const { default: FezBase } = await import("../src/fez/instance.js");

describe("addClass", () => {
  test("adds a single class to root", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    instance.addClass("foo");
    expect(instance.root.classList.contains("foo")).toBe(true);
  });

  test("adds multiple space-separated classes", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    instance.addClass("foo bar baz");
    expect(instance.root.classList.contains("foo")).toBe(true);
    expect(instance.root.classList.contains("bar")).toBe(true);
    expect(instance.root.classList.contains("baz")).toBe(true);
  });

  test("handles extra whitespace", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    instance.addClass("  foo   bar  ");
    expect(instance.root.classList.contains("foo")).toBe(true);
    expect(instance.root.classList.contains("bar")).toBe(true);
    expect(instance.root.classList._set.size).toBe(2);
  });

  test("adds class to a specific node", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    const other = mockElement();
    instance.addClass("foo", other);
    expect(instance.root.classList.contains("foo")).toBe(false);
    expect(other.classList.contains("foo")).toBe(true);
  });
});

describe("toggleClass", () => {
  test("toggles class on root", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    instance.toggleClass("active");
    expect(instance.root.classList.contains("active")).toBe(true);
    instance.toggleClass("active");
    expect(instance.root.classList.contains("active")).toBe(false);
  });

  test("force adds with true", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    instance.toggleClass("active", true);
    expect(instance.root.classList.contains("active")).toBe(true);
    instance.toggleClass("active", true);
    expect(instance.root.classList.contains("active")).toBe(true);
  });

  test("force removes with false", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    instance.root.classList.add("active");
    instance.toggleClass("active", false);
    expect(instance.root.classList.contains("active")).toBe(false);
  });

  test("toggles class on a specific node", () => {
    const instance = Object.create(FezBase.prototype);
    instance.root = mockElement();
    const other = mockElement();
    instance.toggleClass("active", undefined, other);
    expect(instance.root.classList.contains("active")).toBe(false);
    expect(other.classList.contains("active")).toBe(true);
  });
});

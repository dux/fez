import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import FezBase from "../src/fez/instance.js";

// PROPS schema: validation + coercion into this.props (castProps / castProp / getProps)

let errors = [];
const originalFez = globalThis.Fez;

beforeEach(() => {
  errors = [];
  globalThis.Fez = {
    ...(globalThis.Fez || {}),
    onError: (kind, message) => {
      errors.push({ kind, message });
    },
    isTrue: (val) => ["1", "true", "on"].includes(String(val).toLowerCase()),
  };
});

afterEach(() => {
  globalThis.Fez = originalFez;
});

const klass = (PROPS) => {
  const K = class extends FezBase {};
  if (PROPS !== undefined) K.PROPS = PROPS;
  return K;
};

describe("FezBase.propsSchema", () => {
  test("returns null when PROPS is not declared", () => {
    expect(klass().propsSchema()).toBe(null);
  });

  test("normalizes shorthand to { type }", () => {
    const K = klass({ name: String, count: { type: Number, default: 1 } });
    expect(K.propsSchema().name).toEqual({ type: String });
    expect(K.propsSchema().count).toEqual({ type: Number, default: 1 });
  });

  test("memoizes per class, not inherited by subclasses", () => {
    const Parent = klass({ a: String });
    const Child = class extends Parent {};
    Child.PROPS = { b: Number };
    expect(Object.keys(Parent.propsSchema())).toEqual(["a"]);
    expect(Object.keys(Child.propsSchema())).toEqual(["b"]);
  });
});

describe("FezBase.castProps - without schema", () => {
  test("returns the input object untouched", () => {
    const K = klass();
    const props = { a: "1", b: "x" };
    expect(K.castProps(props, "x-foo")).toBe(props);
  });
});

describe("FezBase.castProps - types", () => {
  test("String", () => {
    const K = klass({ name: String });
    expect(K.castProps({ name: 123 }).name).toBe("123");
    expect(K.castProps({ name: "x" }).name).toBe("x");
  });

  test("Number", () => {
    const K = klass({ count: Number });
    expect(K.castProps({ count: "3" }).count).toBe(3);
    expect(K.castProps({ count: " 2.5 " }).count).toBe(2.5);
    expect(K.castProps({ count: 7 }).count).toBe(7);
  });

  test("Number - NaN reports error, value dropped, default applies", () => {
    const K = klass({ count: { type: Number, default: 9 } });
    const out = K.castProps({ count: "abc" }, "x-foo");
    expect(out.count).toBe(9);
    expect(errors.length).toBe(1);
    expect(errors[0].kind).toBe("props");
    expect(errors[0].message).toContain("<x-foo>");
    expect(errors[0].message).toContain('"count"');
    expect(errors[0].message).toContain("Number");
  });

  test("Boolean - attribute present / html-style / negatives / absent", () => {
    const K = klass({ open: Boolean, disabled: Boolean });
    expect(K.castProps({ open: "" }).open).toBe(true);
    expect(K.castProps({ open: "open" }).open).toBe(true);
    expect(K.castProps({ open: "true" }).open).toBe(true);
    expect(K.castProps({ open: "1" }).open).toBe(true);
    expect(K.castProps({ open: "false" }).open).toBe(false);
    expect(K.castProps({ open: "0" }).open).toBe(false);
    expect(K.castProps({ open: "off" }).open).toBe(false);
    expect(K.castProps({ open: "no" }).open).toBe(false);
    expect(K.castProps({ open: true }).open).toBe(true);
    expect(K.castProps({ open: false }).open).toBe(false);
    // declared but absent -> false, lands in props
    const out = K.castProps({});
    expect(out.open).toBe(false);
    expect(out.disabled).toBe(false);
  });

  test("Boolean - default wins over implicit false", () => {
    const K = klass({ open: { type: Boolean, default: true } });
    expect(K.castProps({}).open).toBe(true);
    expect(K.castProps({ open: "false" }).open).toBe(false);
  });

  test("Array - JSON string, already-array, wrong shape", () => {
    const K = klass({ items: Array });
    expect(K.castProps({ items: "[1,2]" }).items).toEqual([1, 2]);
    const arr = [1];
    expect(K.castProps({ items: arr }).items).toBe(arr);
    expect(K.castProps({ items: "{}" }, "x-foo").items).toBeUndefined();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("expected Array");
  });

  test("Object - JSON string, already-object, invalid JSON", () => {
    const K = klass({ user: Object });
    expect(K.castProps({ user: '{"a":1}' }).user).toEqual({ a: 1 });
    const obj = { b: 2 };
    expect(K.castProps({ user: obj }).user).toBe(obj);
    expect(K.castProps({ user: "{oops" }, "x-foo").user).toBeUndefined();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("invalid JSON");
  });

  test("Function - passes functions, rejects strings", () => {
    const K = klass({ on_pick: Function });
    const fn = () => {};
    expect(K.castProps({ on_pick: fn }).on_pick).toBe(fn);
    expect(K.castProps({ on_pick: "doIt()" }, "x-foo").on_pick).toBeUndefined();
    expect(errors[0].message).toContain(':on_pick="..."');
  });

  test("Date - iso string, epoch, Date instance, invalid", () => {
    const K = klass({ since: Date });
    expect(K.castProps({ since: "2024-01-02" }).since.getUTCFullYear()).toBe(2024);
    expect(K.castProps({ since: "0" }).since.getTime()).toBe(0);
    const d = new Date(1000);
    expect(K.castProps({ since: d }).since).toBe(d);
    expect(K.castProps({ since: "not a date" }, "x-foo").since).toBeUndefined();
    expect(errors[0].message).toContain("expected Date");
  });

  test("custom caster function", () => {
    const K = klass({ tags: (raw) => String(raw).split(",").map((s) => s.trim()) });
    expect(K.castProps({ tags: "a, b" }).tags).toEqual(["a", "b"]);
  });

  test("custom caster throwing reports error", () => {
    const K = klass({
      x: (raw) => {
        throw new Error("nope");
      },
    });
    expect(K.castProps({ x: "1" }, "x-foo").x).toBeUndefined();
    expect(errors[0].message).toContain("nope");
  });
});

describe("FezBase.castProps - default / required / enum", () => {
  test("default value and default function", () => {
    const K = klass({
      size: { type: String, default: "md" },
      items: { type: Array, default: () => [] },
    });
    const a = K.castProps({});
    const b = K.castProps({});
    expect(a.size).toBe("md");
    expect(a.items).toEqual([]);
    expect(a.items).not.toBe(b.items);
  });

  test("default is not applied when value given", () => {
    const K = klass({ size: { type: String, default: "md" } });
    expect(K.castProps({ size: "lg" }).size).toBe("lg");
  });

  test("required missing reports error, key absent from props", () => {
    const K = klass({ user: { type: Object, required: true } });
    const out = K.castProps({}, "x-foo");
    expect("user" in out).toBe(false);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("is required");
  });

  test("required present does not report", () => {
    const K = klass({ name: { type: String, required: true } });
    K.castProps({ name: "a" });
    expect(errors.length).toBe(0);
  });

  test("enum violation reports error and falls back to default", () => {
    const K = klass({ size: { type: String, enum: ["sm", "md"], default: "sm" } });
    expect(K.castProps({ size: "md" }).size).toBe("md");
    expect(K.castProps({ size: "xl" }, "x-foo").size).toBe("sm");
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("one of");
  });

  test("enum checked after coercion", () => {
    const K = klass({ level: { type: Number, enum: [1, 2, 3] } });
    expect(K.castProps({ level: "2" }).level).toBe(2);
    expect(errors.length).toBe(0);
  });
});

describe("FezBase.castProps - passthrough and idempotency", () => {
  test("unknown keys pass through untouched, schema keys first", () => {
    const K = klass({ count: Number });
    const out = K.castProps({ id: "x", count: "2", other: "y" });
    expect(out).toEqual({ count: 2, id: "x", other: "y" });
  });

  test("already typed input is unchanged on second pass", () => {
    const K = klass({
      count: Number,
      open: Boolean,
      items: Array,
      since: Date,
    });
    const first = K.castProps({ count: "1", open: "", items: "[1]", since: "2020-01-01" });
    const second = K.castProps(first);
    expect(second).toEqual(first);
    expect(second.items).toBe(first.items);
    expect(second.since).toBe(first.since);
  });

  test("null/undefined values are treated as missing", () => {
    const K = klass({ count: { type: Number, default: 5 }, name: String });
    const out = K.castProps({ count: null, name: undefined });
    expect(out.count).toBe(5);
    expect("name" in out).toBe(false);
  });

  test("returns a new object", () => {
    const K = klass({ a: String });
    const input = { a: "1" };
    expect(K.castProps(input)).not.toBe(input);
  });
});

describe("FezBase.castProp - single key (attribute observer path)", () => {
  test("casts declared key", () => {
    const K = klass({ count: Number });
    expect(K.castProp("count", "4", "x-foo")).toBe(4);
  });

  test("returns raw value for undeclared key", () => {
    const K = klass({ count: Number });
    expect(K.castProp("title", "hi")).toBe("hi");
  });

  test("returns raw value when no schema", () => {
    expect(klass().castProp("count", "4")).toBe("4");
  });

  test("removed attribute (null) on Boolean -> false, on default -> default", () => {
    const K = klass({ open: Boolean, size: { type: String, default: "md" } });
    expect(K.castProp("open", null)).toBe(false);
    expect(K.castProp("size", null)).toBe("md");
  });
});

describe("FezBase.getProps - cast applied on every path", () => {
  const node = (attrs, extra = {}) => ({
    tagName: "X-FOO",
    attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    ...extra,
  });

  test("plain attributes", () => {
    const K = klass({ count: Number, open: Boolean });
    const out = K.getProps(node({ count: "2", open: "", title: "t" }), {});
    expect(out).toEqual({ count: 2, open: true, title: "t" });
  });

  test(":attr evaluated expressions", () => {
    const K = klass({ count: Number });
    const out = K.getProps(node({ ":count": "1 + 1" }), {});
    expect(out.count).toBe(2);
  });

  test("data-props JSON", () => {
    const K = klass({ count: Number, open: Boolean });
    const out = K.getProps(node({ "data-props": '{"count":"5","name":"n"}' }), {});
    expect(out).toEqual({ count: 5, open: false, name: "n" });
  });

  test("data-props already an object", () => {
    const K = klass({ count: Number });
    const out = K.getProps(node({ "data-props": { count: "6" } }), {});
    expect(out.count).toBe(6);
  });

  test("node.props direct attachment (fez-component passthrough)", () => {
    const K = klass({ count: Number });
    const out = K.getProps(node({}, { props: { count: "7" } }), {});
    expect(out.count).toBe(7);
  });

  test("without schema returns raw attrs as before", () => {
    const K = klass();
    const out = K.getProps(node({ count: "2" }), {});
    expect(out).toEqual({ count: "2" });
  });
});

// `default` declaring a parameter doubles as a transform: it receives the raw
// attribute value (undefined when missing) and its result is type checked.
describe("default as transform", () => {
  test("splits a comma separated attribute into an Array", () => {
    const K = klass({
      tags: {
        type: Array,
        default: (raw) => (raw || "").split(/\s*,\s*/).filter(Boolean),
      },
    });
    expect(K.castProp("tags", "a, b ,c", "x")).toEqual(["a", "b", "c"]);
    expect(errors).toEqual([]);
  });

  test("runs for a missing attribute too, so it doubles as the default", () => {
    const K = klass({
      tags: {
        type: Array,
        default: (raw) => (raw || "").split(/\s*,\s*/).filter(Boolean),
      },
    });
    expect(K.castProp("tags", undefined, "x")).toEqual([]);
  });

  test("result is still type checked", () => {
    const K = klass({ tags: { type: Array, default: (raw) => Number(raw) } });
    expect(K.castProp("tags", "2", "x")).toBe(undefined);
    expect(errors[0].message).toContain("expected Array");
  });

  test("a throwing transform reports and drops the value", () => {
    const K = klass({
      tags: { type: Array, default: () => { throw new Error("boom") } },
    });
    // zero-arg default stays a lazy default, it is not called with the raw value
    expect(K.castProp("tags", '["a"]', "x")).toEqual(["a"]);

    const T = klass({
      tags: { type: Array, default: (raw) => raw.nope.nope },
    });
    expect(T.castProp("tags", "a", "x")).toBe(undefined);
    expect(errors[0].message).toContain("failed");
  });

  test("zero-arg default is untouched - lazy, only when nothing came in", () => {
    let calls = 0;
    const K = klass({ items: { type: Array, default: () => { calls++; return [] } } });
    expect(K.castProp("items", '["a"]', "x")).toEqual(["a"]);
    expect(calls).toBe(0);
    expect(K.castProp("items", undefined, "x")).toEqual([]);
    expect(calls).toBe(1);
  });

  test("Function props keep default as a plain value", () => {
    const fn = (a) => a;
    const K = klass({ on_pick: { type: Function, default: fn } });
    expect(K.castProp("on_pick", undefined, "x")).toBe(fn);
  });
});

describe("transform vs already typed values", () => {
  const K = () =>
    klass({
      tags: {
        type: Array,
        default: (raw) => (raw || "").split(/\s*,\s*/).filter(Boolean),
      },
    });

  test("skips the transform when the value already is the declared type", () => {
    // :tags="someArray" / data-props JSON - a string parser must not see it
    const arr = ["a", "b"];
    expect(K().castProp("tags", arr, "x")).toEqual(["a", "b"]);
    expect(errors).toEqual([]);
  });

  test("still transforms strings", () => {
    expect(K().castProp("tags", "a, b", "x")).toEqual(["a", "b"]);
  });

  test("String transforms keep running on strings", () => {
    const T = klass({ name: { type: String, default: (raw) => String(raw || "").trim() } });
    expect(T.castProp("name", "  hi  ", "x")).toBe("hi");
  });
});

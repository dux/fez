import { test, expect, beforeEach } from "bun:test";
import FezBase from "../src/fez/instance.js";

// this.state schedules a render only for keys the last render read.
// The render itself is simulated: _isRendering (the read-collection window)
// on, read some keys, off.

let fez, scheduled;

const render = (read) => {
  fez._isRendering = true;
  fez._fezReads = new Set();
  fez._fezReadsAll = false;
  read();
  fez._isRendering = false;
};

beforeEach(() => {
  fez = new FezBase();
  fez.fezName = "test-reads";
  fez.root = document.createElement("div");
  fez.props = {};
  scheduled = 0;
  fez.fezNextTick = () => { scheduled++; };
  fez._stateRaw = {};
  fez.state = fez.fezReactiveStore(fez._stateRaw);
});

test("a key the render read schedules on write, an unread key does not", () => {
  render(() => fez.state.shown);
  fez.state.shown = 1;
  expect(scheduled).toBe(1);
  fez.state.hidden = 1;
  fez.state.editor = { destroy() {} };
  expect(scheduled).toBe(1);
});

test("nested writes count against the top-level key the template reads", () => {
  fez._stateRaw.items = [];
  fez._stateRaw.user = { name: "a", tags: [] };
  render(() => { fez.state.items.length; fez.state.user.name; });
  fez.state.items.push("x");
  fez.state.user.tags.push("t");
  expect(scheduled).toBe(2);
  fez._stateRaw.other = { deep: {} };
  fez.state.other.deep.x = 1;
  expect(scheduled).toBe(2);
});

test("'in' counts as a read, ownKeys marks every key as read", () => {
  render(() => { "flag" in fez.state; });
  fez.state.flag = true;
  expect(scheduled).toBe(1);

  render(() => Object.keys(fez.state));
  fez.state.anything = 1;
  expect(scheduled).toBe(2);
});

test("delete notifies like a write, for rendered keys only", () => {
  const seen = [];
  fez.onStateChange = (k, v) => seen.push([k, v]);
  fez._stateRaw.a = 1;
  fez._stateRaw.b = 1;
  render(() => fez.state.a);
  delete fez.state.a;
  delete fez.state.b;
  delete fez.state.missing;
  expect(seen).toEqual([["a", undefined], ["b", undefined]]);
  expect(scheduled).toBe(1);
  expect("a" in fez._stateRaw).toBe(false);
});

test("refresh() and a state write share one render tick", () => {
  const names = [];
  fez.fezNextTick = (fn, name) => names.push(name);
  render(() => fez.state.a);
  fez.fezRefresh();
  fez.state.a = 1;
  expect(names).toEqual(["fezRender", "fezRender"]);
});

test("the read set is rebuilt on every render", () => {
  render(() => fez.state.a);
  render(() => fez.state.b);
  fez.state.a = 1;
  expect(scheduled).toBe(0);
  fez.state.b = 1;
  expect(scheduled).toBe(1);
});

test("onStateChange still fires for every write, rendered or not", () => {
  const seen = [];
  fez.onStateChange = (k) => seen.push(k);
  render(() => fez.state.a);
  fez.state.a = 1;
  fez.state.b = 1;
  expect(seen).toEqual(["a", "b"]);
  expect(scheduled).toBe(1);
});

test("no render yet (pure controller) means writes never schedule", () => {
  fez.state.a = 1;
  fez.state.b = { c: 1 };
  expect(scheduled).toBe(0);
});

test("props writes honour the scope too", () => {
  fez.props = { n: 1 };
  fez.noChangeStateTrigger(() => { fez.props.n = 2; });
  expect(fez.props.n).toBe(2);
  expect(scheduled).toBe(0);
  fez.props.n = 3;
  expect(scheduled).toBe(1);
});

test("noChangeStateTrigger: writes inside the scope fire nothing, scopes nest", () => {
  const seen = [];
  fez.onStateChange = (k) => seen.push(k);
  render(() => fez.state.a);
  const result = fez.noChangeStateTrigger(function () {
    this.state.a = 1;
    this.noChangeStateTrigger(() => { fez.state.a = 2; });
    this.state.a = 3;
    return "done";
  });
  expect(result).toBe("done");
  expect(fez.state.a).toBe(3);
  expect(seen).toEqual([]);
  expect(scheduled).toBe(0);
  // scope closed - triggers are back
  fez.state.a = 4;
  expect(seen).toEqual(["a"]);
  expect(scheduled).toBe(1);
});

test("a state write inside onStateChange does not re-enter the hook", () => {
  const seen = [];
  const ticks = new Set();
  fez.fezNextTick = (fn, name) => ticks.add(name);
  fez.onStateChange = (k) => { seen.push(k); fez.state.log = (fez.state.log || 0) + 1; fez.state.a = 99; };
  render(() => { fez.state.a; fez.state.log; });
  fez.state.a = 1;
  expect(seen).toEqual(["a"]);
  expect(fez.state.log).toBe(1);
  expect(fez.state.a).toBe(99);
  // the hook's own writes schedule too, all on the one debounced fezRender tick
  expect([...ticks]).toEqual(["fezRender"]);
});

test("onStateChange deriving a rendered key from an unread key still paints", () => {
  fez.onStateChange = (k) => { if (k === "raw") fez.state.derived = `D:${fez.state.raw}`; };
  render(() => fez.state.derived);
  fez.state.raw = "x";
  expect(fez.state.derived).toBe("D:x");
  expect(scheduled).toBe(1);
  // an unread key derived from an unread key is still free
  fez.onStateChange = (k) => { if (k === "raw") fez.state.other = 1; };
  fez.state.raw = "y";
  expect(scheduled).toBe(1);
});

test("fez:this refs are written to the raw object: no hook, no render", () => {
  const seen = [];
  fez.onStateChange = (k) => seen.push(k);
  render(() => fez.state.input);
  const node = { nodeType: 1 };
  // what fezRenderPostProcess does for fez-this="input"
  new Function("n", "this._stateRaw.input = n").bind(fez)(node);
  expect(fez.state.input).toBe(node);
  expect(seen).toEqual([]);
  expect(scheduled).toBe(0);
});

test("<slot unwrap /> component: unread keys write silently, a rendered key reports", () => {
  fez._fezStateDisabled = true;
  const errors = [];
  const original = console.error;
  console.error = (msg) => errors.push(msg);
  try {
    render(() => fez.state.label);
    fez.state.picker = { open: true };
    expect(errors).toEqual([]);
    fez.state.label = "b";
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("state.label");
    expect(scheduled).toBe(0);
  } finally {
    console.error = original;
  }
});

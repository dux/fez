import { test, expect } from "bun:test";
import FezBase from "../src/fez/instance.js";

// Minimal fake EventTarget that records add/remove and dispatches synchronously
function makeTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) {
      listeners.get(name)?.delete(fn);
    },
    dispatch(name, evt) {
      listeners.get(name)?.forEach(fn => fn(evt));
    },
  };
}

function makeInstance() {
  const inst = Object.create(FezBase.prototype);
  inst._onDestroyCallbacks = [];
  inst.root = { isConnected: true };
  return inst;
}

function destroy(inst) {
  inst._onDestroyCallbacks.forEach(cb => cb());
  inst._onDestroyCallbacks = [];
}

test("on -2-arg form defaults target to document", () => {
  const inst = makeInstance();
  const fakeDoc = makeTarget();
  const realDoc = globalThis.document;
  globalThis.document = fakeDoc;

  try {
    let received = null;
    inst.on("test-event", function (e) {
      received = { ctx: this, evt: e };
    });

    fakeDoc.dispatch("test-event", { foo: 1 });

    expect(received.ctx).toBe(inst);
    expect(received.evt).toEqual({ foo: 1 });
  } finally {
    globalThis.document = realDoc;
  }
});

test("on -3-arg form uses explicit target", () => {
  const inst = makeInstance();
  const target = makeTarget();

  let calls = 0;
  inst.on(target, "ping", () => calls++);

  target.dispatch("ping");
  target.dispatch("ping");

  expect(calls).toBe(2);
});

test("on -handler is bound to component", () => {
  const inst = makeInstance();
  inst.marker = "component-this";
  const target = makeTarget();

  let seen;
  inst.on(target, "ping", function () {
    seen = this.marker;
  });

  target.dispatch("ping");
  expect(seen).toBe("component-this");
});

test("on -skipped when isConnected is false", () => {
  const inst = makeInstance();
  const target = makeTarget();

  let calls = 0;
  inst.on(target, "ping", () => calls++);

  target.dispatch("ping");
  expect(calls).toBe(1);

  inst.root.isConnected = false;
  target.dispatch("ping");
  expect(calls).toBe(1);

  inst.root.isConnected = true;
  target.dispatch("ping");
  expect(calls).toBe(2);
});

test("on -listener removed on destroy", () => {
  const inst = makeInstance();
  const target = makeTarget();

  let calls = 0;
  inst.on(target, "ping", () => calls++);

  target.dispatch("ping");
  expect(calls).toBe(1);

  destroy(inst);

  target.dispatch("ping");
  expect(calls).toBe(1);
  expect(target.listeners.get("ping").size).toBe(0);
});

test("on -returns disposer for early unregister", () => {
  const inst = makeInstance();
  const target = makeTarget();

  let calls = 0;
  const dispose = inst.on(target, "ping", () => calls++);

  target.dispatch("ping");
  expect(calls).toBe(1);

  dispose();

  target.dispatch("ping");
  expect(calls).toBe(1);
  expect(target.listeners.get("ping").size).toBe(0);
});

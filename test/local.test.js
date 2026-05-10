import { test, expect } from "bun:test";
import FezBase from "../src/fez/instance.js";

class LocalComponent extends FezBase {
  constructor() {
    super();
    this.fezName = "test-local";
    this.root = document.createElement("div");
    this.props = {};
    this.class = LocalComponent;
  }
}

test("this.local is isolated per component instance", () => {
  const first = new LocalComponent();
  const second = new LocalComponent();

  first.local.value = 123;
  first.local.config = { mode: "one" };

  expect(first.local.value).toBe(123);
  expect(first.local.config).toEqual({ mode: "one" });
  expect(second.local.value).toBeUndefined();
  expect(second.local.config).toBeUndefined();
});

test("this.local mutations do not schedule reactive renders", () => {
  const component = new LocalComponent();

  let renders = 0;
  component.fezRender = () => {
    renders += 1;
  };
  component.fezNextTick = (fn) => fn.call(component);
  component.state = component.fezReactiveStore();

  component.local.value = "cached";
  component.local.handler = () => "ok";
  expect(renders).toBe(0);

  component.state.value = "reactive";
  expect(renders).toBe(1);
});

test("this.local is available during onDestroy and cleared after destroy", () => {
  const component = new LocalComponent();
  const originalLocal = component.local;
  let valueDuringDestroy;

  component.local.resource = "editor";
  component.onDestroy = function () {
    valueDuringDestroy = this.local.resource;
  };

  component.fezOnDestroy();

  expect(valueDuringDestroy).toBe("editor");
  expect(component.local).not.toBe(originalLocal);
  expect(component.local).toEqual({});
});

import { test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { nodeMorph } from "../src/fez/lib/morph.js";

// Form state and keyed matching in the generic differ.

let document, saved;

beforeAll(() => {
  saved = global.document;
  document = new Window().document;
  global.document = document;
});

afterAll(() => {
  global.document = saved;
});

function mount(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function morphTo(container, html, opts) {
  const next = document.createElement("div");
  next.innerHTML = html;
  nodeMorph(container, next, opts);
}

test("typed text in an unbound input survives an unrelated re-render", () => {
  const c = mount('<input name="a"><textarea>t</textarea><p>1</p>');
  c.querySelector("input").value = "typed";
  c.querySelector("textarea").value = "edited";
  morphTo(c, '<input name="a"><textarea>t</textarea><p>2</p>');
  expect(c.querySelector("input").value).toBe("typed");
  expect(c.querySelector("textarea").value).toBe("edited");
});

test("a changed template value still wins", () => {
  const c = mount('<input value="a"><textarea>a</textarea>');
  c.querySelector("input").value = "typed";
  c.querySelector("textarea").value = "typed";
  morphTo(c, '<input value="b"><textarea>b</textarea>');
  expect(c.querySelector("input").value).toBe("b");
  expect(c.querySelector("textarea").value).toBe("b");
});

test("a user-checked box and a user-picked option survive, a template change wins", () => {
  const c = mount('<input type="checkbox"><select><option>a</option><option>b</option></select>');
  c.querySelector("input").checked = true;
  c.querySelector("select").value = "b";
  morphTo(c, '<input type="checkbox"><select><option>a</option><option>b</option></select>');
  expect(c.querySelector("input").checked).toBe(true);
  expect(c.querySelector("select").value).toBe("b");

  morphTo(c, '<input type="checkbox" checked><select><option selected>a</option><option>b</option></select>');
  expect(c.querySelector("input").checked).toBe(true);
  expect(c.querySelector("select").value).toBe("a");
});

test("multi-select keeps every selected option", () => {
  const html = '<select multiple><option selected>a</option><option>b</option><option selected>c</option></select>';
  const c = mount(html);
  morphTo(c, html);
  expect([...c.querySelector("select").selectedOptions].map((o) => o.value)).toEqual(["a", "c"]);
});

test("file inputs are never assigned", () => {
  const c = mount('<input type="file" name="f">');
  expect(() => morphTo(c, '<input type="file" name="f" value="x">')).not.toThrow();
});

test("an item with a new key is a new node, not the old one reused", () => {
  const c = mount('<ul><li key="a">a</li><li key="b">b</li></ul>');
  const a = c.querySelector('[key="a"]');
  morphTo(c, '<ul><li key="c">c</li><li key="b">b</li></ul>');
  const first = c.querySelector("li");
  expect(first.getAttribute("key")).toBe("c");
  expect(first).not.toBe(a);
});

test("a template that moves a single select's selection wins in one step", () => {
  const options = (sel) =>
    ["a", "b", "c"].map((v, i) => `<option value="${v}" selected="${i === sel}">${v}</option>`).join("");
  const c = mount(`<select>${options(0)}</select>`);
  morphTo(c, `<select>${options(1)}</select>`);
  expect(c.querySelector("select").value).toBe("b");
  morphTo(c, `<select>${options(2)}</select>`);
  expect(c.querySelector("select").value).toBe("c");
});

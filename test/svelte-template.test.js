import { describe, test, expect, beforeAll } from "bun:test";
import { Window } from "happy-dom";
import createSvelteTemplate from "../src/fez/lib/svelte-template.js";

// Setup happy-dom for DOM APIs
const window = new Window();
globalThis.document = window.document;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Node = window.Node;

// Mock Fez
globalThis.Fez = {
  htmlEscape: (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  toPairs: (c) => {
    if (Array.isArray(c)) return c.map((v, i) => [v, i]);
    if (c && typeof c === "object") return Object.entries(c);
    return [];
  },
  // Mock Fez.fezAwait for template tests
  fezAwait: (component, awaitId, promiseOrValue) => {
    component._awaitStates ||= new Map();

    // If not a promise, return resolved immediately
    if (!promiseOrValue || typeof promiseOrValue.then !== "function") {
      return { status: "resolved", value: promiseOrValue, error: null };
    }

    // Check existing state
    const existing = component._awaitStates.get(awaitId);
    if (existing && existing.promise === promiseOrValue) {
      return existing;
    }

    // New promise - set pending state
    const state = {
      status: "pending",
      value: null,
      error: null,
      promise: promiseOrValue,
    };
    component._awaitStates.set(awaitId, state);

    // Track promise for testing
    promiseOrValue
      .then((value) => {
        const current = component._awaitStates.get(awaitId);
        if (current && current.promise === promiseOrValue) {
          current.status = "resolved";
          current.value = value;
        }
      })
      .catch((error) => {
        const current = component._awaitStates.get(awaitId);
        if (current && current.promise === promiseOrValue) {
          current.status = "rejected";
          current.error = error;
        }
      });

    return state;
  },
};

// Create fezGlobals store for component context
const createFezGlobals = () => ({
  _data: new Map(),
  _counter: 0,
  set(value) {
    const key = this._counter++;
    this._data.set(key, value);
    return key;
  },
  delete(key) {
    const value = this._data.get(key);
    this._data.delete(key);
    return value;
  },
});

// Helper to render template and get HTML string
const render = (template, ctx) => {
  ctx.UID = ctx.UID || 123;
  ctx.Fez = Fez;
  ctx.fezGlobals = ctx.fezGlobals || createFezGlobals();
  const fn = createSvelteTemplate(template);
  return fn(ctx);
};

describe("Svelte-style template", () => {
  describe("expressions", () => {
    test("simple expression", () => {
      const html = render("{state.name}", { state: { name: "Alice" } });
      expect(html).toBe("Alice");
    });

    test("expression with state prefix works", () => {
      const html = render("{state.count}", { state: { count: 42 } });
      expect(html).toBe("42");
    });

    test("@html outputs raw HTML", () => {
      const html = render("{@html state.text}", {
        state: { text: "<b>bold</b>" },
      });
      expect(html).toContain("<b>bold</b>");
    });

    test("@json outputs formatted JSON", () => {
      const html = render("{@json state.obj}", { state: { obj: { a: 1 } } });
      expect(html).toContain('<pre class="json">');
      expect(html).toContain("&quot;a&quot;: 1"); // JSON keys are escaped
    });

    test("@block defines and references reusable content", () => {
      const html = render(
        '{@block avatar}<img src="test.png"/>{/block}<div>{@block:avatar}</div><span>{@block:avatar}</span>',
        { state: {} },
      );
      expect(html).toBe(
        '<div><img src="test.png"/></div><span><img src="test.png"/></span>',
      );
    });
  });

  describe("#if / #unless conditionals", () => {
    test("basic #if", () => {
      const html = render("{#if state.show}visible{/if}", {
        state: { show: true },
      });
      expect(html).toBe("visible");
    });

    test("#if false", () => {
      const html = render("{#if state.show}visible{/if}", {
        state: { show: false },
      });
      expect(html).toBe("");
    });

    test("#if with :else", () => {
      expect(
        render("{#if state.show}yes{:else}no{/if}", { state: { show: true } }),
      ).toBe("yes");
      expect(
        render("{#if state.show}yes{:else}no{/if}", { state: { show: false } }),
      ).toBe("no");
    });

    test("#if with :else if", () => {
      expect(
        render(
          "{#if state.x === 1}one{:else if state.x === 2}two{:else}other{/if}",
          { state: { x: 1 } },
        ),
      ).toBe("one");
      expect(
        render(
          "{#if state.x === 1}one{:else if state.x === 2}two{:else}other{/if}",
          { state: { x: 2 } },
        ),
      ).toBe("two");
      expect(
        render(
          "{#if state.x === 1}one{:else if state.x === 2}two{:else}other{/if}",
          { state: { x: 3 } },
        ),
      ).toBe("other");
    });

    test("#unless", () => {
      expect(
        render("{#unless state.hidden}visible{/unless}", {
          state: { hidden: false },
        }),
      ).toBe("visible");
      expect(
        render("{#unless state.hidden}visible{/unless}", {
          state: { hidden: true },
        }),
      ).toBe("");
    });

    test("nested #if in element", () => {
      const html = render(
        "<div>{#if state.show}<span>inside</span>{/if}</div>",
        { state: { show: true } },
      );
      expect(html).toBe("<div><span>inside</span></div>");
    });
  });

  describe("#each / #for loops", () => {
    test("#each array", () => {
      const html = render("{#each state.items as item}<li>{item}</li>{/each}", {
        state: { items: ["a", "b", "c"] },
      });
      expect(html).toBe("<li>a</li><li>b</li><li>c</li>");
    });

    test("#each with index", () => {
      const html = render(
        "{#each state.items as item, idx}<li>{idx}:{item}</li>{/each}",
        {
          state: { items: ["a", "b"] },
        },
      );
      expect(html).toBe("<li>0:a</li><li>1:b</li>");
    });

    test("#each with implicit i index", () => {
      const html = render(
        "{#each state.items as item}<li>{i}:{item}</li>{/each}",
        {
          state: { items: ["x", "y"] },
        },
      );
      expect(html).toBe("<li>0:x</li><li>1:y</li>");
    });

    test("#for array", () => {
      const html = render("{#for item in state.items}<li>{item}</li>{/for}", {
        state: { items: ["a", "b"] },
      });
      expect(html).toBe("<li>a</li><li>b</li>");
    });

    test("#for with index", () => {
      const html = render(
        "{#for item, idx in state.items}<li>{idx}:{item}</li>{/for}",
        {
          state: { items: ["a", "b"] },
        },
      );
      expect(html).toBe("<li>0:a</li><li>1:b</li>");
    });

    test("#each object (3 params)", () => {
      const html = render(
        "{#each state.obj as key, value, idx}<li>{idx}:{key}={value}</li>{/each}",
        {
          state: { obj: { a: 1, b: 2 } },
        },
      );
      expect(html).toBe("<li>0:a=1</li><li>1:b=2</li>");
    });

    test("#for object (3 params)", () => {
      const html = render(
        "{#for key, value, idx in state.obj}<li>{idx}:{key}={value}</li>{/for}",
        {
          state: { obj: { x: 10, y: 20 } },
        },
      );
      expect(html).toBe("<li>0:x=10</li><li>1:y=20</li>");
    });

    test("#for object without brackets (2 params)", () => {
      const html = render(
        "{#for key, val in state.obj}<li>{key}={val}</li>{/for}",
        {
          state: { obj: { a: 1, b: 2 } },
        },
      );
      expect(html).toBe("<li>a=1</li><li>b=2</li>");
    });

    test("#each object without brackets (2 params)", () => {
      const html = render(
        "{#each state.obj as key, val}<li>{key}:{val}</li>{/each}",
        {
          state: { obj: { x: 10, y: 20 } },
        },
      );
      expect(html).toBe("<li>x:10</li><li>y:20</li>");
    });

    test("#for array with 2 params gives value and index", () => {
      const html = render(
        "{#for val, idx in state.items}<li>{idx}:{val}</li>{/for}",
        {
          state: { items: ["a", "b"] },
        },
      );
      expect(html).toBe("<li>0:a</li><li>1:b</li>");
    });

    test("#for simple list (single param)", () => {
      const html = render(
        "{#for item in state.items}<span>{item}</span>{/for}",
        {
          state: { items: ["x", "y", "z"] },
        },
      );
      expect(html).toBe("<span>x</span><span>y</span><span>z</span>");
    });

    test("#for list of lists - inner list not deconstructed", () => {
      const html = render(
        "{#for item in state.items}<span>{item[0]}</span>{/for}",
        {
          state: { items: [["foo"], ["bar"]] },
        },
      );
      expect(html).toBe("<span>foo</span><span>bar</span>");
    });

    test("#for list of lists with index - inner list not deconstructed", () => {
      const html = render(
        "{#for item, idx in state.items}<span>{idx}:{item[0]}</span>{/for}",
        {
          state: { items: [["foo"], ["bar"]] },
        },
      );
      expect(html).toBe("<span>0:foo</span><span>1:bar</span>");
    });

    test("#for object with nested object values - value not deconstructed", () => {
      const html = render(
        "{#for k, v in state.obj}<span>{k}:{v.bar}</span>{/for}",
        {
          state: { obj: { foo: { bar: "baz" }, x: { bar: "y" } } },
        },
      );
      expect(html).toBe("<span>foo:baz</span><span>x:y</span>");
    });

    test("#each object with nested object values - value not deconstructed", () => {
      const html = render(
        "{#each state.obj as k, v}<span>{k}={v.name}</span>{/each}",
        {
          state: { obj: { a: { name: "Alice" }, b: { name: "Bob" } } },
        },
      );
      expect(html).toBe("<span>a=Alice</span><span>b=Bob</span>");
    });

    test("#for empty array returns empty string", () => {
      const html = render(
        "{#for item in state.items}<span>{item}</span>{/for}",
        {
          state: { items: [] },
        },
      );
      expect(html).toBe("");
    });

    test("#for null/undefined returns empty string", () => {
      const html = render(
        "{#for item in state.items}<span>{item}</span>{/for}",
        {
          state: { items: null },
        },
      );
      expect(html).toBe("");
    });

    test("#for with 2 params on empty array returns empty string", () => {
      const html = render(
        "{#for k, v in state.obj}<span>{k}={v}</span>{/for}",
        {
          state: { obj: {} },
        },
      );
      expect(html).toBe("");
    });

    test("#for with :else shows else content on empty array", () => {
      const html = render(
        "{#for item in state.items}<span>{item}</span>{:else}<p>No items</p>{/for}",
        {
          state: { items: [] },
        },
      );
      expect(html).toBe("<p>No items</p>");
    });

    test("#for with :else shows loop content when array has items", () => {
      const html = render(
        "{#for item in state.items}<span>{item}</span>{:else}<p>No items</p>{/for}",
        {
          state: { items: ["a", "b"] },
        },
      );
      expect(html).toBe("<span>a</span><span>b</span>");
    });

    test("#each with :else shows else content on empty object", () => {
      const html = render(
        "{#each state.obj as k, v}<span>{k}</span>{:else}<p>Empty</p>{/each}",
        {
          state: { obj: {} },
        },
      );
      expect(html).toBe("<p>Empty</p>");
    });

    test("#for with :else on null shows else content", () => {
      const html = render(
        "{#for item in state.items}<span>{item}</span>{:else}<p>Nothing</p>{/for}",
        {
          state: { items: null },
        },
      );
      expect(html).toBe("<p>Nothing</p>");
    });

    test("#if inside #each", () => {
      const html = render(
        "{#each state.users as user}{#if user.active}<span>{user.name}</span>{/if}{/each}",
        {
          state: {
            users: [
              { name: "Alice", active: true },
              { name: "Bob", active: false },
            ],
          },
        },
      );
      expect(html).toBe("<span>Alice</span>");
    });

    test("#each inside #if", () => {
      const html = render(
        "{#if state.showList}{#each state.items as item}<li>{item}</li>{/each}{/if}",
        { state: { showList: true, items: ["a", "b"] } },
      );
      expect(html).toBe("<li>a</li><li>b</li>");
    });
  });

  describe("attributes", () => {
    test("static attribute preserved", () => {
      const html = render('<div class="box">test</div>', { state: {} });
      expect(html).toBe('<div class="box">test</div>');
    });

    test("embedded expression in quoted attribute value", () => {
      const html = render('<a name="section-{state.id}">link</a>', {
        state: { id: "foo" },
      });
      expect(html).toBe('<a name="section-foo">link</a>');
    });

    test("multiple embedded expressions in attribute", () => {
      const html = render(
        '<div id="{state.prefix}-{state.suffix}">test</div>',
        { state: { prefix: "a", suffix: "b" } },
      );
      expect(html).toBe('<div id="a-b">test</div>');
    });

    test("conditional class expression", () => {
      expect(
        render("<div class=\"box {state.active ? 'on' : ''}\">test</div>", {
          state: { active: true },
        }),
      ).toBe('<div class="box on">test</div>');
      expect(
        render("<div class=\"box {state.active ? 'on' : ''}\">test</div>", {
          state: { active: false },
        }),
      ).toBe('<div class="box ">test</div>');
    });
  });

  describe("event handlers in HTML", () => {
    // Event handlers are rendered as attributes - the actual binding happens during morphing
    test("onclick attribute is preserved", () => {
      const html = render('<button onclick="fez.doIt()">click</button>', {
        state: {},
      });
      expect(html).toContain('onclick="fez.doIt()"');
    });

    test("onclick with expression in loop", () => {
      const html = render(
        "{#each state.items as item}<button onclick=\"fez.click('{item}')\">click</button>{/each}",
        {
          state: { items: ["a", "b"] },
        },
      );
      expect(html).toContain("onclick=\"fez.click('a')\"");
      expect(html).toContain("onclick=\"fez.click('b')\"");
    });
  });

  describe("edge cases", () => {
    test("handles empty state.items array", () => {
      const html = render("{#each state.items as item}<li>{item}</li>{/each}", {
        state: { items: [] },
      });
      expect(html).toBe("");
    });

    test("handles undefined state.items", () => {
      const html = render("{#each state.items as item}<li>{item}</li>{/each}", {
        state: {},
      });
      expect(html).toBe("");
    });

    test("escapes HTML in expressions", () => {
      const html = render("{state.text}", {
        state: { text: "<script>evil</script>" },
      });
      expect(html).toBe("&lt;script&gt;evil&lt;/script&gt;");
    });

    test("preserves whitespace in text", () => {
      const html = render("<pre>{state.code}</pre>", {
        state: { code: "line1\nline2" },
      });
      expect(html).toBe("<pre>line1\nline2</pre>");
    });

    test("JS template literal with object inside attribute is preserved", () => {
      const html = render(
        "<span onclick=\"Dialog.load(`${state.path}/top_menu_dialog`, {d: 'top'})\">click</span>",
        {
          state: { path: "/app" },
        },
      );
      expect(html).toContain(
        "Dialog.load(`${state.path}/top_menu_dialog`, {d: 'top'})",
      );
    });

    test("JS template literal with interpolation is preserved", () => {
      const html = render(
        '<a href="javascript:alert(`Hello ${state.name}`)">test</a>',
        {
          state: { name: "World" },
        },
      );
      expect(html).toContain("`Hello ${state.name}`");
    });

    test("simple object literal is preserved", () => {
      const html = render('<div data-opts="{foo: 1}">test</div>', {
        state: {},
      });
      expect(html).toContain("{foo: 1}");
    });

    test("object literal with multiple keys is preserved", () => {
      const html = render('<div onclick="fn({a: 1, b: 2, c: 3})">test</div>', {
        state: {},
      });
      expect(html).toContain("{a: 1, b: 2, c: 3}");
    });

    test("object literal with quoted keys is preserved", () => {
      const html = render("<div data-x=\"{'key': 1}\">test</div>", {
        state: {},
      });
      expect(html).toContain("{'key': 1}");
    });

    test("object literal with double-quoted keys is preserved", () => {
      const html = render("<div data-x='{\"key\": 1}'>test</div>", {
        state: {},
      });
      expect(html).toContain('{"key": 1}');
    });

    test("nested object literals are preserved", () => {
      const html = render('<div onclick="fn({a: {b: 1}})">test</div>', {
        state: {},
      });
      expect(html).toContain("{a: {b: 1}}");
    });

    test("object literal does not interfere with Fez expressions", () => {
      const html = render(
        '<div>{state.name}</div><span data-x="{foo: 1}">test</span>',
        {
          state: { name: "Alice" },
        },
      );
      expect(html).toContain("Alice");
      expect(html).toContain("{foo: 1}");
    });

    test("object literal in onclick with Fez loop", () => {
      const html = render(
        '{#each state.items as item}<button onclick="send({id: 1})">{item}</button>{/each}',
        {
          state: { items: ["a", "b"] },
        },
      );
      expect(html).toBe(
        '<button onclick="send({id: 1})">a</button><button onclick="send({id: 1})">b</button>',
      );
    });
  });

  describe("#await blocks", () => {
    test("non-promise value shows :then content immediately", () => {
      const html = render(
        "{#await state.data}{:then value}<p>{value}</p>{/await}",
        {
          state: { data: "hello" },
        },
      );
      expect(html).toBe("<p>hello</p>");
    });

    test("pending promise shows pending content", () => {
      const promise = new Promise(() => {}); // Never resolves
      const html = render(
        "{#await state.data}<p>Loading...</p>{:then value}<p>{value}</p>{/await}",
        {
          state: { data: promise },
        },
      );
      expect(html).toBe("<p>Loading...</p>");
    });

    test("resolved promise shows :then content", async () => {
      const promise = Promise.resolve("result");
      const ctx = {
        state: { data: promise },
        UID: 100,
        fezGlobals: createFezGlobals(),
      };

      // First render - pending
      let html = render(
        "{#await state.data}<p>Loading...</p>{:then value}<p>{value}</p>{/await}",
        ctx,
      );
      expect(html).toBe("<p>Loading...</p>");

      // Wait for promise to resolve
      await promise;

      // Second render - resolved
      html = render(
        "{#await state.data}<p>Loading...</p>{:then value}<p>{value}</p>{/await}",
        ctx,
      );
      expect(html).toBe("<p>result</p>");
    });

    test("rejected promise shows :catch content", async () => {
      const error = new Error("failed");
      const promise = Promise.reject(error);
      const ctx = {
        state: { data: promise },
        UID: 101,
        fezGlobals: createFezGlobals(),
      };

      // First render - pending
      let html = render(
        "{#await state.data}<p>Loading...</p>{:then value}<p>{value}</p>{:catch err}<p>Error: {err.message}</p>{/await}",
        ctx,
      );
      expect(html).toBe("<p>Loading...</p>");

      // Wait for promise to reject and internal handler to update state
      try {
        await promise;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 0));

      // Second render - rejected
      html = render(
        "{#await state.data}<p>Loading...</p>{:then value}<p>{value}</p>{:catch err}<p>Error: {err.message}</p>{/await}",
        ctx,
      );
      expect(html).toBe("<p>Error: failed</p>");
    });

    test("await without :then shows only pending content", () => {
      const promise = new Promise(() => {});
      const html = render("{#await state.data}<p>Loading...</p>{/await}", {
        state: { data: promise },
      });
      expect(html).toBe("<p>Loading...</p>");
    });

    test("await with only :then (no pending content)", () => {
      const html = render(
        "{#await state.data}{:then value}<p>{value}</p>{/await}",
        {
          state: { data: "immediate" },
        },
      );
      expect(html).toBe("<p>immediate</p>");
    });

    test("await skips pending for non-promise", () => {
      const html = render(
        "{#await state.data}<p>Loading...</p>{:then value}<p>Got: {value}</p>{/await}",
        {
          state: { data: 42 },
        },
      );
      expect(html).toBe("<p>Got: 42</p>");
    });

    test("await with :catch but no :then", async () => {
      const error = new Error("oops");
      const promise = Promise.reject(error);
      const ctx = {
        state: { data: promise },
        UID: 102,
        fezGlobals: createFezGlobals(),
      };

      // First render - pending
      let html = render(
        "{#await state.data}<p>Loading...</p>{:catch err}<p>{err.message}</p>{/await}",
        ctx,
      );
      expect(html).toBe("<p>Loading...</p>");

      // Wait for rejection and internal handler to update state
      try {
        await promise;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 0));

      // Second render - shows catch
      html = render(
        "{#await state.data}<p>Loading...</p>{:catch err}<p>{err.message}</p>{/await}",
        ctx,
      );
      expect(html).toBe("<p>oops</p>");
    });

    test("multiple await blocks work independently", () => {
      const html = render(
        "{#await state.a}{:then v}<span>A:{v}</span>{/await}" +
          "{#await state.b}{:then v}<span>B:{v}</span>{/await}",
        { state: { a: 1, b: 2 } },
      );
      expect(html).toBe("<span>A:1</span><span>B:2</span>");
    });

    test("await with nested HTML", () => {
      const html = render(
        '{#await state.user}{:then u}<div class="card"><h1>{u.name}</h1><p>{u.email}</p></div>{/await}',
        {
          state: { user: { name: "Alice", email: "alice@example.com" } },
        },
      );
      expect(html).toBe(
        '<div class="card"><h1>Alice</h1><p>alice@example.com</p></div>',
      );
    });
  });

  describe('colon attribute conversion (:attr="expr")', () => {
    test(':attr="expr" converts to fezGlobals mechanism', () => {
      const ctx = { state: { items: ["a", "b", "c"] }, UID: 123 };
      const html = render(
        '<child-component :data="state.items"></child-component>',
        ctx,
      );
      // Value is stored and attribute contains Fez(UID).fezGlobals.delete(id) for child to retrieve
      expect(html).toContain(":data=Fez(123).fezGlobals.delete(");
      expect(ctx.fezGlobals._counter).toBeGreaterThan(0);
    });

    test(':attr="expr" works with nested object paths', () => {
      const html = render(
        '<child-component :user="state.user.profile"></child-component>',
        {
          state: { user: { profile: { name: "Alice" } } },
          UID: 456,
        },
      );
      expect(html).toContain(":user=Fez(456).fezGlobals.delete(");
    });

    test(':attr="expr" works in loops', () => {
      const html = render(
        '{#each state.items as item}<child-component :item="item"></child-component>{/each}',
        {
          state: { items: ["x", "y"] },
          UID: 789,
        },
      );
      // Each loop iteration stores a value
      expect(html).toMatch(
        /:item=Fez\(789\)\.fezGlobals\.delete\(\d+\).*:item=Fez\(789\)\.fezGlobals\.delete\(\d+\)/,
      );
    });

    test(':attr="fez.state.x" works because fez is bound to this', () => {
      const html = render(
        '<child-component :data="fez.state.items"></child-component>',
        {
          state: { items: [1, 2, 3] },
          UID: 999,
        },
      );
      expect(html).toContain(":data=Fez(999).fezGlobals.delete(");
    });
  });

  describe("fez-this auto-ID generation", () => {
    test("static fez-this gets auto-generated id", () => {
      const html = render('<input fez-this="nameInput" />', {
        state: {},
        UID: 42,
      });
      expect(html).toContain('id="fez-42-nameInput"');
      expect(html).toContain('fez-this="nameInput"');
    });

    test("fez-this with special chars gets sanitized id", () => {
      const html = render('<input fez-this="taskInputs[0]" />', {
        state: {},
        UID: 42,
      });
      expect(html).toContain('id="fez-42-taskInputs-0-"');
    });

    test("fez-this with underscores gets sanitized id", () => {
      const html = render('<input fez-this="task_input_123" />', {
        state: {},
        UID: 42,
      });
      expect(html).toContain('id="fez-42-task-input-123"');
    });

    test("existing id attribute is not overwritten", () => {
      const html = render('<input id="custom-id" fez-this="nameInput" />', {
        state: {},
        UID: 42,
      });
      expect(html).toContain('id="custom-id"');
      expect(html).not.toContain('id="fez-42-nameInput"');
    });

    test("existing id before fez-this is preserved", () => {
      const html = render('<input id="my-input" fez-this="inputRef" />', {
        state: {},
        UID: 42,
      });
      expect(html).toContain('id="my-input"');
      expect(html).not.toContain("fez-42");
    });

    test("dynamic fez-this with expression is not auto-id", () => {
      const html = render('<input fez-this="input_{task.id}" />', {
        state: {},
        task: { id: 5 },
        UID: 42,
      });
      // Should not get auto-ID because it contains {expr}
      expect(html).not.toContain('id="fez-42');
    });

    test("multiple fez-this elements each get unique ids", () => {
      const html = render(
        '<input fez-this="firstName" /><input fez-this="lastName" />',
        { state: {}, UID: 42 },
      );
      expect(html).toContain('id="fez-42-firstName"');
      expect(html).toContain('id="fez-42-lastName"');
    });

    test("fez-this in loop still gets id (based on static value)", () => {
      const html = render(
        '{#each state.items as item, i}<input fez-this="inputs[{i}]" />{/each}',
        {
          state: { items: ["a", "b"] },
          UID: 42,
        },
      );
      // Should not get auto-ID because it contains {i} expression
      expect(html).not.toContain('id="fez-42');
    });

    test("fez-this on various elements", () => {
      const html = render(
        '<textarea fez-this="textArea"></textarea><select fez-this="dropdown"></select>',
        { state: {}, UID: 42 },
      );
      expect(html).toContain('id="fez-42-textArea"');
      expect(html).toContain('id="fez-42-dropdown"');
    });

    test("fez-this with other attributes", () => {
      const html = render(
        '<input type="text" fez-this="myInput" class="form-control" />',
        { state: {}, UID: 42 },
      );
      expect(html).toContain('id="fez-42-myInput"');
      expect(html).toContain('type="text"');
      expect(html).toContain('class="form-control"');
    });

    test("fez-this id uses component UID for uniqueness", () => {
      const html1 = render('<input fez-this="nameInput" />', {
        state: {},
        UID: 100,
      });
      const html2 = render('<input fez-this="nameInput" />', {
        state: {},
        UID: 200,
      });
      expect(html1).toContain('id="fez-100-nameInput"');
      expect(html2).toContain('id="fez-200-nameInput"');
    });
  });

  describe("fez: namespace syntax", () => {
    test("fez:keep is converted to fez-keep", () => {
      const html = render('<div fez:keep="foo">content</div>', { state: {} });
      expect(html).toContain('fez-keep="foo"');
    });

    test("fez:bind is converted to fez-bind", () => {
      const html = render('<input fez:bind="state.name" />', {
        state: { name: "test" },
      });
      expect(html).toContain("fez-bind=");
    });

    test("fez:this is converted to fez-this and gets auto-ID", () => {
      const html = render('<input fez:this="myInput" />', {
        state: {},
        UID: 42,
      });
      expect(html).toContain('fez-this="myInput"');
      expect(html).toContain('id="fez-42-myInput"');
    });

    test("fez:use is converted to fez-use", () => {
      const html = render('<div fez:use="animate">content</div>', {
        state: {},
      });
      expect(html).toContain('fez-use="animate"');
    });

    test("fez:class is converted to fez-class", () => {
      const html = render('<span fez:class="active:100">text</span>', {
        state: {},
      });
      expect(html).toContain('fez-class="active:100"');
    });

    test("multiple fez: attributes in one element", () => {
      const html = render('<input fez:this="name" fez:bind="state.name" />', {
        state: { name: "val" },
        UID: 42,
      });
      expect(html).toContain('fez-this="name"');
      expect(html).toContain("fez-bind=");
    });

    test("mixed fez: and fez- syntax both work", () => {
      const html = render('<div fez:keep="a"><input fez-this="b" /></div>', {
        state: {},
        UID: 42,
      });
      expect(html).toContain('fez-keep="a"');
      expect(html).toContain('fez-this="b"');
    });

    test("fez:keep on fez component logs error", () => {
      const errors = [];
      const origError = console.error;
      console.error = (...args) => errors.push(args.join(" "));

      render('<ui-star fez:keep="star-1" fill="50" />', { state: {} });

      console.error = origError;
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("fez:keep must be on plain HTML elements");
      expect(errors[0]).toContain("ui-star");
    });

    test("fez:keep on plain HTML element does not log error", () => {
      const errors = [];
      const origError = console.error;
      console.error = (...args) => errors.push(args.join(" "));

      render('<span fez:keep="star-1"><ui-star fill="50" /></span>', {
        state: {},
      });

      console.error = origError;
      expect(errors.length).toBe(0);
    });
  });
});

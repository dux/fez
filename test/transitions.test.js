import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import {
  parseTransition,
  resolveEasing,
  runTransition,
  transitions,
  EASINGS,
} from "../src/fez/lib/transitions.js";

let document;
let originalDocument;

beforeAll(() => {
  originalDocument = global.document;
  document = new Window().document;
  global.document = document;
});

afterAll(() => {
  global.document = originalDocument;
});

describe("parseTransition", () => {
  test("bare name", () => {
    expect(parseTransition("fade")).toEqual({ name: "fade", params: {} });
  });

  test("comma + equals notation", () => {
    expect(parseTransition("fly, y=20, duration=300")).toEqual({
      name: "fly",
      params: { y: 20, duration: 300 },
    });
  });

  test("semicolon + colon notation", () => {
    expect(parseTransition("fly; y: 20; duration: 300; easing: quintOut")).toEqual({
      name: "fly",
      params: { y: 20, duration: 300, easing: "quintOut" },
    });
  });

  test("mixed separators and sloppy whitespace", () => {
    expect(parseTransition("  slide ,axis = x ;delay:50  ")).toEqual({
      name: "slide",
      params: { axis: "x", delay: 50 },
    });
  });

  test("coerces numbers, negatives, floats and booleans", () => {
    const { params } = parseTransition("fly, x=-20, opacity=0.5, flag=true, off=false, name=abc");
    expect(params).toEqual({ x: -20, opacity: 0.5, flag: true, off: false, name: "abc" });
  });

  test("strips quotes from quoted values", () => {
    expect(parseTransition("x, easing='ease-out'").params.easing).toBe("ease-out");
  });

  test("keeps commas inside parentheses (cubic-bezier)", () => {
    const { params } = parseTransition("fade, easing=cubic-bezier(0.1, 0.2, 0.3, 1), duration=100");
    expect(params.easing).toBe("cubic-bezier(0.1, 0.2, 0.3, 1)");
    expect(params.duration).toBe(100);
  });

  test("bare tokens become boolean flags", () => {
    expect(parseTransition("fade, global").params.global).toBe(true);
  });

  test("empty / null input", () => {
    expect(parseTransition("")).toEqual({ name: "", params: {} });
    expect(parseTransition(null)).toEqual({ name: "", params: {} });
  });
});

describe("resolveEasing", () => {
  test("maps svelte-style names to cubic-bezier", () => {
    expect(resolveEasing("quintOut")).toBe(EASINGS.quintOut);
    expect(resolveEasing("cubicOut")).toMatch(/^cubic-bezier/);
  });

  test("passes CSS timing functions through", () => {
    expect(resolveEasing("ease-in-out")).toBe("ease-in-out");
    expect(resolveEasing("cubic-bezier(1,2,3,4)")).toBe("cubic-bezier(1,2,3,4)");
    expect(resolveEasing("steps(4)")).toBe("steps(4)");
  });

  test("uses fallback when empty", () => {
    expect(resolveEasing(undefined, "linear")).toBe("linear");
    expect(resolveEasing("", "quadOut")).toBe(EASINGS.quadOut);
  });
});

describe("runTransition", () => {
  function makeNode() {
    const node = document.createElement("div");
    document.body.appendChild(node);
    return node;
  }

  test("resolves immediately for non-elements or empty spec", async () => {
    await runTransition(null, { name: "fade", params: {} });
    await runTransition(makeNode(), { name: "", params: {} });
  });

  test("registered transition drives node.animate with WAAPI options", async () => {
    const node = makeNode();
    const calls = [];
    node.animate = (keyframes, opts) => {
      calls.push({ keyframes, opts });
      return { finished: Promise.resolve() };
    };

    let cleaned = false;
    transitions.testWobble = (n, params) => ({
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      duration: params.duration,
      easing: "quintOut",
      cleanup: () => (cleaned = true),
    });

    try {
      await runTransition(node, parseTransition("testWobble, duration=123, delay=7"), "in");
      expect(calls).toHaveLength(1);
      expect(calls[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
      expect(calls[0].opts).toMatchObject({
        duration: 123,
        delay: 7,
        easing: EASINGS.quintOut,
        direction: "normal",
        fill: "backwards",
      });
      expect(cleaned).toBe(true);

      await runTransition(node, parseTransition("testWobble, duration=50"), "out");
      expect(calls[1].opts).toMatchObject({ direction: "reverse", fill: "both" });
    } finally {
      delete transitions.testWobble;
    }
  });

  test("built-ins are registered and produce keyframes", () => {
    const node = makeNode();
    for (const name of ["fade", "fly", "slide", "scale", "pop", "blur", "flip", "rotate", "draw"]) {
      const def = transitions[name](node, {});
      expect(def.keyframes).toHaveLength(2);
      expect(def.duration).toBeGreaterThan(0);
    }
    // slide clips while running and restores overflow on cleanup
    node.style.overflow = "visible";
    const slide = transitions.slide(node, { axis: "x" });
    expect(node.style.overflow).toBe("hidden");
    slide.cleanup();
    expect(node.style.overflow).toBe("visible");
  });

  test("unknown name falls back to CSS @keyframes via style.animation and never hangs", async () => {
    const node = makeNode();
    const start = Date.now();
    const promise = runTransition(node, parseTransition("my-keyframes, duration=30, delay=10"), "out");
    expect(node.style.animation).toContain("my-keyframes");
    expect(node.style.animation).toContain("30ms");
    expect(node.style.animation).toContain("reverse");
    await promise; // resolves via timeout fallback (no animationend in happy-dom)
    expect(Date.now() - start).toBeGreaterThanOrEqual(30);
  });

  test("CSS fallback intro clears inline animation when finished", async () => {
    const node = makeNode();
    await runTransition(node, parseTransition("pop-css, duration=5"), "in");
    expect(node.style.animation).toBe("");
  });
});

describe("extra built-ins", () => {
  function makeNode(tag = "div") {
    const node = document.createElement(tag);
    document.body.appendChild(node);
    return node;
  }

  test("pop / flip / rotate produce transform keyframes with sane defaults", () => {
    const node = makeNode();
    const pop = transitions.pop(node, {});
    expect(pop.keyframes[0].transform).toContain("scale(0.8)");
    expect(pop.easing).toBe(EASINGS.backOut);

    const flip = transitions.flip(node, {});
    expect(flip.keyframes[0].transform).toContain("rotateY(90deg)");
    expect(transitions.flip(node, { axis: "x", angle: 45 }).keyframes[0].transform).toContain("rotateX(45deg)");

    const rot = transitions.rotate(node, { angle: 180 });
    expect(rot.keyframes[0].transform).toContain("rotate(180deg)");
    expect(rot.keyframes[1].transform).toBe("none");
  });

  test("fly from= presets and explicit x/y override", () => {
    const node = makeNode();
    expect(transitions.fly(node, { from: "left" }).keyframes[0].transform).toBe("translate(-40px, 0px)");
    expect(transitions.fly(node, { from: "bottom", distance: 100 }).keyframes[0].transform).toBe(
      "translate(0px, 100px)",
    );
    expect(transitions.fly(node, { from: "top", y: 7 }).keyframes[0].transform).toBe("translate(0px, 7px)");
  });

  test("slide gains opacity only when asked", () => {
    const node = makeNode();
    expect(transitions.slide(node, {}).keyframes[0].opacity).toBeUndefined();
    expect(transitions.slide(node, { opacity: 0 }).keyframes[0].opacity).toBe(0);
  });

  test("draw uses getTotalLength, falls back to fade for non-SVG", () => {
    const node = makeNode();
    expect(transitions.draw(node, {}).keyframes[0]).toEqual({ opacity: 0 });

    node.getTotalLength = () => 200;
    const d = transitions.draw(node, {});
    expect(d.keyframes[0]).toEqual({ strokeDasharray: "200", strokeDashoffset: "200" });
    expect(d.keyframes[1].strokeDashoffset).toBe("0");
    expect(transitions.draw(node, { speed: 2 }).duration).toBe(100);
  });
});

describe("FLIP (fez:animate)", () => {
  test("measureFlip skips leaving / unflagged nodes; playFlip animates only moved nodes", async () => {
    const { measureFlip, playFlip } = await import("../src/fez/lib/transitions.js");
    const mk = (x) => {
      const n = document.createElement("li");
      document.body.appendChild(n);
      n._fezAnimate = { name: "flip", params: { duration: 120 } };
      n.getBoundingClientRect = () => ({ left: x, top: 0 });
      n.animate = (keyframes, opts) => {
        n._calls = (n._calls || 0) + 1;
        n._last = { keyframes, opts };
        return { finished: Promise.resolve(), cancel() {} };
      };
      return n;
    };
    const moved = mk(0);
    const still = mk(50);
    const leaving = mk(100);
    leaving._fezLeaving = true;
    const plain = document.createElement("li");
    document.body.appendChild(plain);

    const entries = measureFlip([moved, still, leaving, plain]);
    expect(entries.map((e) => e.node)).toEqual([moved, still]);

    moved.getBoundingClientRect = () => ({ left: 80, top: 10 });
    playFlip(entries);

    expect(moved._calls).toBe(1);
    expect(moved._last.keyframes[0].transform).toBe("translate(-80px, -10px)");
    expect(moved._last.opts).toMatchObject({ duration: 120, fill: "backwards" });
    expect(still._calls).toBeUndefined();
  });
});

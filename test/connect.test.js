import { describe, test, expect } from "bun:test";

// Simulate connect.js slot replacement logic (mirrors src/fez/connect.js:85-90)
const SELF_CLOSING_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

function closeCustomTags(html) {
  return html.replace(
    /<([a-z-]+)\b([^>]*)\/>/g,
    (match, tagName, attributes) => {
      return SELF_CLOSING_TAGS.has(tagName)
        ? match
        : `<${tagName}${attributes}></${tagName}>`;
    },
  );
}

function processSlot(html) {
  return html
    .replace(
      /<slot(\s[^>]*)?>/,
      `<div class="fez-slot" fez-keep="default-slot"$1>`,
    )
    .replace("</slot>", `</div>`);
}

describe("connect slot handling", () => {
  test("converts self-closing <slot /> to div with fez-slot class and fez-keep", () => {
    let html = "<div>Header</div><slot />";
    html = closeCustomTags(html);
    html = processSlot(html);
    expect(html).toBe(
      '<div>Header</div><div class="fez-slot" fez-keep="default-slot" ></div>',
    );
  });

  test("converts <slot></slot> to div with fez-slot class and fez-keep", () => {
    let html = "<div>Header</div><slot></slot>";
    html = processSlot(html);
    expect(html).toBe(
      '<div>Header</div><div class="fez-slot" fez-keep="default-slot"></div>',
    );
  });

  test("preserves slot attributes", () => {
    let html = '<slot name="content"></slot>';
    html = processSlot(html);
    expect(html).toBe(
      '<div class="fez-slot" fez-keep="default-slot" name="content"></div>',
    );
  });

  test("always uses div tag", () => {
    let html = "<slot></slot>";
    html = processSlot(html);
    expect(html).toBe('<div class="fez-slot" fez-keep="default-slot"></div>');
  });

  test("fez-keep is always default-slot", () => {
    let html = "<slot></slot>";
    html = processSlot(html);
    expect(html).toContain('fez-keep="default-slot"');
    expect(html).toContain("fez-slot");
  });

  test("closeCustomTags converts custom elements", () => {
    const html = '<ui-icon name="star" />';
    expect(closeCustomTags(html)).toBe('<ui-icon name="star" ></ui-icon>');
  });

  test("closeCustomTags preserves self-closing HTML tags", () => {
    const html = '<input type="text" /><br />';
    expect(closeCustomTags(html)).toBe('<input type="text" /><br />');
  });
});

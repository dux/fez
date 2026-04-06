/**
 * Convert self-closing custom tags to full open+close format
 * <my-comp /> -> <my-comp></my-comp>
 * Uses (?:[^>]|=>) to skip => (arrow functions) inside attributes
 * Preserves standard HTML void elements (input, br, img, etc.)
 */

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

export default function closeCustomTags(html) {
  return html.replace(
    /<([a-z][a-z-]*)\b((?:=>|[^>])*)>/g,
    (match, tag, attrs) => {
      if (!attrs.trimEnd().endsWith("/")) return match;
      if (SELF_CLOSING_TAGS.has(tag)) return match;
      return `<${tag}${attrs.replace(/\s*\/$/, "")}></${tag}>`;
    },
  );
}

/**
 * Convert self-closing tags to full open+close format
 * <my-comp /> -> <my-comp></my-comp>
 * Standard HTML void elements (input, br, img, ...) are left as-is.
 * The (?:=>|[^>])* group skips `=>` (arrow functions) inside attributes and the
 * `i` flag covers uppercase custom tags (<My-Comp />).
 */

const SELF_CLOSING_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

export default function closeCustomTags(html) {
  return html.replace(/<([a-z][a-z0-9-]*)\b((?:=>|[^>])*)>/gi, (match, tag, attrs) => {
    if (!attrs.trimEnd().endsWith('/')) {
      return match;
    }
    if (SELF_CLOSING_TAGS.has(tag.toLowerCase())) {
      return match;
    }
    return `<${tag}${attrs.replace(/\s*\/$/, '')}></${tag}>`;
  });
}

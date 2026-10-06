/**
 * Convert self-closing tags to full open+close format
 * <my-comp /> -> <my-comp></my-comp>
 * Standard HTML void elements (input, br, img, ...) are left as-is.
 * The tag end is found past quoted values and {expressions}, so `title="a > b"`
 * or `:on="() => go()"` never cut a tag short.
 */

import { scanTagEnd } from './template-compiler-lib.js';

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
  const tagRe = /<([a-z][a-z0-9-]*)\b/gi;
  let out = '';
  let pos = 0;
  let match;
  while ((match = tagRe.exec(html))) {
    const attrsStart = match.index + match[0].length;
    const end = scanTagEnd(html, attrsStart);
    if (end < 0) {
      break;
    }
    const tag = match[1];
    const attrs = html.slice(attrsStart, end);
    if (attrs.trimEnd().endsWith('/') && !SELF_CLOSING_TAGS.has(tag.toLowerCase())) {
      out += html.slice(pos, match.index) + `<${tag}${attrs.replace(/\s*\/$/, '')}></${tag}>`;
      pos = end + 1;
    }
    tagRe.lastIndex = end + 1;
  }
  return out + html.slice(pos);
}

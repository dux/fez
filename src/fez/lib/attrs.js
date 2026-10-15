// HTML boolean attributes: present means on, whatever the value
export const BOOLEAN_ATTRS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
]);

/**
 * One rendered attribute for `name={expr}`: ` name="value"`, or '' to leave it
 * out. null / undefined always leave it out, false only on a boolean attribute
 * (aria-expanded={false} must still say "false"), true on one renders name="".
 */
export function htmlAttr(name, value, escape) {
  if (value == null) {
    return '';
  }
  if (BOOLEAN_ATTRS.has(name.toLowerCase())) {
    return value === false ? '' : ` ${name}=""`;
  }
  return ` ${name}="${escape(value)}"`;
}

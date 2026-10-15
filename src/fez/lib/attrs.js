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
 * out. null / undefined always leave it out. A boolean attribute follows the
 * value's truthiness (disabled={busy ? 'disabled' : ''} works), any other one
 * keeps false as text (aria-expanded={false} must still say "false").
 */
export function htmlAttr(name, value, escape) {
  if (value == null) {
    return '';
  }
  if (BOOLEAN_ATTRS.has(name.toLowerCase())) {
    return value ? ` ${name}=""` : '';
  }
  return ` ${name}="${escape(value)}"`;
}

// `style:name={value}`: one declaration, or '' when the value is unset
export function styleProp(name, value) {
  return value == null || value === false ? '' : `${name}: ${value};`;
}

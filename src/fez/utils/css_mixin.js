// define custom style macro - simple scss mixin
// :mobile { ... } -> @media (max-width:  768px) { ... }
// @include mobile { ... } -> @media (max-width:  768px) { ... }
// docs/fez/ui-style.fez
//
// A mixin body is any selector or at-rule prelude, so a macro can expand to a
// conditional group (:mobile) or to a selector (:dark). flattenCss resolves
// whichever it gets - at-rules hoist outward, `&` binds to the parent.
//
// The usage site picks the form, not the body: `:card {` opens a block with
// the body as prelude, `:card;` inlines the body as declarations where it
// sits (SCSS @include / Tailwind @apply). A declaration body may carry nested
// rules too - flattenCss parses whatever lands there.
//
// Substitution is textual and needs the trailing space: `:dark {` expands,
// `:dark{` does not.

const CssMixins = {};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `:name;` / `@include name;` at declaration position only - the lead guard
// keeps `pointer-events:none;` intact when a mixin named `none` exists
const declRe = (key) => new RegExp(`(^|[\\s{;])(?::|@include\\s+)${escapeRe(key)}\\s*;`, 'g');

// `:name {` / `@include name {` at block position only - the lead guard keeps a
// same-named pseudo-class or property value from being rewritten.
const blockRe = (key) =>
  new RegExp(`(^|[\\s{;])(?::|@include\\s+)${escapeRe(key)}(?=\\s+\\{)`, 'g');

export default (Fez) => {
  Fez.cssMixin = (name, content) => {
    // Two-arg form registers; one-arg form expands. `content !== undefined`
    // (not truthiness) so an empty body can be registered.
    if (content !== undefined) {
      CssMixins[name] = content;
      return;
    }

    Object.entries(CssMixins).forEach(([key, val]) => {
      name = name.replace(declRe(key), (_, lead) => `${lead}${val.replace(/;\s*$/, '')};`);
      name = name.replace(blockRe(key), (_, lead) => `${lead}${val}`);
    });

    return name;
  };

  Fez.cssMixin('mobile', '@media (max-width: 767px)');
  Fez.cssMixin('tablet', '@media (min-width: 768px) and (max-width: 1023px)');
  Fez.cssMixin('desktop', '@media (min-width:  1200px)');

  // Dark theme, driven by a .dark class on <html>. Selector-shaped rather than
  // a media query so the app can flip themes at runtime; register
  // '@media (prefers-color-scheme: dark)' at boot to follow the OS instead.
  //
  // Two branches: `.dark` for the element carrying the class (a :root token
  // block), `.dark *` for everything under it. :where() contributes no
  // specificity, so :dark ties with the rule it overrides and wins on source
  // order alone - nested blocks always serialize after their parent's
  // declarations. Without it every dark rule would outrank plain ones.
  Fez.cssMixin('dark', '&:where(.dark, .dark *)');
};

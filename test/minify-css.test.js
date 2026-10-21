import { describe, test, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { Glob } from 'bun';
import minifyCss from '../src/fez/lib/minify-css.js';
import cssMixin from '../src/fez/utils/css_mixin.js';
import flattenCss from '../src/fez/utils/flatten_css.js';
import { extractFezDefinitions, parseFezSource } from '../src/fez/lib/source-parser.js';
import { compileFileToModule } from '../src/fez/compile-module.js';

const Fez = {};
cssMixin(Fez);
Fez.cssMixin('card', 'padding: 4px; border: 1px solid');

// what Fez.globalCss serves for a scoped block (wrapped) or a global one
const served = (css, wrap) => flattenCss(Fez.cssMixin(wrap ? `:fez { ${css} }` : css));

// formatting-only differences: whitespace runs, and whitespace next to `{ } ; ,` or after `:`
// (a space before `:` is a descendant combinator, so it stays significant)
const norm = (css) =>
  css
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/;}/g, '}')
    .trim();

describe('minifyCss', () => {
  test('drops comments and needless whitespace', () => {
    const css = `
      /* card */
      .a  .b ,  .c > .d {
        color :  red ;
        margin: 0  auto;
      }
    `;
    expect(minifyCss(css)).toBe('.a .b,.c > .d{color :red;margin:0 auto}');
  });

  test('keeps strings and url() verbatim', () => {
    const css = `.a::before { content: "  {a;b}  /* x */ "; background: url( img/a b.png ); }`;
    expect(minifyCss(css)).toBe(
      `.a::before{content:"  {a;b}  /* x */ ";background:url( img/a b.png )}`,
    );
    expect(minifyCss(`.a { font-family: 'Open  Sans', serif; }`)).toBe(
      `.a{font-family:'Open  Sans',serif}`,
    );
  });

  test('keeps descendant combinators before pseudo selectors and escapes', () => {
    // `:name {` keeps its space whatever the name: a macro may be registered under it
    expect(minifyCss('.a :hover { x: 1 }')).toBe('.a :hover {x:1}');
    expect(minifyCss('.w-1\\/2  .b { x: 1 }')).toBe('.w-1\\/2 .b{x:1}');
  });

  test('keeps nesting, & selectors and at-rules', () => {
    const css = `
      .a {
        &:hover { color: red; }
        & + & { margin: 0; }
        @media (max-width: 600px) {
          .b { width: calc(100% - 2px); }
        }
      }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
    expect(minifyCss(css)).toBe(
      '.a{&:hover{color:red}& + &{margin:0}@media (max-width:600px){.b{width:calc(100% - 2px)}}}' +
        '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
    );
  });

  test('keeps the shape style macros need', () => {
    expect(minifyCss('h1 {\n  :mobile {\n    font-size: 12px;\n  }\n}')).toBe(
      'h1{:mobile {font-size:12px}}',
    );
    expect(minifyCss('.a { color: red; }\n:dark {\n  color: blue;\n}')).toBe(
      '.a{color:red} :dark {color:blue}',
    );
    expect(minifyCss('.a, :dark { x: 1 }')).toBe('.a, :dark {x:1}');
    expect(minifyCss('.a { :card; }')).toBe('.a{:card;}');
    expect(minifyCss('.a { @include mobile { x: 1; } }')).toBe('.a{@include mobile {x:1}}');
  });

  test('serves the same rules after macros and flattening', () => {
    const css = `
      h1 { :mobile { font-size: 12px; } }
      .a { color: red; :card; }
      :dark { color: blue; }
      .b, :dark { .c { x: 1; } }
      .d { &:hover { :tablet { y: 2; } } }
    `;
    expect(norm(served(minifyCss(css), true))).toBe(norm(served(css, true)));
    expect(norm(served(minifyCss(css), false))).toBe(norm(served(css, false)));
  });

  test('serves the same rules for every component style in the repo', () => {
    const root = path.join(import.meta.dir, '..');
    let blocks = 0;
    const files = ['pages_src', 'test/fixtures', 'src'].flatMap((dir) => [
      ...new Glob(`${dir}/**/*.fez`).scanSync(root),
    ]);
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      const { definitions } = extractFezDefinitions(source);
      const units = definitions.length ? definitions.map((d) => d.source) : [source];
      for (const unit of units) {
        const parts = parseFezSource(unit);
        for (const [css, wrap] of [
          [parts.style, true],
          [parts.styleGlobal, false],
        ]) {
          if (!css?.trim()) {
            continue;
          }
          blocks++;
          expect(norm(served(minifyCss(css), wrap))).toBe(norm(served(css, wrap)));
        }
      }
    }
    expect(blocks).toBeGreaterThan(10);
  });

  test('compileFileToModule minifies CSS only with minify', () => {
    const source = '<style>\n  .a {\n    color: red;\n  }\n</style>\n<div class="a"></div>';
    const plain = compileFileToModule('ui-test.fez', source);
    const minified = compileFileToModule('ui-test.fez', source, { minify: true });
    expect(plain).toContain('color: red;');
    expect(minified).toContain('.a{color:red}');
  });
});

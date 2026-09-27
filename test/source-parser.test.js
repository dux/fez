import { describe, expect, test } from 'bun:test';
import {
  extractFezDefinitions,
  formatSourceError,
  hasFezDefinitions,
  parseFezSource,
  stripFezDefinitions,
  stripGeneratedNotice,
} from '../src/fez/lib/source-parser.js';

describe('Fez source parser', () => {
  test('removes generated source notices from template HTML', () => {
    const parsed =
      parseFezSource(`<!-- generated from src: web_src/root/fez/ui-label.fez | DO NOT EDIT OR READ THIS FILE -->
<script>
  NAME = 'span'
</script>`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.script).toContain("NAME = 'span'");
    expect(parsed.html.trim()).toBe('');
    expect(parseFezSource('<!-- authored comment -->').html).toBe('<!-- authored comment -->');
  });

  test('stripGeneratedNotice handles the HTML and JS notice forms', () => {
    const html = '<!-- generated from src: web_src/root/fez/a.fez | DO NOT EDIT OR READ THIS FILE -->\n<p>a</p>';
    const js = '// generated from src: web_src/root/app.js | DO NOT EDIT OR READ THIS FILE\nlet a = 1';

    expect(stripGeneratedNotice(html)).toBe('<p>a</p>');
    expect(stripGeneratedNotice(js)).toBe('let a = 1');
    expect(stripGeneratedNotice('// authored\nlet a = 1')).toBe('// authored\nlet a = 1');
  });

  test('preserves normal header elements in template HTML', () => {
    const parsed = parseFezSource(`<header>
  <p>{state.title}</p>
</header>`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.html).toContain('<header>');
    expect(parsed.html).toContain('{state.title}');
  });

  test('extracts inline source blocks', () => {
    const parsed = parseFezSource(`<script>class { init() {} }</script>
<style>color: red;</style>
<p>Hello</p>`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.script).toBe('class { init() {} }');
    expect(parsed.style).toBe('color: red;');
    expect(parsed.html).toContain('<p>Hello</p>');
  });

  test('a single-line <info> or <demo> does not swallow the rest of the file', () => {
    // The old line scanner opened <info> on one line and only closed it on a
    // later line, so `<info>x</info>` ate the script, template and style that
    // followed - the component mounted as an empty class with no error.
    const parsed = parseFezSource(`<info>Hero block</info>
<demo><block-hero title="Hi" /></demo>
<script>
  class { init() {} }
</script>
<h1>{props.title}</h1>
<style>h1 { color: red; }</style>`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.info.trim()).toBe('Hero block');
    expect(parsed.demo.trim()).toBe('<block-hero title="Hi" />');
    expect(parsed.script).toContain('init() {}');
    expect(parsed.style).toBe('h1 { color: red; }');
    expect(parsed.html).toContain('<h1>{props.title}</h1>');
  });

  test('reports unclosed source blocks at their source line', () => {
    const parsed = parseFezSource(`<p>Hello</p>
<script>
  class {`);

    expect(parsed.errors).toEqual([
      { kind: 'Source', message: 'Unclosed <script> block', line: 2 },
    ]);
  });

  test('extracts top-level component definitions but ignores demos', () => {
    const source = `<demo>
  <xmp fez="demo-only"></xmp>
</demo>
<xmp fez="real-one"><p>One</p></xmp>
<template fez="real-two"><p>Two</p></template>`;
    const extracted = extractFezDefinitions(source);

    expect(extracted.errors).toEqual([]);
    expect(extracted.definitions.map(({ name }) => name)).toEqual(['real-one', 'real-two']);
    expect(hasFezDefinitions(source)).toBe(true);
  });

  test('finds definitions that share a line with surrounding markup', () => {
    expect(hasFezDefinitions('<div><template fez="inline-one"><p>One</p></template></div>')).toBe(
      true,
    );
  });

  test('strips definitions so a multi-component file keeps only its file-level docs', () => {
    const source = `<info>
  File level docs.
</info>
<xmp fez="one-block">
  <script>
    class {}
  </script>
</xmp>
<xmp fez="two-block">
  <script>
    class {}
  </script>
</xmp>`;
    const parsed = parseFezSource(stripFezDefinitions(source), { dedentDocs: true });

    expect(parsed.errors).toEqual([]);
    expect(parsed.info.trim()).toBe('File level docs.');
    expect(parsed.script).toBe('');
  });

  test('leaves a single-component file untouched', () => {
    const source = '<script>\nclass {}\n</script>\n<p>Hello</p>';

    expect(stripFezDefinitions(source)).toBe(source);
  });

  test('a <slim> block becomes the template', () => {
    const parsed = parseFezSource(`<script>
  class {}
</script>

<slim>
  div.p-2
    p= state.name
</slim>`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.html).toBe('<div class="p-2"><p>{state.name}</p></div>');
    expect(parsed.template.lang).toBe('slim');
    expect(parsed.template.map).toEqual([
      [0, 6],
      [17, 7],
      [36, 6],
    ]);
  });

  test('slim errors point at the file line and column', () => {
    const parsed = parseFezSource('<script>\nclass {}\n</script>\n<slim>\n  div\n    - end\n</slim>');

    expect(parsed.errors).toEqual([
      {
        kind: 'Slim',
        message: '`- end` is not needed - nesting comes from indentation',
        line: 6,
        column: 5,
      },
    ]);
    expect(formatSourceError(parsed.errors[0])).toBe(
      '<slim> line 6:5: `- end` is not needed - nesting comes from indentation',
    );
  });

  test('a <slim> block next to an HTML template is an error', () => {
    const parsed = parseFezSource('<slim>\n  p a\n</slim>\n<p>b</p>');

    expect(parsed.errors[0].message).toContain('both present');
  });

  test('a template whose first line reads as Slim is Slim without a <slim> block', () => {
    const parsed = parseFezSource('<script>\n  class {}\n</script>\n\nform: input name="q" required=""\nul\n  - end\n');

    expect(parsed.template.lang).toBe('slim');
    expect(parsed.html).toBe('<form><input name="q" required=""></form><ul></ul>');
    expect(parsed.errors).toEqual([
      {
        kind: 'Slim',
        message: '`- end` is not needed - nesting comes from indentation',
        line: 7,
        column: 3,
      },
    ]);
  });

  test.each([
    ['.card', '<div class="card"></div>'],
    ['#app.p-2', '<div id="app" class="p-2"></div>'],
    ['div', '<div></div>'],
    ['a href="/" Home', '<a href="/">Home</a>'],
    ['h1= props.title', '<h1>{props.title}</h1>'],
    ['ul: li x', '<ul><li>x</li></ul>'],
    ['ui-icon name="star"', '<ui-icon name="star"></ui-icon>'],
    ['- if state.on\n  p on', '{#if state.on}<p>on</p>{/if}'],
    ['- state.items.each do |item|\n  li= item', '{#each state.items as item}<li>{item}</li>{/each}'],
    ['= state.name', '{state.name}'],
  ])('detects Slim from %j', (source, html) => {
    const parsed = parseFezSource(source);
    expect(parsed.template.lang).toBe('slim');
    expect(parsed.html).toBe(html);
  });

  test.each([
    '<div>\n  <p>x</p>\n</div>',
    '{#if x}<b>x</b>{/if}',
    'Loading...',
    'a new item',
    'time left: {state.t}',
    '- first item',
    'Hello {props.name}',
    '<!-- note -->\ndiv',
  ])('keeps %j as HTML', (source) => {
    expect(parseFezSource(source).template.lang).toBe('html');
  });

  test('HTML templates report lang html', () => {
    expect(parseFezSource('<p>a</p>').template).toEqual({ lang: 'html', map: null });
  });
});

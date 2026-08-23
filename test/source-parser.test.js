import { describe, expect, test } from 'bun:test';
import {
  extractFezDefinitions,
  hasFezDefinitions,
  parseFezSource,
} from '../src/fez/lib/source-parser.js';

describe('Fez source parser', () => {
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
});

import { describe, expect, test } from 'bun:test';
import { locateSlimError, slimToFez } from '../src/fez/lib/slim.js';

const slim = (source) => {
  const result = slimToFez(source);
  expect(result.errors).toEqual([]);
  return result.html;
};

const errorsOf = (source) => slimToFez(source).errors;

describe('slim elements', () => {
  test('tags nest by indentation with no whitespace between nodes', () => {
    expect(slim('ul\n  li one\n  li two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  test('class and id shorthand, bare shorthand is a div', () => {
    expect(slim('section.a.b#main')).toBe('<section id="main" class="a b"></section>');
    expect(slim('.card')).toBe('<div class="card"></div>');
    expect(slim('#app.p-4')).toBe('<div id="app" class="p-4"></div>');
  });

  test('void elements self-close, custom elements get a close tag', () => {
    expect(slim('img src="/a.png"')).toBe('<img src="/a.png">');
    expect(slim('ui-icon name="star"')).toBe('<ui-icon name="star"></ui-icon>');
  });

  test('raw HTML lines and comments', () => {
    expect(slim('div\n  <b>raw</b>\n  / hidden\n    p gone\n  p kept')).toBe('<div><b>raw</b><p>kept</p></div>');
  });
});

describe('slim Tailwind class shorthand', () => {
  const classes = (token) => slim(`div${token}`).match(/class="([^"]*)"/)[1];

  test.each([
    ['.p-0.5.gap-1.5', 'p-0.5 gap-1.5'],
    ['.bg-black/2.5', 'bg-black/2.5'],
    ['.p-2.2xl:flex', 'p-2 2xl:flex'],
    ['.w-1/2.hover:bg-red-500/50', 'w-1/2 hover:bg-red-500/50'],
    ['.!mt-0.mt-0!', '!mt-0 mt-0!'],
    ['.bg-[#fff].p-2', 'bg-[#fff] p-2'],
    ['.data-[state=open]:block', 'data-[state=open]:block'],
    ['.w-[calc(100%-2rem)]', 'w-[calc(100%-2rem)]'],
    ['.[&>svg]:w-4.*:p-2.@lg:flex', '[&>svg]:w-4 *:p-2 @lg:flex'],
    ['.bg-(--brand)', 'bg-(--brand)'],
    ['.text-[1.5rem]', 'text-[1.5rem]'],
    ['.content-["x"]', 'content-[&quot;x&quot;]'],
  ])('%s', (token, expected) => {
    expect(classes(token)).toBe(expected);
  });

  test('# after a class starts the id at top level only', () => {
    expect(slim('div.bg-[#111]#main')).toBe('<div id="main" class="bg-[#111]"></div>');
  });

  test('unclosed bracket is an error', () => {
    expect(errorsOf('div.bg-[#fff')[0].message).toContain('Unclosed');
  });
});

describe('slim attributes and inline content', () => {
  test('quoted, expression and bare values', () => {
    expect(slim(`a href="/x" title='t' data-n=3 :item={state.item} Go`)).toBe(
      `<a href="/x" title='t' data-n="3" :item={state.item}>Go</a>`,
    );
  });

  test('expression values may contain spaces and braces', () => {
    expect(slim(`div style={state.on ? 'a b' : '{c}'}`)).toBe(`<div style={state.on ? 'a b' : '{c}'}></div>`);
  });

  test('Fez attributes pass through', () => {
    expect(slim('input fez:this="name" onclick!="fez.go()" class:on={state.on} checked=""')).toBe(
      '<input fez:this="name" onclick!="fez.go()" class:on={state.on} checked="">',
    );
  });

  test('shorthand classes merge with a class attribute', () => {
    expect(slim('div.p-2 class={state.x}')).toBe('<div class="p-2 {state.x}"></div>');
    expect(slim('div.p-2 class="m-1"')).toBe('<div class="p-2 m-1"></div>');
  });

  test('first token without = starts the text', () => {
    expect(slim('p.text-sm No items')).toBe('<p class="text-sm">No items</p>');
    expect(slim('p Set foo="bar" here')).toBe('<p>Set foo="bar" here</p>');
  });

  test('inline | forces text', () => {
    expect(slim('p | foo="bar"')).toBe('<p>foo="bar"</p>');
  });

  test('= and == output, stuck or spaced', () => {
    expect(slim('h3.text-lg= props.title')).toBe('<h3 class="text-lg">{props.title}</h3>');
    expect(slim('h3.text-lg = props.title')).toBe('<h3 class="text-lg">{props.title}</h3>');
    expect(slim('div.prose== state.body')).toBe('<div class="prose">{@html state.body}</div>');
    expect(slim('a href="/x"= props.label')).toBe('<a href="/x">{props.label}</a>');
    expect(slim('a href="/x" = props.label')).toBe('<a href="/x">{props.label}</a>');
  });

  test('= stuck to a bare value stays part of the value', () => {
    expect(slim('input type=button=x')).toBe('<input type="button=x">');
  });

  test('a trailing \\ continues the line', () => {
    expect(slim('button type="button" \\\n    onclick="fez.go()" \\\n    Go')).toBe(
      '<button type="button" onclick="fez.go()">Go</button>',
    );
  });

  test('tag: child nests the rest of the line', () => {
    expect(slim('form: input name="tag" required=""')).toBe('<form><input name="tag" required=""></form>');
    expect(slim('ul.flex.md:gap-2: li: a href="/" Home')).toBe(
      '<ul class="flex md:gap-2"><li><a href="/">Home</a></li></ul>',
    );
    expect(slim('li: a href="/"\n  b x')).toBe('<li><a href="/"><b>x</b></a></li>');
    expect(slim('div.hover:underline')).toBe('<div class="hover:underline"></div>');
    expect(errorsOf('img: b')[0].message).toContain('void element');
  });

  test('inline content and children together', () => {
    expect(slim('p Hello\n  b world')).toBe('<p>Hello<b>world</b></p>');
  });
});

describe('slim text and output lines', () => {
  test('| lines, {expr} lines and #{} interpolation', () => {
    expect(slim('p\n  | Hi #{props.name}\n  {state.x}')).toBe('<p>Hi {props.name} {state.x}</p>');
  });

  test('adjacent text lines join with a space, nested text continues', () => {
    expect(slim('p\n  | one\n  | two\n    three')).toBe('<p>one two three</p>');
  });

  test('= and == lines', () => {
    expect(slim('div\n  = state.a\n  == state.b')).toBe('<div>{state.a}{@html state.b}</div>');
  });

  test('#{} in attribute values', () => {
    expect(slim('a href="/u/#{item.id}" x')).toBe('<a href="/u/{item.id}">x</a>');
  });
});

describe('slim control flow', () => {
  test('if / else if / elsif / else', () => {
    expect(slim('- if a\n  p a\n- else if b\n  p b\n- elsif c\n  p c\n- else\n  p d')).toBe(
      '{#if a}<p>a</p>{:else if b}<p>b</p>{:else if c}<p>c</p>{:else}<p>d</p>{/if}',
    );
  });

  test('unless, each with else, for', () => {
    expect(slim('- unless x\n  p no')).toBe('{#unless x}<p>no</p>{/unless}');
    expect(slim('- each list as item, i\n  li= item\n- else\n  li empty')).toBe(
      '{#each list as item, i}<li>{item}</li>{:else}<li>empty</li>{/each}',
    );
    expect(slim('- for key, val in obj\n  b= key')).toBe('{#for key, val in obj}<b>{key}</b>{/for}');
  });

  test('await / then / catch', () => {
    expect(slim('- await state.user\n  p loading\n- then user\n  p= user.name\n- catch err\n  p= err.message')).toBe(
      '{#await state.user}<p>loading</p>{:then user}<p>{user.name}</p>{:catch err}<p>{err.message}</p>{/await}',
    );
  });

  test('a block closes on a non-continuation sibling', () => {
    expect(slim('- if a\n  p a\np b')).toBe('{#if a}<p>a</p>{/if}<p>b</p>');
  });

  test('Ruby each aliases', () => {
    expect(slim('- state.items.each do |item|\n  li= item')).toBe('{#each state.items as item}<li>{item}</li>{/each}');
    expect(slim('- list.each_with_index do |item, i|\n  li= i')).toBe('{#each list as item, i}<li>{i}</li>{/each}');
    expect(slim('- obj.each do |k, v|\n  b= k')).toBe('{#each obj as k, v}<b>{k}</b>{/each}');
  });
});

describe('slim errors', () => {
  test('carry line and column', () => {
    expect(errorsOf('div\n  p ok\n  - end')).toEqual([
      { message: '`- end` is not needed - nesting comes from indentation', line: 3, column: 3 },
    ]);
  });

  test.each([
    ['div\n    p\n  p', 'Inconsistent indentation'],
    ['div\n  p\n\tp', 'Mixed tabs and spaces'],
    ['- else\n  p', 'without a matching opener'],
    ['- then x', 'without a matching opener'],
    ['- list.map do |x|', 'use `- each list as item`'],
    ['- list.each { |x| x }', 'use `- each list as item`'],
    ['- x = 1', 'Unknown `- x`'],
    ['- each list', 'missing " as "'],
    ['- for item list', 'missing " in "'],
    ['- if', 'needs an expression'],
    ['img src="a" x', 'void element'],
    ['Hello world', 'Unknown tag `Hello`'],
    ['1 item', 'start text lines with `| `'],
    ['div.', 'Empty class'],
    ['a href="x', 'Unclosed "'],
    ['div\n  = x\n    p', 'cannot have children'],
  ])('%j', (source, message) => {
    expect(errorsOf(source)[0].message).toContain(message);
  });
});

describe('slim dump and error locator', () => {
  test('pretty dump prints one node per line with source lines', () => {
    const { html } = slimToFez('div\n  - if a\n    p= a', { pretty: true, lineOffset: 10 });
    expect(html).toBe(
      ['  11 | <div>', '  12 |   {#if a}', '  13 |     <p>{a}</p>', '     |   {/if}', '     | </div>'].join('\n'),
    );
  });

  test('locateSlimError maps the first invalid expression to its line', () => {
    const { html, map } = slimToFez('div\n  p= ok\n  - if a\n    span= foo(\n  p x');
    expect(locateSlimError(html, map)).toBe(4);
  });

  test('locateSlimError returns null when every expression parses', () => {
    const { html, map } = slimToFez('- each list as item\n  p= item.name');
    expect(locateSlimError(html, map)).toBeNull();
  });
});

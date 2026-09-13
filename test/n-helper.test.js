import { test, expect, beforeAll, afterAll } from 'bun:test';
import { Window } from 'happy-dom';
import n from '../src/fez/lib/n.js';

let saved;

beforeAll(() => {
  saved = { window: global.window, document: global.document, Node: global.Node };
  const win = new Window();
  global.window = win;
  global.document = win.document;
  global.Node = win.Node;
});

afterAll(() => {
  global.window = saved.window;
  global.document = saved.document;
  global.Node = saved.Node;
});

test('does not mutate caller attrs when merging a class shorthand', () => {
  const attrs = { id: 'x' };
  n('.foo.bar', attrs);
  expect(attrs).toEqual({ id: 'x' });
});

test('is callable without a component context and leaves fez. strings alone', () => {
  const node = n('div', { title: 't', 'data-handler': 'fez.go()' });
  expect(node.getAttribute('data-handler')).toBe('fez.go()');
});

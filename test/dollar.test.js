import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { Window } from 'happy-dom';
import { $ } from '../src/fez/lib/dollar.js';
import attachDollar from '../src/fez/lib/dollar.js';
import utility from '../src/fez/lib/utility.js';
import { installMockXHR } from './mock-xhr.js';

const KEYS = ['window', 'document', 'getComputedStyle', 'CustomEvent', 'FormData'];
const saved = {};

beforeAll(() => {
  for (const k of KEYS) saved[k] = globalThis[k];
  const win = new Window({ url: 'http://localhost/' });
  globalThis.window = win;
  globalThis.document = win.document;
  globalThis.getComputedStyle = win.getComputedStyle.bind(win);
  globalThis.CustomEvent = win.CustomEvent;
  globalThis.FormData = win.FormData;
});

afterAll(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete globalThis[k];
    else globalThis[k] = saved[k];
  }
});

beforeEach(() => {
  document.body.innerHTML = `
    <ul id="list"><li class="a">one</li><li class="b">two</li></ul>
    <p id="hidden" class="gone">hi</p>
    <style>.gone { display: none }</style>`;
});

describe('Fez.$ DOM', () => {
  test('selects, traverses and edits', () => {
    const items = $('#list li');
    expect(items).toHaveLength(2);
    expect(items.last().text()).toBe('two');
    expect($('#list').find('.b').closest('ul').attr('id')).toBe('list');
    expect(items.first().siblings().text()).toBe('two');
    expect(items.filter('.a').next().hasClass('b')).toBe(true);

    $('<li class="c">three</li>').appendTo('#list');
    $('#list').prepend('<li class="z">zero</li>');
    expect($('#list li').map((_, e) => e.className).get()).toEqual(['z', 'a', 'b', 'c']);

    $('#list .a').addClass('x y').removeClass('a').attr({ 'data-n': '1' });
    expect($('.x').data('n')).toBe('1');
    $('.x').remove();
    expect($('#list li')).toHaveLength(3);
  });

  test('show() overrides a stylesheet display:none, hide/toggle flip it', () => {
    const p = $('#hidden');
    p.show();
    expect(getComputedStyle(p[0]).display).not.toBe('none');
    p.toggle();
    expect(p[0].style.display).toBe('none');
  });

  test('on() keeps one handler per key, so re-registering replaces it', () => {
    let calls = 0;
    const bind = () => $(document).on('click', '#list li', () => calls++);
    bind();
    bind();
    $('#list .a')[0].click();
    expect(calls).toBe(1);

    let named = 0;
    $(document).on('click.menu', () => named++);
    $(document).on('click.menu', () => (named += 10));
    $('#list .b')[0].click();
    expect(named).toBe(10);

    $(document).off('.menu');
    $(document).off('click');
    $('#list .b')[0].click();
    expect(named).toBe(10);
    expect(calls).toBe(2);
  });

  test('one() fires once, delegated handlers get the matched node as this', () => {
    const seen = [];
    $('#list').one('click', 'li', function () {
      seen.push(this.className);
    });
    $('#list .b')[0].click();
    $('#list .a')[0].click();
    expect(seen).toEqual(['b']);
  });
});

describe('Fez.$ ajax proxies', () => {
  let net;
  let Fez;

  beforeEach(() => {
    net = installMockXHR();
    Fez = { consoleLog: () => {}, onError: () => {} };
    utility(Fez);
    attachDollar(Fez);
  });

  afterEach(() => net.restore());

  test('$.post encodes nested data and calls done with parsed data', async () => {
    let got;
    const req = Fez.$.post('/api/sort', { refs: ['a', 'b'] }).done((data) => (got = data));
    expect(decodeURIComponent(net.requests[0].body)).toBe('refs[]=a&refs[]=b');
    net.requests[0].respond(200, '{"ok":true}', { 'content-type': 'application/json' });
    await req;
    expect(got).toEqual({ ok: true });
    expect(typeof req.abort).toBe('function');
  });

  test('$.ajax maps success, error and complete', async () => {
    const log = [];
    const req = Fez.$.ajax({
      type: 'POST',
      url: '/api/x',
      data: { a: 1 },
      success: () => log.push('success'),
      error: (res) => log.push(`error ${res.status}`),
      complete: () => log.push('complete'),
    });
    net.requests[0].respond(500, 'boom');
    await req;
    expect(log).toEqual(['error 500', 'complete']);
  });

  test('done attached after the response still runs', async () => {
    const req = Fez.$.get('/late');
    net.requests[0].respond(200, 'x');
    await req;
    let got;
    req.done((data) => (got = data));
    await req;
    await Promise.resolve();
    expect(got).toBe('x');
  });
});

// Exposes node building method, that gets node name, attrs and body.
// n('span', {id: id}), n('.foo', {id: id}, body), n('.foo', {id: id}, [...])
// * you can switch places for attrs and body, and body can be list of nodes
// * n('.foo.bar') -> n('div', { class: 'foo bar' })
//
// copyright @dux, 2024
// Licence MIT

export default function n(name, attrs = {}, data) {
  if (typeof attrs === 'string') {
    [attrs, data] = [data, attrs]
    attrs ||= {}
  }

  if (attrs instanceof Node) {
    data = attrs
    attrs = {}
  }

  if (Array.isArray(name)) {
    data = name
    name = 'div'
  }

  if (typeof attrs !== 'object' || Array.isArray(attrs)) {
    data = attrs
    attrs = {}
  }

  if (name.includes('.')) {
    const parts = name.split('.')
    name = parts.shift() || 'div'
    const c = parts.join(' ');
    if (attrs.class) {
      attrs.class += ` ${c}`;
    } else {
      attrs.class = c
    }
  }

  const node = document.createElement(name);

  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') {
      node[k] = v.bind(this)
    } else {
      const value = String(v).replaceAll('fez.', this.fezHtmlRoot);
      node.setAttribute(k, value)
    }
  }

  if (data) {
    if (Array.isArray(data)) {
      for (const n of data) {
        node.appendChild(n)
      }
    } else if (data instanceof Node) {
      node.appendChild(data)
    } else {
      node.innerHTML = String(data)
    }
  }

  return node
}

import renderStache from "../src/lib/stache.js"

function upCase(str) { return str.toUpperCase()}

const tpl = `
<ul id="1">
  {{each @list1 as l1, index}}
    <li>{{l1}}</li>
  {{/each}}
</ul>
<foo-bar baz="123" />
<input />
<foo-bar/>
<ul id="2">
  {{each this.list2 as el, index}}
    <li>{{el.name}}</li>
  {{/each}}
</ul>
<div />
<ul id="3">
  {{each @list3 as el, index}}
    <li>{{el[0]}} - {{@upCase(el[1].name)}}</li>
  {{/each}}
</ul>
<ul id="4">
  {{each @list4 as el, index}}
    <li>{{el[0]}}</li>
  {{/each}}
</ul>
<ul id="5">
  {{each @data.list as el, index}}
    <li>{{el}} - {{index}}</li>
  {{/each}}
</ul>
`

class Foo {
  call () {
    this.upCase = upCase,
    this.list1 = ['foo', 'bar', 'baz'],
    this.list2 = [{name: 'Miki'}, {name: 'Riki'}]
    this.list3 = {
      foo3: {name: 'foo'},
      bar3: {name: 'bar'}
    },
    this.list4 = [
      ['foo', 123],
      ['bar', 456],
    ],
    this.data = {
      list: [111, 222, 333]
    }

    const out = renderStache(tpl, this)
    console.log(out)
  }
}

console.log(`--- START ${Math.random()}`);

(new Foo).call();

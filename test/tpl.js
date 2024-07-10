import parseTpl from '../src/lib/tpl.js'

const tpl = `
  <div class="flex vcenter">
    {{if @opts.user}}
      <ui-btn class="btn-empty btn-lg desktop-show" onclick="$$.showLinks(this)">
        stranice &darr;
      </ui-btn>

      {{if true}}
        TRUE
      {{/if}}
    {{ else }}
      no user
      {{for link, index in @opts.links}}
        <ui-a class="link desktop-show" href="{{link[0]}}" class="link desktop-show">
          {{link[1]}}
          - {{index}}
        </ui-a>
      {{/for}}
    {{/if}}
  </div>
`

class Foo {
  call () {
    this.opts = {
      user: false,
      links: [
        ['/a', 'A path'],
        ['/b', 'A path']
      ]
    }

    const out = parseTpl(tpl, this)
    console.log(out)
  }
}

console.log(`--- START ${Math.random()}`);

(new Foo).call();



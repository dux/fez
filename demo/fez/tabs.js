Fez('ui-tabs', class extends FezBase {
  static css = `
    --tabs-border: 1px solid #ccc;

    .header {
      margin-bottom: -2px;
      position: relative;
      z-index: 1;

      & > span {
        border: var(--tabs-border);
        padding: 8px 15px;
        display: inline-block;
        border-radius: 8px 8px 0 0;
        margin-right: -1px;
        background: #eee;
        cursor: pointer;

        &.active {
          background-color: #fff;
          border-bottom: none;
        }
      }
    }

    .body {
      border: var(--tabs-border);
      padding: 8px 15px;
      background: #fff;

      & > div {
        display: none;

        &.active {
          display: block;
        }
      }
    }
  `;

  activateNode(node) {
    node.parent().find('> *').removeClass('active')
    node.addClass('active')
  }

  activate(num) {
    this.active = parseInt(num)
    const target = this.$root.find(`> div > div.header > span.tab-title-${num}`)
    this.activateNode(target)
    this.activateNode(this.tabs[num])
  }

  connect(props) {
    this.tabs = this.childNodes().map(n => $(n));

    this.html([
      this.n('div.header', this.tabs.map((tab, index) =>
        this.n(`span.tab-title-${index}`, tab.attr('title'), { onclick: `$$.activate(${index})` })
      )),
      this.n('.body', '<slot />')
    ]);

    this.activate(0)
  }
})


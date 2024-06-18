// render form
Fez('ui-mform', class extends FezBase {
  static nodeName = 'form'

  static css = `
    border: 2px solid teal;
    border-radius: 5px;
    padding: 15px;
    margin: 15px 0;

    table {
      margin: 20px 0;
    }

    input {
      padding: 3px 10px;
    }

    .btn {
      padding: 5px 10px;
      background: #ccc;
      cursor: pointer;
    }
  `

  submit(e) {
    e.preventDefault()
    alert(JSON.stringify(this.formData()))
  }

  connect() {
    this.root.onsubmit = this.submit

    this.addRow()
    this.addRow()
    this.render()
  }

  getData() {
    alert(JSON.stringify(this.list, null, 2))
  }

  addRow() {
    this.list ||= []

    const data = {name: '', sname: ''}
    data.num = this.list.length

    this.list.push(data)
    this.render()
  }

  render() {
    this.html(`
      <table>
        {{#list}}
          <tr>
            <td>
              <input type="text" onkeyup="$$.list[{{num}}].name = this.value" value="{{ name }}" class="i1" />
            </td>
            <td>
              <input type="text" onkeyup="$$.list[{{num}}].sname = this.value" value="{{ sname }}" class="i2" />
            </td>
          </tr>
        {{/list}}
      </table>
      <span class="btn" onclick="$$.addRow()">add row</span>
      <span class="btn" onclick="$$.getData()">read</span>
    `)
  }
})

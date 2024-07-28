// render form
Fez('ui-form', class {
  NAME = 'form'

  css = `
    border: 2px solid green;
    border-radius: 5px;
    padding: 15px;
    margin: 15px 0;

    label {
      display: block;
      cursor: pointer;
      margin-bottom: 5px;
    }

    select option {
      font-size: 16px;
    }
  `

  submit(e) {
    e.preventDefault()
    alert(JSON.stringify(this.formData()))
  }

  connect() {
    this.root.onsubmit = this.submit
  }
})

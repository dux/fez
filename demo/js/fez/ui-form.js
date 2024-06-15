// render form
Fez('ui-form', class extends FezBase {
  static nodeName = 'form'

  static css = `
    border: 2px solid green;
    border-radius: 5px;
    padding: 15px;
    margin: 15px 0;
  `

  submit(e) {
    e.preventDefault()
    alert(JSON.stringify(this.formData()))
  }

  connect() {
    this.root.onsubmit = this.submit
  }
})

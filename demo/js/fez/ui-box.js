Fez('ui-box', class extends window.FezBaze {
  static style() {
    // demo for inline style, just define style tag
    return `
      border: 2px solid #aaa;
      border-radius: 4px;
      padding: 0 10px;
      background-color: #eee;

      h3 {
        color: red;
      }
    `
  }

  connect() {
    const self = this
    window.requestAnimationFrame(()=>{
      // console.log(self.root)
      self.html(`
        <h3>${self.attrs.title || 'no title'}</h3>
        ${self.$root.html()}
      `)
    })
  }
})

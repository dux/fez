Fez('ui-pubsub', class {
  update (info) {
    this.target.innerHTML = info
  }

  connect() {
    this.target = this.find('.target')
    this.subscribe('ping', this.update)
    this.update('waiting for a ping...')
  }
})

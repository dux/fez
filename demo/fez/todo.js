Fez('ui-todo', class {
  // if you define static html, it will be converted tu function(fast), and you will be able to refresh state with this.render()
  HTML = `
    <h3>Tasks</h3>
    {{#if !@state.tasks[0] }}
      <p>No tasks found</p>
      {{#if true}}
        TRUE
      {{/if}}
    {{:else}}
      FOO
    {{/if}}
    END
    {{#for task, index in @state.tasks}}
      {{#if task.animate}} <!-- this is fine because this is string templating -->
        <p fez-use="animate" style="display: none; height: 0px; opacity: 0;">
      {{else}}
        <p>
      {{/if}}
        <input
          type="text"
          fez-bind="state.tasks[{{index}}].name"
          style="{{ task.done ? 'background-color: #ccc;' : '' }}"
        />
        &sdot;
        <input
          type="checkbox"
          fez-bind="state.tasks[{{index}}].done"
        />
        &sdot;
        <button onclick="$$.removeTask({{ index }})">&times;</button>
      </p>
    {{/for}}
    <p>
      <button onclick="$$.addTask()">add task</button>
      &sdot;
      <button onclick="$$.clearCompleted()">clear completed</button>
    </p>
    <pre class="code">{{ JSON.stringify(this.state.tasks, null, 2) }}</pre>
    <p>If you want to preserve state in templates, wrap content in "fez-slot"</p>
    <p>Refresh: {{Math.random()}}</p>
    <p class="fez-slot">
      Do not refresh: {{Math.random()}}.
    </p>
  `

  clearCompleted() {
    this.state.tasks = this.state.tasks.filter((t) => !t.done)
  }

  removeTask(index) {
    this.state.tasks = this.state.tasks.filter((_, i) => i !== index);
  }

  addTask() {
    // no need to force update template, this is automatic because we are using reactiveStore()
    this.counter ||= 0
    this.state.tasks.push({
      name: `new task ${++this.counter}`,
      done: false,
      animate: true
    })
  }

  animate(node) {
    // same as in Svelte, uf you define fez-use="methodName", method will be called when node is added to dom.
    // in this case, we animate show new node

    $(node)
      .css('display', 'block')
      .animate({height: '33px', opacity: 1}, 200, () => {
        delete this.state.tasks[this.state.tasks.length-1].animate
        $(node).css('height', 'auto')
      })
  }

  connect() {
    this.state.tasks = [
      {name: 'First task', done: false},
      {name: 'Second task', done: false},
      {name: 'Third task', done: true },
    ]
  }
})

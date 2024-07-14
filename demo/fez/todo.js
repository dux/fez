Fez('ui-todo', class extends FezBase {
  // if you define static html, it will be converted tu function(fast), and you will be able to refresh state with this.html()
  static html = `
    <h3>Tasks</h3>
    {{#if !@data.tasks[0]}}
      <p>No tasks found</p>
    {{/if}}
    {{#for task, index in @data.tasks}}
      {{#if task.animate}} <!-- this is fine because this is string templating -->
        <p fez-use="animate" style="display: none; height: 0px; opacity: 0;">
      {{else}}
        <p>
      {{/if}}
        <input
          type="text" name="" value="{{ task.name }}"
          onkeyup="$$.setName({{ index }}, this.value)"
          style="{{ task.done ? 'background-color: #ccc;' : '' }}"
        />
        &sdot;
        <input
          type="checkbox"
          name=""
          {{ task.done ? 'checked=""' : '' }}
          onclick="$$.toggleComplete({{ index }})"
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
    <pre class="code">{{ JSON.stringify(this.data.tasks, null, 2) }}</pre>
  `

  toggleComplete(index) {
    const task = this.data.tasks[index]
    task.done = !task.done
  }

  clearCompleted() {
    this.data.tasks = this.data.tasks.filter((t) => !t.done)
  }

  removeTask(index) {
    this.data.tasks = this.data.tasks.filter((_, i) => i !== index);
  }

  setName(index, name) {
    this.data.tasks[index].name = name
  }

  addTask() {
    // no need to force update template, this is automatic because we are using reactiveStore()
    this.counter ||= 0
    this.data.tasks.push({
      name: `new task ${++this.counter}`,
      done: false,
      animate: true
    })
  }

  animate(node) {
    // same as in svelte, uf you define fez-use="methodName", method will be called when node is added to dom.
    // in this case, we animate show new node
    $(node)
      .css('display', 'block')
      .animate({height: '33px', opacity: 1}, 200, () => {
        delete this.data.tasks[this.data.tasks.length-1].animate
        $(node).css('height', 'auto')
      })
  }

  connect() {
    // creates reactive store, that calls this.html() state refresh after every data set
    // you can pass function as argument to change default reactive behaviour
    this.data = this.reactiveStore({})

    this.data.tasks = [
      {name: 'First task', done: false},
      {name: 'Second task', done: false},
      {name: 'Third task', done: true },
    ]

    for (const i in [1,2,3,4,5]) {
      this.data.i = i
    }

    window.requestAnimationFrame(()=>{
      for (const i in [1,2,3,4,5]) {
        this.data.i = i
      }
    })
  }
})

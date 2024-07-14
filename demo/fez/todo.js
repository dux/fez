Fez('ui-todo', class extends FezBase {
  static html = `
    <h3>Tasks</h3>
    {{#if !@tasks[0]}}
      <p>No tasks found</p>
    {{/if}}
    {{#for task, index in @tasks}}
      {{#if task.animate}}
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
    <pre class="code">{{ JSON.stringify(this.tasks, null, 2) }}</pre>
  `

  toggleComplete(index) {
    const task = this.tasks[index]
    task.done = !task.done
    this.html()
  }

  clearCompleted() {
    this.tasks = this.tasks.filter((t) => !t.done)
    this.html()
  }

  removeTask(index) {
    this.tasks = this.tasks.filter((_, i) => i !== index);
    this.html()
  }

  setName(index, name) {
    this.tasks[index].name = name
    this.html() // refresh full component on every key stroke. done for render speed demo purposes
  }

  addTask() {
    this.counter ||= 0
    this.tasks.push({name: `new task ${++this.counter}`, done: false, animate: true})
    this.html()
  }

  animate(node) {
    $(node)
      .css('display', 'block')
      .animate({height: '33px', opacity: 1}, 200, () => {
        delete this.tasks[this.tasks.length-1].animate
        $(node).css('height', 'auto')
        this.html()
      })
  }

  connect() {
    this.tasks = [
      {name: 'First task', done: false},
      {name: 'Second task', done: false},
      {name: 'Third task', done: true },
    ]
  }
})

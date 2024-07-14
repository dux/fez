Fez('ui-todo', class extends FezBase {
  static html = `
    <h3>Tasks</h3>
    {{#if !@tasks[0]}}
      <p>No tasks found</p>
    {{/if}}
    {{#for task, index in @tasks}}
      <p>
        <input type="text" name="" value="{{ task.name }}" onkeyup="$$.setName({{ index }}, this.value)" />
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
    this.html()
  }

  addTask() {
    let name = prompt('Task name', 'some task')
    this.tasks.push({name: name})
    this.html()
  }

  connect() {
    this.tasks = [
      {name: 'First task'},
      {name: 'Second task'},
      {name: 'Third task', done: true },
    ]
  }
})

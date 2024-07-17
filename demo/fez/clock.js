Fez('ui-clock', class extends FezBase {
  css = `
    input {
      border: 3px solid red !important;
    }

    svg {
      width: 100%;
      height: 100%;
    }

    .clock-face {
      stroke: #333;
      fill: white;
    }

    .minor {
      stroke: #999;
      stroke-width: 0.5;
    }

    .major {
      stroke: #333;
      stroke-width: 1;
    }

    .hour {
      stroke: #333;
    }

    .minute {
      stroke: #666;
    }

    .second,
    .second-counterweight {
      stroke: rgb(180, 0, 0);
    }

    .second-counterweight {
      stroke-width: 3;
    }
  `
  static html = `
    <svg viewBox="-50 -50 100 100">
      <circle class="clock-face" r="48" />

     <!-- markers -->
      {#each [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as minute}
        <line class="major" y1="35" y2="45" transform="rotate({30 * minute})" />

        {#each [1, 2, 3, 4] as offset}
          <line class="minor" y1="42" y2="45" transform="rotate({6 * (minute + offset)})" />
        {/each}
      {/each}

      <!-- hour hand -->
      <line class="hour" y1="2" y2="-20" transform="rotate({30 * @state.hours + @state.minutes / 2})" />

      <!-- minute hand -->
      <line class="minute" y1="4" y2="-30" transform="rotate({6 * @state.minutes + @state.seconds / 10})" />

      <!-- second hand -->
      <g transform="rotate({6 * @state.seconds})">
        <line class="second" y1="10" y2="-38" />
        <line class="second-counterweight" y1="10" y2="2" />
      </g>
    </svg>
  `

  setVars() {
    let time = new Date();
    this.state.time = time
    this.state.hours = time.getHours();
    this.state.minutes = time.getMinutes();
    this.state.seconds = time.getSeconds();
  }

  connect() {
    this.setVars()
    this.setInterval(this.setVars, 1000)
  }
})

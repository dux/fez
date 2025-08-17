// bun build.js w|b
// node build.js
// npx esbuild src/fez.js --bundle > build/fez.js
// npx esbuild src/fez.js --bundle --minify --target=es2015 > build/fez.min.js
// bun bun src/*.js --outdir dist --minify
// npx esbuild $(npx glob-cli 'src/*.js') --outdir=public --bundle --watch --sourcemap

import { execSync } from "node:child_process";
import * as esbuild from 'esbuild'

const cliRun = (command) => {
  console.log(`RUN: ${command}`)
  console.log(execSync(command).toString())
}

//

const kind = process.argv[2]

const opts = {
  entryPoints: ['./src/fez.js'],
  outdir: './dist',
  bundle: true,
  platform: 'browser',
  sourcemap: kind != 'd',
  minify: true,
  plugins: []
}

console.log(opts)

cliRun(`rm -rf ${opts.outdir}; mkdir ${opts.outdir}`)

if (kind === 'w') {
  // dev watch
  async function watch() {
    let ctx = await esbuild.context(opts)
    await ctx.watch()
    console.log('Watching...')
  }
  watch()
}
else if (kind === 'b') {
  cliRun(`bun run index`)
  await esbuild.build(opts)
}
else {
  console.error('ERROR: OPT w|b not selected')
}

cliRun(`ls -lh ${opts.outdir}`)

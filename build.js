// bun build.js w|b
// node build.js
// npx esbuild src/fez.js --bundle > build/fez.js
// npx esbuild src/fez.js --bundle --minify --target=es2015 > build/fez.min.js
// bun bun src/*.js --outdir dist --minify
// npx esbuild $(npx glob-cli 'src/*.js') --outdir=public --bundle --watch --sourcemap

import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import * as esbuild from 'esbuild'

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'))

const cliRun = (command) => {
  console.log(`RUN: ${command}`)
  console.log(execSync(command).toString())
}

const cspEvaluate = {
  name: 'fez-csp-evaluate',
  setup(build) {
    build.onResolve({ filter: /[\\/]evaluate\.js$/ }, (args) => ({
      path: join(args.resolveDir, args.path.replace(/evaluate\.js$/, 'evaluate-csp.js')),
    }))
  },
}

const kind = process.argv[2]

const opts = {
  entryPoints: ['./src/fez.js'],
  outdir: './dist',
  bundle: true,
  platform: 'browser',
  sourcemap: kind != 'd',
  banner: {
    js: `// v: ${version} | AGENTS: https://raw.githubusercontent.com/dux/fez/refs/heads/main/AGENTS.md`,
  },
  plugins: []
}

console.log(opts)

// The files are rewritten in place and only stale ones removed, never the
// folder: an app linked to this checkout (`link:` dependency) watches
// dist/fez.esm.js, and removing the folder ends that watch.
mkdirSync(opts.outdir, { recursive: true })

const written = new Set()
const build = async (extra = {}) => {
  const result = await esbuild.build({ ...opts, ...extra, metafile: true })
  for (const file of Object.keys(result.metafile.outputs)) {
    written.add(basename(file))
  }
}

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
  await build()
  await build({
    entryNames: '[name].min',
    minify: true
  })
  await build({
    format: 'esm',
    entryNames: '[name].esm'
  })
  await build({
    format: 'esm',
    entryNames: '[name].esm.min',
    minify: true
  })
  await build({
    format: 'cjs',
    outExtension: { '.js': '.cjs' }
  })
  // Content-Security-Policy build (import 'fez/csp'): lib/evaluate.js swapped
  // for evaluate-csp.js, so it holds no new Function; components must come
  // precompiled from the bundler plugin
  await build({
    format: 'esm',
    entryNames: '[name].csp.esm',
    plugins: [cspEvaluate]
  })
  await build({
    format: 'esm',
    entryNames: '[name].csp.esm.min',
    minify: true,
    plugins: [cspEvaluate]
  })
  for (const file of readdirSync(opts.outdir)) {
    if (!written.has(file)) rmSync(join(opts.outdir, file), { recursive: true })
  }
}
else {
  console.error('ERROR: OPT w|b not selected')
}

cliRun(`ls -lh ${opts.outdir}`)

---
title: "The Fez toolchain became native Bun"
description: "Removing the Ruby builder and publishing the package made compilation and indexing available from one JavaScript toolchain."
date: "2025-08-01"
slug: "a-native-bun-toolchain"
image: "assets/2025-08-01-bun-toolchain.webp"
image_alt: "A unified tool rail assembling modular component cards."
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "bun"
  - "cli"
  - "tooling"
commits:
  - "950f310"
  - "26650c3"
---

# The Fez toolchain became native Bun

The runtime had always aimed for a no-build browser path, but the repository still used a Ruby builder for its own demos and generated files.
That split made contribution and packaging harder than the runtime itself.

In August 2025, I published `@dinoreic/fez`, added the command-line entry point, and removed the Ruby builder.
The compiler, indexer, development scripts, and tests could now run through Bun and JavaScript.

"No build step" remains a deployment option, not a ban on tools.
A component can load directly in the browser, while a larger project can compile ahead of time, validate templates in CI, or generate metadata.
Both paths should consume the same component format.

Using one toolchain also reduced the number of environment-specific failures around the project.
Contributors need Bun rather than an unrelated language runtime used only for repository plumbing.

## Working example

The local CLI can validate a component without producing a bundle.

```bash
bun ./bin/fez compile ./demo/fez/ui-counter.fez
bun ./bin/fez template ./demo/fez/ui-counter.fez
bun ./bin/fez refactor ./demo/fez
```

An installed package exposes the same `fez` binary.

```bash
bun add @dinoreic/fez
bunx --package @dinoreic/fez fez compile './components/**/*.fez'
```

`compile` catches JavaScript and template errors.
`template` isolates the template compiler when that is the part under investigation.
`refactor` reports legacy syntax without changing files.

The browser path stayed simple while the development path became more dependable.
That is the balance I want from framework tooling: optional at runtime, valuable before deployment.

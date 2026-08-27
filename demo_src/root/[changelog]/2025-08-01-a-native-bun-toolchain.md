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

```bash
bun ./bin/fez compile ./demo/fez/ui-counter.fez
bun ./bin/fez template ./demo/fez/ui-counter.fez
bun ./bin/fez refactor ./demo/fez
```

```bash
bun add @dinoreic/fez
bunx --package @dinoreic/fez fez compile './components/**/*.fez'
```

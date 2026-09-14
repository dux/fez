---
title: "The CLI started validating the component format"
description: "Compile and refactor commands turned Fez's browser compiler knowledge into dependable local and CI feedback."
date: "2026-01-20"
slug: "a-cli-for-the-component-format"
author: "Dino Reic"
authors:
  - name: "Dino Reic"
    url: "https://github.com/dux"
tags:
  - "cli"
  - "compiler"
  - "tooling"
commits:
  - "9649f01"
  - "7edfc8f"
---

```bash
fez compile ./docs/fez/ui-dialog.fez
fez template ./docs/fez/ui-dialog.fez
```

```bash
fez compile './docs/fez/**/*.fez'
fez refactor ./docs/fez
```

```bash
fez compile --debug-template ./docs/fez/ui-dialog.fez
fez template --debug ./docs/fez/ui-dialog.fez
```

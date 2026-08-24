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

# The CLI started validating the component format

Runtime compilation is convenient, but the browser should not be the first place a malformed component reports itself.
By January 2026, Fez had enough language features to deserve a command-line interface that understood the actual format.

The new compile command validated JavaScript, template blocks, component names, and structural errors.
The refactor command reported legacy syntax without rewriting source behind the developer's back.
Debug and index work followed from the same foundation.

This matters because `.fez` is not HTML with an arbitrary script pasted into it.
It has module context, a final component class, scoped and global style blocks, template directives, and documentation blocks.
A generic HTML linter cannot validate those relationships.

The CLI calls the same compiler concepts the runtime uses.
That keeps local feedback aligned with what the browser will execute.

## Working example

Run focused validation while editing one component.

```bash
fez compile ./demo/fez/ui-dialog.fez
fez template ./demo/fez/ui-dialog.fez
```

Validate a group before merging.

```bash
fez compile './demo/fez/**/*.fez'
fez refactor ./demo/fez
```

When template compilation fails, print the generated function body rather than guessing at the transformed code.

```bash
fez compile --debug-template ./demo/fez/ui-dialog.fez
fez template --debug ./demo/fez/ui-dialog.fez
```

The commands do not require a project build.
They give the no-build format a proper preflight check.

Good tooling should make the framework's rules visible and repeatable.
It should not introduce a second, slightly different interpretation of those rules.

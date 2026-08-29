---
title: CLI reference
description: The sq command line - status, provenance inspection, and verification checkout against the protocol.
audience: agent-developer
status: current
sourceOfTruth: packages/cli/README.md
updatedAt: 2026-08-29
---

# CLI reference

`@evimesh/cli` installs the `sq` command for scriptable access to the
protocol.

## Common commands

```bash
sq question list            # list open questions (--field/--state/--project)
sq task list --status open  # find verification and drafting work
sq claim create             # write a Claim draft template
sq evidence add             # hash a file and upload it to object storage
sq validate <document>      # validate one protocol document locally
```

Commands are compound verbs registered in `packages/cli/src/main.mjs`;
`sq help` prints the full table with summaries. Document drafts written by
`claim create` and `run record` are signed through the web flow - there is
no CLI signing command, because a human signature is exactly what the CLI
must not impersonate.

## Install

Install from the published npm package (see the package README for the
current version and flags):

```bash
npm install -g @evimesh/cli
```

## Conventions

- Output is JSON with `--json`.
- Errors carry the same `code` / `message` / `request_id` shape as the API.
- The CLI never stores a plaintext token beyond the local configured
  credential file.

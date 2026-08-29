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
sq status                  # connection and identity status
sq provenance claim-a1b2   # inspect the dependency path of a claim
sq verify checkout claim-a1b2   # lock an exact revision for verification
```

`sq verify checkout` pins an exact immutable revision - the same contract
as a revision-qualified permalink - so a verification session cannot drift
onto a newer revision mid-run.

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

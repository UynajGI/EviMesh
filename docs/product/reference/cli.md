---
title: CLI reference
description: The sq command line - status, provenance inspection, and verification checkout against the protocol.
audience: agent-developer
status: current
sourceOfTruth: packages/cli/README.md
updatedAt: 2026-08-31
---

# CLI reference

The source tree contains the future `sq` client. It is not yet a public npm
release and hosted Device Authorization is not yet open.

Run `sq capabilities --json` (which strictly validates
`GET https://api.evimesh.com/meta/capabilities`) before enabling login,
prepare, submit, or installation guidance. Fetch or schema failure produces a
conservative manifest and cannot enable a network contribution flow.

## Common commands

```bash
sq question list            # list open questions (--field/--state/--project)
sq task list --status open  # find verification and drafting work
sq claim create             # write a Claim draft template
sq evidence add --dry-run   # hash a file locally; publication is not enabled
sq validate <document>      # validate one protocol document locally
```

Commands are compound verbs registered in `packages/cli/src/main.mjs`.
Agent-facing commands may draft and prepare. Human signing is a separate,
interactive local operation that is never available to MCP or an Agent.
Before signing, the human reviews the complete prepared artifact and the CLI's
semantic, relationship, actor, and hash summary, then types
`SIGN <first 12 characters of the signing hash>`. A fixed `SIGN`, `--yes`,
`confirm:true`, an Agent token, or a non-interactive input cannot authorize a
signature.

## Availability

There is no supported public installation command during Public Preview.
Repository contributors can use the workspace package for development, but
must not present that path as a production client release.

Device Auth, `research prepare`, and `research submit` recheck the live
manifest immediately before their network operation. Offline help labels them
as capability-gated. `research sign` remains visible because it is a separate
human-only local TTY operation and does not depend on a server signing
capability.

## Conventions

- Output is JSON with `--json`.
- Errors carry the same `code` / `message` / `request_id` shape as the API.
- Production credentials will use operating-system secure storage or an
  encrypted local file; human private keys are never uploaded.

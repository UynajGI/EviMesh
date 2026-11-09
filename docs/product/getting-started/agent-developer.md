---
title: Agent developer preview
description: Inspect the public protocol now and discover hosted Agent capabilities without assuming unreleased clients are available.
audience: agent-developer
status: current
updatedAt: 2026-08-31
---

# Agent developer preview

EviMesh is a public preview. Public research reads are available; hosted
Device Authorization, research prepare/submit, and the npm clients remain
disabled until their production gates pass.

## Check the live capability contract

Read `GET https://api.evimesh.com/meta/capabilities` before showing a connect
flow or enabling a write command. A route in OpenAPI or a package in this
repository is not proof that its hosted capability or npm release is active.

## What remains invariant

- An Agent may draft, prepare canonical bytes, and relay an already signed
  envelope only when the matching capability is active.
- The human reviews and signs locally. MCP never exposes a signer or human
  private key, and `confirm: true` never substitutes for a signature.
- Every Agent token is scoped and attributed to its Agent actor and approving
  human.
- Public reads do not imply research-write availability.

Never place a real token in documentation, examples, or source control.

## Client release state

The CLI, SDK, and MCP packages in the source tree are development artifacts,
not public npm releases. Installation instructions appear only after the
capability contract reports the client as available and the signed release
has been published.

## Next steps

- [MCP reference](/docs/reference/mcp) for tools and resources.
- [CLI reference](/docs/reference/cli) for `sq` commands.
- [Attribution and signatures](/docs/concepts/attribution-and-signatures) for the chain semantics.

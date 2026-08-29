---
title: MCP reference
description: Tools and resources for connecting an agent - attribution and schema validation are mandatory, network stays out of local drafts.
audience: agent-developer
status: current
sourceOfTruth: apps/mcp/src/tools.mjs
updatedAt: 2026-08-29
---

# MCP reference

The `@evimesh/mcp` server exposes protocol tools and resources over the
Model Context Protocol so an agent can read context and draft under
explicit scopes.

## Tools

- `create_claim`: requires explicit actor attribution; validates the draft
  against the protocol schema before returning it.
- `record_run`: requires source code, an immutable container reference,
  environment, hardware, actor id, and signature.
- `attach_evidence`: links evidence to a claim under a confirm scope.

Draft validation enforces the protocol schema (actor attribution, full
run metadata) before anything is returned; publication happens through
the signed API with a human signature.

## Resources

Resources expose read-only protocol context (objects, states, and event
chains) for an agent to ground its work.

## Safety model

- Write actions require confirm or confirm-plus-sign scopes.
- Attribution is mandatory: the acting actor and the owning human are part
  of the record.
- The canonical tool list lives in the source registry; the package README
  mirrors it for install-time reading.

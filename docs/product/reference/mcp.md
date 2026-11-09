---
title: MCP reference
description: Tools and resources for connecting an agent - attribution and schema validation are mandatory, network stays out of local drafts.
audience: agent-developer
status: current
sourceOfTruth: apps/mcp/src/tools.mjs
updatedAt: 2026-08-31
---

# MCP reference

The source tree contains the future `@evimesh/mcp` server. It is not yet a
public npm release. Read
`GET https://api.evimesh.com/meta/capabilities` before advertising setup or
enabling hosted tools.

## Tools

- Read resources remain distinct from research mutation capabilities.
- Local draft and validation tools remain available without mutation capability.
- Typed prepare appears only when `research.prepare=true` in the live manifest.
- Typed submit appears only when `research.submit=true`, relays an already
  human-signed canonical envelope, and never signs.
- A failed or invalid capability response removes prepare/submit. `tools/call`
  repeats the check so a caller cannot bypass the filtered `tools/list`.
- Legacy mutation placeholders are never advertised or directly callable.

Draft validation enforces the protocol schema (actor attribution, full
run metadata) before anything is returned; publication happens through
the signed API with a human signature.

## Resources

Resources expose read-only protocol context (objects, states, and event
chains) for an agent to ground its work.

## Safety model

- There is no `research:sign` scope.
- Attribution is mandatory: the acting actor and the owning human are part
  of the record.
- `confirm: true` cannot replace the human signature.
- The server cannot read or invoke a human private key.
- The canonical tool list lives in the source registry; the package README
  mirrors it for install-time reading.

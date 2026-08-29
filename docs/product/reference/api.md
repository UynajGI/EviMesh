---
title: API reference
description: The public Cloudflare Worker API - authentication, error shape, request ids, and the machine-readable contract.
audience: agent-developer
status: current
sourceOfTruth: apps/api-edge/openapi.json
updatedAt: 2026-08-29
---

# API reference

The public API is served by the api-edge worker. The machine-readable
contract is `apps/api-edge/openapi.json` (62 paths); the browsable
generated reference is planned for a follow-up phase (docs-plan.md, Docs-C).

## Base URL and authentication

- Production base URL: `https://api.evimesh.com`.
- Public reads are unauthenticated.
- Signed-in writes forward a Supabase JWT; machine access uses API tokens
  with explicit scopes.

## Errors

Errors return a JSON body with `code`, `message`, and a `request_id`.
Quote the request id when reporting a problem - it ties the failure to the
server-side trace without exposing user data.

Example shape (illustrative):

```json
{ "code": "not_found", "message": "route not found", "request_id": "…" }
```

## Pointers

- List endpoints return `items` plus an optional `nextCursor` for opaque
  cursor pagination.
- Relations (evidence links, receipt findings) live on detail endpoints,
  not list rows - hydrate per object.
- Generate a typed client from `openapi.json` with `@evimesh/sdk-ts`.

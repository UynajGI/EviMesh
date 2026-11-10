---
title: API reference
description: The public Cloudflare Worker API - authentication, error shape, request ids, and the machine-readable contract.
audience: agent-developer
status: current
sourceOfTruth: apps/api-edge/openapi.json
updatedAt: 2026-08-31
---

# API reference

The public API is served by the api-edge worker. The machine-readable
contract is `apps/api-edge/openapi.json` (79 paths). The complete
generated endpoint table lives at
[API endpoints](/docs/reference/api-endpoints.generated), guarded by CI
against drift.

## Capability discovery

Read `GET /meta/capabilities` before presenting Device Authorization,
prepare, submit, or client installation. OpenAPI describes the contract;
the capability response describes what the current release channel can
actually serve.

## Base URL and authentication

- Production base URL: `https://api.evimesh.com`.
- Public reads are unauthenticated.
- Enabled signed-in account operations forward a Supabase JWT. Enabled
  machine operations use API tokens with explicit scopes.

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
- Generate a local typed client from `openapi.json`; do not advertise the
  workspace package as a published npm release.

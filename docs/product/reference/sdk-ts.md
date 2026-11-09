---
title: TypeScript SDK reference
description: The generated typed client for the api-edge contract, regenerated whenever OpenAPI changes.
audience: agent-developer
status: current
sourceOfTruth: packages/sdk-ts/src/generated/types.d.ts
updatedAt: 2026-08-31
---

# TypeScript SDK reference

The source tree contains a thin typed client generated from the api-edge
OpenAPI contract. It is not yet a public npm release. Types are regenerated
whenever the contract changes; they are never edited by hand.

## Capability discovery

```bash
curl https://api.evimesh.com/meta/capabilities
```

Source clients use the same contract through
`await createClient({ baseUrl }).capabilities.get()`. The SDK validates the
complete `public-capabilities.v1` document and returns a frozen conservative
fallback on fetch, HTTP, or schema failure; the fallback never enables Device
Authorization, prepare, submit, or an unreleased client.

Do not infer client publication or mutation availability from a generated
type or OpenAPI path. The capability response is authoritative.

## Regeneration

Run the SDK generation script after changing the API contract and commit
the regenerated types together with the `openapi.json` change - the CI
contract tests fail when they drift apart.

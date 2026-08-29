---
title: TypeScript SDK reference
description: The generated typed client for the api-edge contract, regenerated whenever OpenAPI changes.
audience: agent-developer
status: current
sourceOfTruth: packages/sdk-ts/src/generated/types.d.ts
updatedAt: 2026-08-29
---

# TypeScript SDK reference

`@evimesh/sdk-ts` is a thin typed client generated from the api-edge
OpenAPI contract. Types are regenerated whenever the contract changes;
they are never edited by hand.

## Usage

```ts
import { createClient } from "@evimesh/sdk-ts";

const client = createClient({ baseUrl: "https://api.evimesh.com" });
const { data } = await client.GET("/claims/{claimId}", {
  params: { path: { claimId: "claim-a1b2" } },
});
```

The generated `types.d.ts` mirrors every path and schema, so contract
mismatches surface at compile time.

## Regeneration

Run the SDK generation script after changing the API contract and commit
the regenerated types together with the `openapi.json` change - the CI
contract tests fail when they drift apart.

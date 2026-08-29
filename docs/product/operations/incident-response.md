---
title: Incident response
description: Secret exposure and production incidents - the canonical response runbooks and what to quote when reporting.
audience: operator
status: current
sourceOfTruth: docs/runbooks/secret-exposure-response.md
updatedAt: 2026-08-29
---

# Incident response

Two canonical runbooks cover the operator paths:

- [`docs/runbooks/secret-exposure-response.md`](https://github.com/UynajGI/EviMesh/blob/main/docs/runbooks/secret-exposure-response.md)
  for leaked or exposed credentials;
- [`docs/runbooks/production-release.md`](https://github.com/UynajGI/EviMesh/blob/main/docs/runbooks/production-release.md)
  for deployment and rollback mechanics.

## Reporting a production failure

Always include the `request_id` from the error response - it ties the
failure to the server-side trace. Error bodies carry it as
`{ code, message, request_id }`.

## What responders will ask

1. Which environment (production URL, preview, local demo)?
2. The failing route and request id.
3. Whether the demo stack (`pnpm demo:api`) reproduces it - if yes, the
   fix lands against the in-memory stack first; if not, the hosted
   read/write path is implicated.
4. The last green `Validate` run on `main`.

## Honest status

Incident status updates state what is known and what is not. They never
report availability as a percentage, and they never present a quiet system
as a verified one.

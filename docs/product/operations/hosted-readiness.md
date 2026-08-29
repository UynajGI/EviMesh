---
title: Hosted readiness
description: What must be true before pointing the product at hosted Supabase - migrations, RLS, repository surface, and deployment wiring.
audience: operator
status: current
sourceOfTruth: docs/hosted-readiness.md
updatedAt: 2026-08-29
---

# Hosted readiness

The canonical checklist lives in the repository runbook
[`docs/hosted-readiness.md`](https://github.com/UynajGI/EviMesh/blob/main/docs/hosted-readiness.md).
This page orients you; the runbook gates you.

## The shape of the hosted path

- Reads are served by the api-edge worker through the hosted Supabase
  repository (`SupabaseReadRepository`), which talks PostgREST.
- Writes happen through signed protocol commands with row-level security
  pinning the acting actor.
- The web app reads the same API, so a hosted migration is invisible to
  readers when done correctly.

## Before you trust it

- Migrations are applied to the hosted database (direct delta, not the
  local migrate script).
- RLS policies are verified with the signing-role simulation in
  `packages/database/scripts/verify-rls.mjs`.
- Every repository method the query modules require exists on the hosted
  read surface - the `hosted-read-surface` test is the gate that once
  caught every detail endpoint erroring in production.

## When something 500s

Start from the request id in the error response, then read
`docs/runbooks/production-release.md` for the operational checks.

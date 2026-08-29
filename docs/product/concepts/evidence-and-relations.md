---
title: Evidence and relations
description: Evidence links carry a typed relation toward a claim revision - supports, refutes, qualifies, reproduces.
audience: researcher
status: current
sourceOfTruth: packages/database/src/evidence-claim-links.mjs
updatedAt: 2026-08-29
---

# Evidence and relations

Evidence is an observation, artifact, or dataset linked to a claim revision
with an explicit relation type.

## Relation types

The relation is protocol-typed and always visible:

- `supports`: the evidence backs the statement.
- `refutes`: the evidence counts against the statement.
- `qualifies`: the evidence bounds or narrows the statement.
- `reproduces`: the evidence independently reproduces the claim's result.

Claim pages group evidence by these relations, with counts shown as
navigation entry points. Unknown relations degrade to an honest ungrouped
row instead of being dropped.

## Revision targeting

Evidence links target exact claim revisions. When a claim page lists
evidence claim-wide, each item carries the revision it links to, and a
pinned permalink says so explicitly.

## List and detail split

The evidence list endpoint returns rows without their relations; the
relation lives on each evidence detail as `claimLinks`. Pages hydrate this
in bounded chunks and degrade to ungrouped rows if the detail read fails -
grouping stays honest.

## Provenance

Evidence carries its creator, creation time, and any artifact or run
references. The run record holds the full environment: source code
reference, container digest, environment, and hardware.

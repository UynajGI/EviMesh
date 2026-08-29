---
title: The object model
description: Questions, projects, claims, evidence, runs, receipts, challenges, and frontiers - and how stable ids tie them together.
audience: researcher
status: current
sourceOfTruth: packages/protocol/src
updatedAt: 2026-08-29
---

# The object model

EviMesh records research as a graph of immutable, protocol-typed objects.

| Object | Carries | Stable id example |
| --- | --- | --- |
| Question | The research subject and its contract | `q-…` |
| Project | A planned effort under a question | `proj-…` |
| Claim | One falsifiable statement with revisions | `claim-…` |
| Evidence | An observation or artifact linked to claims | `ev-…` |
| Run | An executed computation with full environment metadata | `run-…` |
| Receipt | A signed verification with findings | `rec-…` |
| Challenge | An adversarial process against a claim | `chal-…` |
| Frontier snapshot | The frozen set of accepted claims | `fs-…` |

## Immutable revisions

Every mutation creates a new revision. Old versions stay readable forever;
nothing is edited in place. Permalinks point at an exact revision, and a
revision list walks the append-only history.

## Stable ids

Objects are addressed by stable ids, rendered as id chips with copy
support. Revision-qualified references read as `id@vN`.

## Where the truth lives

The typed shapes and enums are defined in the protocol package
(`packages/protocol/src`). When this page and the source disagree, the
source wins - please open an issue.

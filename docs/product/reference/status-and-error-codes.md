---
title: Status and error codes
description: Claim, challenge, finding, and outcome vocabularies, plus the API error shape - all protocol-typed, all rendered as text.
audience: agent-developer
status: current
sourceOfTruth: packages/protocol/src
updatedAt: 2026-08-29
---

# Status and error codes

All status vocabularies are protocol-typed. The UI renders them as text
badges with icons - color never carries the meaning alone, and states are
never converted into scores or percentages.

## Vocabularies

| Vocabulary | Values | Canonical source |
| --- | --- | --- |
| Claim state | hypothesis, candidate, under_verification, provisionally_accepted, accepted, contested, refuted, superseded, retracted, dependency_tainted | `claim-state.mjs` |
| Challenge state | open, admissible, investigating, upheld, rejected, resolved | `challenge-state.mjs` |
| Finding severity | critical, major, warning, note | verification schemas |
| Receipt outcome | supports, refutes, qualifies, inconclusive | `verification-receipt.mjs` |
| Contribution role | originator, contributor, reviewer, verifier, witness, maintainer | `contribution-role.mjs` |
| Evidence relation | supports, refutes, qualifies, reproduces (plus graph relation types) | evidence link schema |

These summaries are for orientation. The complete, generated vocabulary
pages - [Protocol vocabularies](/docs/reference/protocol-vocabularies.generated)
and [API endpoints](/docs/reference/api-endpoints.generated) - are produced
from the protocol source and the OpenAPI contract and are guarded by CI, so
they cannot drift.

## API errors

Errors return `code`, `message`, and `request_id`. Common codes include
`not_found`, `validation` failures with the offending field, and
`SUPABASE_READ_*` repository errors on the hosted read path. Always quote
the request id in bug reports.

## UI rendering rules

- Unknown states degrade to an honest neutral badge, never a guessed one.
- Contested, refuted, retracted, and tainted states are always rendered.
- Attention levels (critical / attention / update / quiet) express
  prioritization only - never truth, quality, or acceptance.

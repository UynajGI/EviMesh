---
title: Challenges
description: An open adversarial process against a claim - states, impacts, and how a challenge differs from a downvote.
audience: researcher
status: current
sourceOfTruth: packages/protocol/src/challenge-state.mjs
updatedAt: 2026-08-29
---

# Challenges

A challenge is a structured adversarial process against a claim, started
from an observation that the claim's current form may not survive.

## States

Challenges move through `open`, `admissible`, `investigating`, `upheld`,
`rejected`, and `resolved`. The canonical enum lives in the protocol source
(`challenge-state.mjs`).

An `investigating` challenge means the community is actively checking the
claim; the challenged claim stays visible with its `contested` state shown
honestly.

## Impacts

A challenge declares the claims it impacts. When an upheld challenge
undermines a premise, dependent claims become `dependency_tainted`: their
usage premises must be re-checked before they can be relied on. Taint
propagates through the claim graph edges - the DAG exists precisely so this
is traceable.

## Challenges versus opinions

A challenge requires a statement of what is wrong and what would falsify or
repair the claim. It is not a downvote, a flag, or a reputation event: it
has a state machine, impacts, and a signed history like every other object.

## Where to see them

Challenges appear on the claim page (status rail and dispute blocks), in
workspace Summary views for claims with attention states, and on the work
board for verifiers looking for what to check next.

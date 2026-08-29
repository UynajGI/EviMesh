---
title: Claim lifecycle
description: The states a claim moves through, who can move it, and what each state promises - and never promises.
audience: researcher
status: current
sourceOfTruth: packages/protocol/src/claim-state.mjs
updatedAt: 2026-08-29
---

# Claim lifecycle

A claim is one falsifiable statement. Its state is a protocol-level badge,
not a prose label.

## States you will see

Claims move through states such as `hypothesis`, `under_verification`,
`provisionally_accepted`, `accepted`, `contested`, `refuted`, `superseded`,
`retracted`, and `dependency_tainted`.

The canonical enum and its allowed transitions live in the protocol source
(`claim-state.mjs`); the UI derives allowed transitions from it rather than
duplicating the rules.

## What states promise

- `provisionally accepted` means the claim currently stands in a frozen
  frontier snapshot. It is provisional by definition.
- `contested` means an adversarial challenge is open. The claim stays
  readable and citable; contest is information, not removal.
- `refuted` and `retracted` are terminal honesty states. Refuted claims
  remain in the graph - negative results are results.
- `dependency_tainted` means an upstream premise this claim depends on was
  challenged or refuted, so its usage premises need re-checking.

## Who moves a claim

State changes happen through signed protocol commands with role checks. An
agent may draft; the state transition is signed by a human actor.

## Never a score

The claim state is a protocol fact with fixed copy - never a percentage,
rank, or quality measure. Counts of claims in each state are entry points
for navigation only.

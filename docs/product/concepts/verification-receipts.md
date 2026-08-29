---
title: Verification and receipts
description: A receipt is a signed observation with a context mode, typed findings, and an outcome that is never a verdict.
audience: verifier
status: current
sourceOfTruth: packages/schemas
updatedAt: 2026-08-29
---

# Verification and receipts

A verification receipt is a signed record of an independent attempt to
check a claim.

## Context modes

The receipt declares what the verifier saw: for example statement-only
(blind) verification, or the full evidence context. Blind verification is
what makes independent receipts comparable.

## The fielded receipt

Receipts carry typed fields rather than a verdict label alone:

- verification types (for example `blind`, `replication`);
- the context mode;
- implementation and data relations;
- the outcome.

## Findings

Each receipt carries findings with severities: `critical`, `major`,
`warning`, `note`. Findings are observations with a title and description.

An outcome of `supports` and a `critical` finding can coexist on one
receipt: the outcome records the overall observation, the finding records
something that needs attention. Neither replaces the other, and neither is
converted into a score.

## Outcomes

Outcome values are protocol-typed - `supports`, `refutes`, `qualifies`,
`inconclusive` - and the UI groups receipts by them as navigation. Claim
pages show the highest open finding next to the outcome groups so the most
urgent observation is one glance away.

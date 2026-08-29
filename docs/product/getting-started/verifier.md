---
title: Verifier quickstart
description: Run a verification under a declared context mode, file findings, and let the receipt - not a verdict - carry the result.
audience: verifier
status: current
updatedAt: 2026-08-29
---

# Verifier quickstart

Verification produces a signed receipt with typed findings. The receipt
records what you observed; it never collapses into a truth score.

## 1. Pick a claim and a context mode

A verification declares its context mode - for example, whether you saw the
statement only (blind) or the full evidence set. Blind verification is the
default path the work queue offers; it is what makes independent receipts
comparable.

## 2. Reproduce and observe

Run the artifacts, rerun the baseline, or probe the methods, and record what
happened. The receipt captures verification types (such as `blind` or
`replication`), the context mode, and the implementation and data relations
you declared.

## 3. File findings with severities

Findings carry a severity (`critical`, `major`, `warning`, `note`), a title,
and a description. Findings are evidence of what you saw. A receipt with a
`supports` outcome can still carry a `critical` finding - the outcome says
what you observed overall, the findings say what needs attention.

## 4. Sign and publish

The receipt is signed and appended to the event chain with a stable id.
From the claim page, the status rail groups receipts by outcome and lists
the highest open finding - as navigation, never as a score.

## Next steps

- [Verification and receipts](/docs/concepts/verification-receipts) for the fielded receipt contract.
- [Challenge a claim](/docs/concepts/challenges) when an observation should become an adversarial process.
- [Inspect provenance](/docs/concepts/frontiers) for dependency taint and frontier snapshots.

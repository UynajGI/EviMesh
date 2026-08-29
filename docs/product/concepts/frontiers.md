---
title: Frontiers
description: Frozen snapshots of accepted claims per project - sequences, membership, and dependency taint.
audience: researcher
status: current
sourceOfTruth: packages/frontier-bundle/src
updatedAt: 2026-08-29
---

# Frontiers

A frontier is a frozen, immutable snapshot of the claims a project currently
stands on. Questions settle; frontiers freeze.

## Snapshots and sequences

Each project's frontier history is an ordered sequence of snapshots. A
snapshot is published once and never edited: the next state of knowledge is
a new snapshot with a higher sequence number, and the diff between
snapshots is derivable.

## Membership

Snapshot members are claims at exact revisions. Membership is recorded per
snapshot, so a permalink to a snapshot always renders the same accepted
set.

## Dependency taint

Claim relations form a directed graph. If a member claim is later refuted
or tainted, claims that depend on it become `dependency_tainted` - their
usage premises inherited from the tainted premise must be re-checked. The
workspace Summary surfaces this as a destructive alert rather than quietly
dropping members.

## Export and verification

Frontier snapshots can be exported as bundles with event proofs, so the
accepted set can be verified outside the platform - the checkpoint hashes
and Merkle proofs travel with the bundle.

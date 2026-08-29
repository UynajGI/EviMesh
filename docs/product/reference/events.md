---
title: Events and the hash chain
description: Every protocol action is a signed event with parents - the audit trail you can verify yourself.
audience: verifier
status: current
sourceOfTruth: packages/protocol/src
updatedAt: 2026-08-29
---

# Events and the hash chain

Every protocol action - claims, evidence, runs, verifications, challenges,
frontier publications - lands on an append-only chain of signed events.

## Event anatomy

Each event carries:

- a stable `event_id`;
- an `event_type` (for example `claim.created`, `evidence.linked`,
  `verification.completed`, `frontier.snapshot_published`);
- the acting actor id;
- a JSON payload with the action specifics;
- a hash, its parent hashes, and a signature.

Natural language first: the audit page shows the type, actor, and time
prominently, with hashes and signatures folded one layer down per event.

## Reading the chain

Parents tie an event to its predecessors, so the chain is verifiable
without trusting the server: fetch the events, recompute, compare.
Merkle checkpoints bundle ranges of the chain into inclusion proofs for
frontier snapshots.

## Access

The event audit lives at `/events` with deep-link filters
(`objectType`, `objectId`, `actorId`, `eventType`, and time bounds). The
API exposes the same reads for programmatic audit.

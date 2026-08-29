---
title: Signing keys and rotation
description: Platform signing keys - generation, verification, and the rotation runbook.
audience: operator
status: current
sourceOfTruth: docs/runbooks/platform-signing-key-rotation.md
updatedAt: 2026-08-29
---

# Signing keys and rotation

Platform signing keys sign protocol events; their rotation is a governed
operation with its own canonical runbook:
[`docs/runbooks/platform-signing-key-rotation.md`](https://github.com/UynajGI/EviMesh/blob/main/docs/runbooks/platform-signing-key-rotation.md).

## What rotation must preserve

Two registries sign two different artifacts:

- **Platform keys** (the worker keyring, `PLATFORM_KEYRING`, exposed at
  `/platform/keys`) sign platform receipts via `server_signature`.
  Rotation keeps an active and a retired platform key so receipts signed
  before the rotation stay verifiable.
- **Actor keys** (the `signing_keys` table, one Ed25519 identity per
  agent with a published fingerprint and revocation timestamp) sign
  ResearchEvents. Verifying a historical event depends on the actor key
  that was valid at signing time, not on the platform keyring.

Rotation adds keys; it never invalidates history.

## Two key registries - rotate the right one

- **Platform keys**: the worker's keyring (`PLATFORM_KEYRING`,
  inspectable at `/platform/keys`). Old and new platform keys coexist
  across a rotation so previously signed material stays verifiable.
- **Actor keys**: the `signing_keys` table, one Ed25519 identity per
  agent, with published fingerprints and revocation timestamps.

An operator who rotates the wrong registry leaves old or new platform
receipts unverifiable. The canonical runbook walks the platform path.

## If a key may be compromised

Do not wait for scheduled rotation: follow
`docs/runbooks/secret-exposure-response.md` first (revoke, assess signed
material, rotate), then return to the standard rotation runbook.

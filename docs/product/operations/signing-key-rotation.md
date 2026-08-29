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

- Old events stay verifiable: rotation adds a key, it never invalidates
  history.
- The key registry (public keys per actor, revocation timestamps) is part
  of the database schema, so verifiers can check which key was valid at
  signing time.
- Agent actors keep their own signing keys with published fingerprints;
  those rotate per-agent, not with the platform key.

## If a key may be compromised

Do not wait for scheduled rotation: follow
`docs/runbooks/secret-exposure-response.md` first (revoke, assess signed
material, rotate), then return to the standard rotation runbook.

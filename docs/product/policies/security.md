---
title: Security
description: Vulnerability reporting and the signing, token, and Agent attribution boundaries.
audience: agent-developer
status: current
sourceOfTruth: apps/web/app/privacy/policy-content.js
updatedAt: 2026-08-31
---

# Security

> Effective 2026-08-31 for Public Preview. A security owner and response coverage are required before Public Beta.

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/UynajGI/EviMesh/security/advisories/new)
for a suspected vulnerability. Do not open a public issue or add exploit
details to a research object. If the private route is unavailable, email
[yuunagi.cn@outlook.com](mailto:yuunagi.cn@outlook.com?subject=EviMesh%20security%20report)
with a minimal description and request a secure follow-up channel.

EviMesh does not operate a bug bounty, promise payment, or claim continuous
response during Public Preview. Receipt, severity, disclosure timing, and any
safe-harbor language require approval before Public Beta.

## Human signing boundary

Research mutation uses draft, prepare, human local signature, and submit. No
`research:sign` scope exists. An Agent must not receive or use a human private
key. Human private keys belong in supported local secure storage or an
encrypted local file, never browser storage, research content, logs, or support
messages.

API tokens use narrow scopes, expiry, labels, rotation, and revocation. Device
authorization binds a connection to an Agent Actor and approving human Actor.
A token never makes an Agent a human signer.

## Safe assessment

- Use test accounts and non-sensitive data for authorized assessment.
- Stop before affecting other users, damaging data, creating uncontrolled traffic, or exposing personal information.
- Respect access controls, rate limits, project roles, and requests to pause.
- Preserve enough evidence for safe reproduction without continued exploitation.

An exposed OAuth secret, token, credential, or private key must be revoked or
rotated. Removing it from a message or commit is not remediation.

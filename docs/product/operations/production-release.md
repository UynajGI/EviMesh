---
title: Production release
description: How production deploys, what gates a release, and where the canonical runbook lives.
audience: operator
status: current
sourceOfTruth: docs/runbooks/production-release.md
updatedAt: 2026-08-29
---

# Production release

The canonical runbook is
[`docs/runbooks/production-release.md`](https://github.com/UynajGI/EviMesh/blob/main/docs/runbooks/production-release.md).
This page is the orientation layer: what triggers what, and which checks
must be green before and after.

## Deploy triggers

- The web app deploys to Cloudflare on pushes to `main` that touch
  `apps/web/**`, `docs/product/**`, or the workflow itself
  (`.github/workflows/web-production.yml`).
- The api-edge worker deploys manually from its package scripts after the
  contract changes are merged.

## Release gates

1. The `Validate` workflow is green on the merge commit: package tests,
   the web suite (direct node, per the AGENTS.md pnpm trap), the docs
   reference dirty-diff check, and the whitespace gate.
2. The `Web Production` deployment finishes and the production URL answers.
3. Post-deploy smoke: open a known object permalink and the docs homepage.

## After an incident

Follow `docs/runbooks/secret-exposure-response.md` for credential events
and `docs/runbooks/platform-signing-key-rotation.md` for key rotation -
both are canonical and versioned with the repository.

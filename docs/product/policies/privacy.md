---
title: Privacy
description: Data handling for accounts, identity, security records, and public research during Public Preview.
audience: researcher
status: current
sourceOfTruth: apps/web/app/privacy/policy-content.js
updatedAt: 2026-08-31
---

# Privacy

> Effective 2026-08-31 for Public Preview. Legal and operations review is required before Public Beta.

This notice covers the EviMesh website, API, account services, Agent
connection flow, and public research record. Research objects and attribution
are designed for public inspection. Account security records, credentials,
moderation cases, and support correspondence are not public research objects.

## Information processed

- Account data, including email, profile, accepted terms version, and identity provider.
- Public Actor data, including display information, public signing keys, verified identity links, and project roles.
- Security data, including token hashes, device authorization state, request metadata, timestamps, and audit events.
- Research data, including content, revisions, graph relations, signatures, provenance, and attribution.
- Support and governance data, including reports, appeals, export requests, and deletion requests.

EviMesh uses this information to operate access, membership, Agent connections,
signature verification, the research audit trail, service protection, and
support. Operational measurement must not create public research rankings or
scores.

## Identity and signing

An ORCID iD is verified only after an ORCID OAuth flow. A typed identifier is
never verified. Human private signing keys remain local. EviMesh stores public
key metadata, not the human private key. Agents may draft, prepare, and relay a
signed envelope, but cannot sign as a human.

## Providers and retention

Current infrastructure includes Cloudflare and Supabase. A selected external
identity provider also processes its authentication request under its own
terms. Provider locations, transfer terms, and the final retention schedule
must be confirmed before Public Beta.

Account export and deletion requests are accepted at
[yuunagi.cn@outlook.com](mailto:yuunagi.cn@outlook.com?subject=EviMesh%20privacy%20request).
Deleting an account does not silently rewrite a signed DAG. Required public
restrictions use an auditable discovery, access, or download overlay. Removed
Artifact bytes may be represented by a tombstone while their content hash and
audit relation remain.

## Changes

Material changes receive a new effective date. No unconfirmed legal transfer,
retention, or response promise is implied by this preview notice.

# Secret exposure response runbook

Use this runbook whenever a token, password, private key, signing key, database
credential, or provider secret may have been exposed. Treat a suspected exposure
as real until the credential owner proves otherwise. Do not put the exposed
value in an issue, chat message, commit, log, screenshot, or evidence file.

## Prerequisites and first decision

- The incident commander, security owner, service owner, and communications
  owner are identified.
- The affected secret's provider, scope, environment, owner, and last-known
  use are recorded without recording the secret value.
- Preserve the source location, commit SHA, log/request ID, timestamp, and
  discovery method. Do not rewrite history before preserving evidence.

Decide immediately whether the secret is still valid, whether it can access
production or customer data, and whether there is evidence of use by an
unauthorized party. If scope is unknown, use the broadest safe containment.

## 1. Contain and revoke

1. Stop the affected deployment, workflow, job, or integration if continued use
   could increase exposure. Prefer disabling one integration over taking the
   entire service offline.
2. Revoke or disable the exposed credential in its owning provider console.
   For Cloudflare, use the API token page; for Supabase, use the project
   settings and approved secret-management path; for GitHub, revoke the token
   or deploy key in the owning account.
3. If a signing or encryption key is exposed, activate the replacement key's
   public/configuration entry before revocation where the protocol requires
   overlap. Follow `platform-signing-key-rotation.md` for signed receipts.
4. Invalidate sessions, refresh tokens, presigned URLs, or connection pools that
   were created with the affected credential.
5. Block known malicious source addresses or objects only when that action is
   reversible and does not destroy evidence.

Record the revocation timestamp, provider operation ID, affected scope, and
containment action. Never record the token itself.

## 2. Rotate and restore service

Generate a new credential using the provider's approved generator and store it
only in the approved secret manager or protected deployment environment. Do not
use a value copied from shell history, a ticket, or the exposed location.

Update the smallest affected environment first, then verify:

```powershell
pnpm validate
pnpm infra:hosted-readiness
```

Run the affected service's non-destructive health and synthetic smoke checks.
Confirm the old credential is rejected and the new one works with least
privilege. If the secret was exposed in Git, remove it from the working tree,
rotate it first, and use the repository's approved history-remediation process;
do not force-push or rewrite shared history during an active incident without
the incident commander's approval.

## 3. Audit for use and impact

Query the owning provider's audit logs for the exposure window plus the provider
retention margin. Search by credential ID, actor, source address, API route, and
resource—not by printing the secret value. Check:

- successful and failed authentications;
- reads, writes, deletions, exports, and permission changes;
- unusual geography, user agent, rate, or time pattern;
- newly issued tokens, keys, sessions, webhooks, or scheduled jobs;
- affected database rows, R2 objects, deployments, and signed artifacts.

Preserve exported logs in the restricted incident evidence store. Hash the
export, record its time range and query, and redact customer content. If impact
cannot be bounded, escalate to the data-breach and provider-notification path.

## 4. Decision points and rollback

- If there is no evidence of use and the secret is fully revoked, continue with
  rotation and monitoring.
- If unauthorized use is confirmed, keep the affected integration contained,
  preserve evidence, and require the incident commander to approve restoration.
- If rotation breaks a dependency, restore service with a newly generated
  least-privilege credential or a temporary read-only credential. Never
  reactivate the exposed value.
- If a signing key was exposed, reject newly forged material, retain historical
  verification keys as required, and follow the signing-key runbook and protocol
  recovery plan.

The rollback for this incident is a containment rollback: disable the affected
integration or revert the deployment configuration to a known-safe configuration
while keeping the exposed credential revoked. Reopening access requires a
recorded approval, successful smoke checks, and an active replacement secret.

## 5. Communication and closeout

The communications owner sends updates through the approved incident channel:

1. Initial notice: what class of secret, environment, discovery time, current
   containment, and next update time; never include the value.
2. Internal impact update: affected systems, audit result, user/data impact,
   mitigations, and owner for each follow-up.
3. External or provider notice: only after the incident commander and legal or
   privacy owner approve the scope and wording.
4. Closure: revocation and rotation complete, audit window reviewed, monitoring
   stable, and preventive actions assigned.

Capture evidence consisting of the incident ID, secret class and scope,
discovery source, revocation/rotation operation IDs, audit query summaries,
affected resources, approvals, communications timestamps, and follow-up owners.
Keep the evidence in the restricted incident store and verify that it contains
no secret values, private keys, passwords, or unredacted customer data.

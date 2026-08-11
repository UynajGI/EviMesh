# Production release runbook

Use this runbook for a release of `main` to the production Web, API, and database
surfaces. The release operator owns the change window and records the evidence
listed below. Never paste tokens, passwords, private keys, or customer data into
the evidence record.

## Prerequisites

- The pull request is merged to `main`; required CI checks and the cloud Codex
  review are complete.
- The release commit, migration range, operator, change window, and rollback
  commit are written in the change ticket.
- The production Supabase project, Cloudflare account, and deployment secrets
  are available through their approved consoles or CI environment. Do not put
  them in a local `.env` file or this repository.
- A rollback owner and an incident contact are assigned. For a database change,
  confirm whether the migration is backward-compatible before starting.

## 1. Pre-release validation

From a clean checkout of the release commit:

```powershell
git fetch origin main
git checkout --detach origin/main
pnpm install --frozen-lockfile
pnpm validate
pnpm infra:hosted-readiness
```

Stop if validation fails, the dependency lockfile changes unexpectedly, hosted
readiness reports a missing required variable, or the release commit is not the
commit approved by the change ticket.

Record the commit SHA, validation output summary, and the start time. Redact
URLs containing credentials and all secret values.

## 2. Apply database migrations

Review the migration list and its stated compatibility before applying it:

```powershell
git log --oneline -- supabase/migrations packages/database/drizzle
supabase link --project-ref <production-project-ref>
supabase db push
```

Use the provider's migration history view to confirm that every expected
migration is applied once. If a migration fails, stop the release; do not edit
the applied migration or run an ad-hoc SQL repair without an incident record.

For destructive or non-backward-compatible migrations, use the separately
approved expand/contract plan and deploy the compatible application version
first. Do not continue merely because the command returned partial output.

## 3. Deploy the application

Production deployment is performed by the protected repository workflow after
the approved merge. Start or approve that workflow according to repository
policy; do not bypass its environment protection. The production Web workflow
uses:

```powershell
pnpm --filter @evimesh/web deploy:production
```

If the API or Worker deployment is a separate protected workflow, use that
workflow's reviewed command and record its deployment ID. Never substitute a
local token or deploy from an unreviewed branch.

## 4. Health checks and decision points

Run checks from outside the deployment host using the production origins from
`docs/infra-domains.md`:

```powershell
Invoke-WebRequest https://evimesh.com -UseBasicParsing
Invoke-WebRequest https://api.evimesh.com/health -UseBasicParsing
```

Continue only when all of the following are true:

- Web returns the expected production page and has no asset-loading error.
- API `/health` returns the expected success status and response shape.
- Authentication, one read-only API request, and one permitted write-path smoke
  test succeed with a non-production test account or approved synthetic data.
- Logs show no sustained increase in 5xx responses, migration errors, queue
  backlog, upload failures, or authentication failures during the observation
  window.

Pause and investigate if any check is flaky, if error rate or latency exceeds
the change-ticket threshold, or if the database schema and deployed application
are incompatible. The release is failed if the issue cannot be explained and
contained within the change window.

## 5. Rollback decision and procedure

Rollback when health checks fail, data integrity is at risk, or the incident
commander declares the release unsafe. First preserve logs and the deployment
ID. Then:

1. Stop further promotion and mark the release failed in the change ticket.
2. If the application is backward-compatible, redeploy the last known-good
   commit through the protected production workflow.
3. Do not automatically reverse database migrations. Use a reviewed forward
   repair or the pre-approved down/restore procedure only when the migration
   owner confirms that it is safe and no writes would be lost.
4. Re-run the health and smoke checks above, then keep the system read-only or
   disable the affected feature if that is the safer containment choice.
5. Escalate to the database incident runbook when rollback cannot restore a
   consistent state.

The rollback target, reason, operator, timestamps, deployment IDs, migration
state, and final health results are mandatory evidence.

## Evidence capture and closeout

Attach a redacted record containing:

- release commit and previous known-good commit;
- migration names and provider migration status;
- Web/API deployment IDs and workflow URLs;
- health-check status, response timestamps, and request IDs;
- smoke-test result and observation-window metrics;
- rollback decision, if any, with approvers and final state;
- follow-up issues, owner, and due date.

Close the change only after the observation window completes and the operator
confirms that no secret or personal data was included in the evidence.

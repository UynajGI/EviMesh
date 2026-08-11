# M13 external controls register

This register is the auditable configuration pack for M13-24 (managed
PostgreSQL backups), M13-33 (cost budget alerts), and M13-34 (service status).
It describes what the service owner must configure in a provider console. It
does not perform those actions and does not claim that any provider control is
already enabled. Every control remains **PENDING PROVIDER EXECUTION** until its
evidence template has been completed and signed.

## Scope and ownership

| Control | Owner | Configuration location | Current state |
| --- | --- | --- | --- |
| Managed PostgreSQL automatic backups | Database/platform owner | Supabase project → Database → Backups, or the selected managed PostgreSQL provider's backup settings | PENDING PROVIDER EXECUTION |
| Budget alert | Account/billing owner | Cloudflare account → Billing → Notifications/Budgets, plus Supabase billing notifications if applicable | PENDING PROVIDER EXECUTION |
| Public status page | Operations owner | Selected status-page provider → Components and monitors | PENDING PROVIDER EXECUTION |

The owner must record the provider, project/account identifier, configuration
timestamp, responsible person, and a redacted screenshot or command summary.
Never record API tokens, database passwords, DSNs, encryption keys, or complete
backup URLs in this repository.

## M13-24 — Managed PostgreSQL automatic backups

Configure managed backups for the production database and, separately, verify
that the staging policy is intentional. The minimum target is a provider
retention window of at least 7 days, a successful automated backup at least
once every 24 hours, and a documented restore point that meets the roadmap
target of RPO ≤ 24 hours. Point-in-time recovery may be enabled when offered,
but it does not replace the daily logical export and restore drill in M13-25
and M13-28.

Minimum verification:

1. The provider console shows automatic backups enabled for the intended
   production project and the configured retention period.
2. The latest backup is successful and its completion time is less than 24
   hours old at verification time.
3. A non-production restore or provider backup-list check identifies a usable
   restore point. Do not restore over production for this check.
4. Record the provider's backup timezone, retention, encryption-at-rest
   setting, and the contact/escalation path.

Rollback/contact: record the provider's documented procedure for disabling or
changing the schedule, the rollback risk, and the on-call/database owner. Do
not disable the only backup policy as a rollback action; revert to the last
known-good retention and schedule instead.

Evidence: complete [the managed-backup template](evidence/m13-managed-backup.md).

## M13-33 — Cost budget alerts

Create notification thresholds before production traffic is enabled. Use a
monthly account-level threshold for Cloudflare and a separate project-level
threshold for Supabase or the selected database provider. The owner may choose
the currency and amount, but must record the rationale and the expected free
tier/normal operating envelope.

Minimum verification:

1. The alert is attached to the correct account/project, not a personal
   sandbox account.
2. At least two thresholds exist: an early-warning threshold (recommended
   50–70% of the monthly budget) and an action threshold (recommended 90–100%).
3. Notifications reach the named operations contact and do not expose billing
   credentials.
4. The alert history or provider test notification proves the route; if the
   provider cannot test notifications, record that limitation and the next
   manual verification date.

Rollback/contact: document how to edit or remove the alert, who approves a
budget change, and which service is paused or investigated at the action
threshold. Changing a threshold does not cancel provider usage or an invoice.

Evidence: complete [the budget-alert template](evidence/m13-budget-alert.md).

## M13-34 — Public service status page

Create a public status page with these components:

| Component | Minimum monitor/health signal | Degraded condition |
| --- | --- | --- |
| Web | Public web origin and a representative page/health response | DNS/TLS failure, HTTP 5xx, or sustained unavailable page |
| API | API Edge health endpoint and one authenticated-free read-only contract check | HTTP 5xx, elevated latency, or failed health contract |
| DB | Provider health/backup signal; never expose database credentials or internal topology | Provider outage, failed backup, or inability to serve required reads |
| R2 / Storage | R2 bucket/worker storage probe using a non-sensitive test object or provider health signal | Storage error, upload verification failure, or mirror/storage backlog |

Minimum verification:

1. The page is publicly reachable without an account and has an owner and
   incident contact.
2. Each component has a monitor, polling interval, failure threshold, and
   maintenance-window procedure.
3. The page distinguishes operational status from scheduled maintenance and
   does not disclose secrets, private URLs, customer data, or internal error
   payloads.
4. A redacted preview or provider test event demonstrates that an incident can
   be declared, updated, and resolved.

Rollback/contact: record the provider's procedure for disabling a monitor,
changing a component, or reverting a public incident. Keep the status page
available during a product rollback; the operations owner remains the contact
for false positives and maintenance notices.

Evidence: complete [the status-page template](evidence/m13-status-page.md).

## Sign-off gate

M13-24, M13-33, and M13-34 are complete only when all three evidence templates
contain provider/project identifiers, verification results, timestamps, owner
sign-off, and redacted evidence references. A blank or placeholder field means
the control is still pending; it must not be reported as enabled in release
notes or deployment checklists.

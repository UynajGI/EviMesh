# M13-33 budget alert evidence

Status: **PENDING PROVIDER EXECUTION**

Complete one record for each billing provider. Use amounts and identifiers that
are safe to disclose; never include payment details, tokens, or invoice
attachments containing personal data.

## Configuration record

| Field | Value |
| --- | --- |
| Provider | `Cloudflare` / `Supabase` / `TODO` |
| Account/project identifier (non-secret) | `TODO` |
| Billing period and currency | `TODO` |
| Monthly budget and rationale | `TODO` |
| Early-warning threshold | `TODO` |
| Action threshold | `TODO` |
| Notification destination (redacted) | `TODO` |
| Configuration location/link | `TODO` |
| Configuration timestamp (UTC) | `TODO` |
| Responsible owner/contact | `TODO` |

Recommended thresholds are 50–70% for early warning and 90–100% for action.
Record a different threshold only with its operational rationale.

## Minimum verification

- [ ] Alert is scoped to the intended production account/project.
- [ ] Early-warning and action thresholds are active.
- [ ] Notification recipient or route is verified without exposing its secret.
- [ ] Provider test notification or alert history was observed at `TODO` UTC.
- [ ] The action-threshold response owner and escalation path are `TODO`.

Verification command or redacted console summary:

```text
TODO — include alert name, scope, threshold, and result; omit credentials.
```

## Rollback and sign-off

Alert edit/removal procedure: `TODO`

Budget-change approver: `TODO`

Action-threshold response (investigate, throttle, or pause): `TODO`

Evidence reference (redacted screenshot, ticket, or audit event): `TODO`

Verified by: `TODO`

Verified at (UTC): `TODO`

Sign-off: `TODO`

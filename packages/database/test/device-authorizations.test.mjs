import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { deviceAuthorizationEvents, deviceAuthorizations } from '../src/device-authorizations.mjs';

test('Device Authorization stores digests and lifecycle metadata in the private schema', () => {
  const columns = getTableColumns(deviceAuthorizations);
  const config = getTableConfig(deviceAuthorizations);

  assert.equal(config.schema, 'private');
  assert.deepEqual(
    Object.keys(columns),
    [
      'deviceAuthorizationId',
      'deviceCodeDigest',
      'userCodeDigest',
      'clientId',
      'requestedScopes',
      'status',
      'agentActorId',
      'approvedByActorId',
      'deniedByActorId',
      'issuedTokenId',
      'createdEventId',
      'approvalEventId',
      'consumptionEventId',
      'denialEventId',
      'createdAt',
      'expiresAt',
      'approvedAt',
      'consumedAt',
      'deniedAt',
    ],
  );
  assert.equal('deviceCode' in columns, false);
  assert.equal('userCode' in columns, false);
  assert.equal('accessToken' in columns, false);
  assert.equal(columns.deviceCodeDigest.notNull, true);
  assert.equal(columns.userCodeDigest.notNull, true);
  assert.equal(columns.requestedScopes.notNull, true);
  assert.equal(columns.expiresAt.notNull, true);

  for (const name of [
    'device_authorizations_device_code_digest_sha256',
    'device_authorizations_user_code_digest_sha256',
    'device_authorizations_requested_scopes_allowed',
    'device_authorizations_status_allowed',
    'device_authorizations_lifecycle_shape',
  ]) {
    assert.ok(config.checks.some((constraint) => constraint.name === name), `missing ${name}`);
  }
  for (const name of [
    'device_authorizations_agent_actor_id_actors_actor_id_fk',
    'device_authorizations_approved_by_actor_id_actors_actor_id_fk',
    'device_authorizations_issued_token_id_api_tokens_token_id_fk',
    'device_authorizations_approval_event_id_events_event_id_fk',
    'device_authorizations_consumption_event_id_events_event_id_fk',
  ]) {
    assert.ok(config.foreignKeys.some((constraint) => constraint.getName() === name), `missing ${name}`);
  }
});

test('Device Authorization audit records are private and link to one grant', () => {
  const columns = getTableColumns(deviceAuthorizationEvents);
  const config = getTableConfig(deviceAuthorizationEvents);

  assert.equal(config.schema, 'private');
  assert.equal(columns.eventId.primary, true);
  assert.equal(columns.deviceAuthorizationId.notNull, true);
  assert.equal(columns.eventType.notNull, true);
  assert.equal(columns.details.notNull, true);
  assert.equal(columns.occurredAt.notNull, true);
  assert.ok(config.checks.some((constraint) =>
    constraint.name === 'device_authorization_events_type_allowed'));
  assert.ok(config.foreignKeys.some((constraint) =>
    constraint.getName() === 'device_authorization_events_device_authorization_id_device_authorizations_device_authorization_id_fk'));
});

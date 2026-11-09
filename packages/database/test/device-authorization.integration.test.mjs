import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;
const rollback = new Error('rollback Device Authorization integration fixture');

function digest(value) {
  return createHash('sha256').update(value).digest('base64url');
}

test('Device Authorization approve and consume are atomic, private, and agent-bound', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    try {
      await sql.begin(async (transaction) => {
        const suffix = randomUUID();
        const humanActorId = `device-human-${suffix}`;
        const agentActorId = `device-agent-${suffix}`;
        const otherHumanActorId = `device-other-human-${suffix}`;
        const unmanagedAgentActorId = `device-unmanaged-agent-${suffix}`;
        const deviceCodeDigest = digest(`device:${suffix}`);
        const userCodeDigest = digest(`user:${suffix}`);
        const tokenHash = digest(`token:${suffix}`);
        const tokenId = randomUUID();
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + 15 * 60 * 1000);
        const approvedAt = new Date(createdAt.getTime() + 1_000);
        const consumedAt = new Date(createdAt.getTime() + 2_000);
        const tokenExpiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

        await transaction`
          INSERT INTO public.actors (
            actor_id, actor_type, identity_strength, owner_actor_id,
            created_at, updated_at
          ) VALUES
            (${humanActorId}, 'human', 'verified', NULL, ${createdAt}, ${createdAt}),
            (${agentActorId}, 'agent', 'self_declared', ${humanActorId}, ${createdAt}, ${createdAt}),
            (${otherHumanActorId}, 'human', 'verified', NULL, ${createdAt}, ${createdAt}),
            (${unmanagedAgentActorId}, 'agent', 'self_declared', ${otherHumanActorId}, ${createdAt}, ${createdAt})
        `;

        const [started] = await transaction`
          SELECT public.device_authorization_start(
            ${deviceCodeDigest},
            ${userCodeDigest},
            ${'evimesh-cli'},
            ${transaction.array(['project:read', 'profile:read'])}::text[],
            ${createdAt},
            ${expiresAt}
          ) AS result
        `;
        assert.equal(started.result.status, 'pending');
        assert.deepEqual(started.result.requestedScopes, ['profile:read', 'project:read']);
        assert.equal('deviceCodeDigest' in started.result, false);
        assert.equal('userCodeDigest' in started.result, false);
        assert.ok(started.result.createdEventId);

        const [previewed] = await transaction`
          SELECT public.device_authorization_preview(${userCodeDigest}, ${approvedAt}) AS result
        `;
        assert.equal(previewed.result.deviceAuthorizationId, started.result.deviceAuthorizationId);
        assert.equal(previewed.result.status, 'pending');

        // A rejected statement aborts its savepoint; let savepoint() roll back
        // and assert on the error it rethrows.
        await assert.rejects(
          transaction.savepoint((savepoint) => savepoint`
            SELECT public.device_authorization_approve(
              ${userCodeDigest}, ${humanActorId}, ${unmanagedAgentActorId}, ${approvedAt}
            )
          `),
          /\[DEVICE_AUTH_AGENT_NOT_MANAGED\]/,
        );
        const [afterInvalidApproval] = await transaction`
          SELECT status,
            (SELECT count(*)::int FROM private.device_authorization_events AS event
              WHERE event.device_authorization_id = grant_row.device_authorization_id) AS "auditCount"
          FROM private.device_authorizations AS grant_row
          WHERE device_authorization_id = ${started.result.deviceAuthorizationId}
        `;
        assert.deepEqual(afterInvalidApproval, { status: 'pending', auditCount: 1 });

        const [approved] = await transaction`
          SELECT public.device_authorization_approve(
            ${userCodeDigest}, ${humanActorId}, ${agentActorId}, ${approvedAt}
          ) AS result
        `;
        assert.equal(approved.result.status, 'approved');
        assert.equal(approved.result.agentActorId, agentActorId);
        assert.equal(approved.result.approvedByActorId, humanActorId);
        assert.ok(approved.result.approvalEventId);

        const [consumed] = await transaction`
          SELECT public.device_authorization_consume(
            ${deviceCodeDigest},
            ${consumedAt},
            ${tokenId},
            ${tokenHash},
            ${'evimesh_fixture_'},
            ${'Device test'},
            ${tokenExpiresAt}
          ) AS result
        `;
        assert.equal(consumed.result.status, 'consumed');
        assert.equal(consumed.result.issuedTokenId, tokenId);
        assert.ok(consumed.result.consumptionEventId);

        const [token] = await transaction`
          SELECT actor_id AS "actorId", token_hash AS "tokenHash", label, scopes,
            revoked_at AS "revokedAt", last_used_at AS "lastUsedAt"
          FROM public.api_tokens
          WHERE token_id = ${tokenId}
        `;
        assert.deepEqual(token, {
          actorId: agentActorId,
          tokenHash,
          label: 'Device test',
          scopes: ['profile:read', 'project:read'],
          revokedAt: null,
          lastUsedAt: null,
        });

        const [grant] = await transaction`
          SELECT status, device_code_digest AS "deviceCodeDigest",
            user_code_digest AS "userCodeDigest", issued_token_id AS "issuedTokenId"
          FROM private.device_authorizations
          WHERE device_authorization_id = ${started.result.deviceAuthorizationId}
        `;
        assert.equal(grant.status, 'consumed');
        assert.equal(grant.deviceCodeDigest, deviceCodeDigest);
        assert.equal(grant.userCodeDigest, userCodeDigest);
        assert.equal(grant.issuedTokenId, tokenId);

        const [auditCount] = await transaction`
          SELECT count(*)::int AS count
          FROM private.device_authorization_events
          WHERE device_authorization_id = ${started.result.deviceAuthorizationId}
        `;
        assert.equal(auditCount.count, 3);

        await assert.rejects(
          transaction.savepoint((savepoint) => savepoint`
              SELECT public.device_authorization_consume(
                ${deviceCodeDigest}, ${new Date(consumedAt.getTime() + 1)}, ${randomUUID()},
                ${digest(`second:${suffix}`)}, ${'evimesh_fixture_'}, ${'Second'}, ${tokenExpiresAt}
              )
            `),
          /\[DEVICE_AUTH_ALREADY_USED\]/,
        );

        const [afterReplay] = await transaction`
          SELECT count(*)::int AS count FROM public.api_tokens WHERE actor_id = ${agentActorId}
        `;
        assert.equal(afterReplay.count, 1);

        const [privileges] = await transaction`
          SELECT
            has_table_privilege('anon', 'private.device_authorizations', 'SELECT') AS "anonSelect",
            has_table_privilege('authenticated', 'private.device_authorizations', 'SELECT') AS "authenticatedSelect",
            has_table_privilege('service_role', 'private.device_authorizations', 'SELECT') AS "serviceSelect",
            has_function_privilege(
              'service_role',
              'public.device_authorization_consume(text,timestamp with time zone,uuid,text,text,text,timestamp with time zone)',
              'EXECUTE'
            ) AS "serviceExecute",
            has_function_privilege(
              'authenticated',
              'public.device_authorization_consume(text,timestamp with time zone,uuid,text,text,text,timestamp with time zone)',
              'EXECUTE'
            ) AS "authenticatedExecute"
        `;
        assert.deepEqual(privileges, {
          anonSelect: false,
          authenticatedSelect: false,
          serviceSelect: false,
          serviceExecute: true,
          authenticatedExecute: false,
        });

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  } finally {
    await sql.end();
  }
});

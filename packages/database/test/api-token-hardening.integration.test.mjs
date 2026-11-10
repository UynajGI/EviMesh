import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;

function digest(value) {
  return createHash('sha256').update(value).digest('base64url');
}

test('API token ACL, ownership, rotation, replay, and concurrency hardening holds in PostgreSQL', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 5 });
  try {
    const suffix = randomUUID();
    const ownerSubject = randomUUID();
    const otherSubject = randomUUID();
    const ownerId = `token-owner-${suffix}`;
    const otherOwnerId = `token-other-${suffix}`;
    const agentId = `token-agent-${suffix}`;
    const now = new Date();
    const base = new Date(now.getTime() - 60_000);
    const tokenExpiry = new Date(now.getTime() + 86_400_000);

    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO auth.users (id, email_confirmed_at)
        VALUES (${ownerSubject}, ${now}), (${otherSubject}, ${now})
      `;
      await transaction`
        INSERT INTO public.actors (
          actor_id, actor_type, identity_strength, owner_actor_id, auth_subject,
          terms_version, terms_accepted_at, profile_completed_at, created_at, updated_at
        ) VALUES
          (${ownerId}, 'human', 'verified', NULL, ${ownerSubject}, 'test-terms', ${now}, ${now}, ${now}, ${now}),
          (${otherOwnerId}, 'human', 'verified', NULL, ${otherSubject}, 'test-terms', ${now}, ${now}, ${now}, ${now}),
          (${agentId}, 'agent', 'self_declared', ${ownerId}, NULL, NULL, NULL, NULL, ${now}, ${now})
      `;
    });

    async function issueToken(index) {
      return sql.begin(async (transaction) => {
        const deviceCodeDigest = digest(`device:${suffix}:${index}`);
        const userCodeDigest = digest(`user:${suffix}:${index}`);
        const tokenId = randomUUID();
        const tokenHash = digest(`token:${suffix}:${index}`);
        const createdAt = new Date(base.getTime() + index * 5_000);
        const approvedAt = new Date(createdAt.getTime() + 1_000);
        const consumedAt = new Date(createdAt.getTime() + 2_000);
        await transaction`
          SELECT public.device_authorization_start(
            ${deviceCodeDigest}, ${userCodeDigest}, 'evimesh-cli',
            ${transaction.array(['profile:read', 'project:read'])}::text[],
            ${createdAt}, ${new Date(createdAt.getTime() + 30_000)}
          )
        `;
        await transaction`
          SELECT public.device_authorization_approve(
            ${userCodeDigest}, ${ownerId}, ${agentId}, ${approvedAt}
          )
        `;
        await transaction`
          SELECT public.device_authorization_consume(
            ${deviceCodeDigest}, ${consumedAt}, ${tokenId}, ${tokenHash},
            ${`evimesh_${String(index).padStart(8, '0')}`}, ${`Token ${index}`}, ${tokenExpiry}
          )
        `;
        return { tokenId, tokenHash };
      });
    }

    const oldToken = await issueToken(1);
    const replacementA = await issueToken(2);
    const replacementB = await issueToken(3);

    const [lookup] = await sql`SELECT public.api_token_auth_lookup(${oldToken.tokenHash}) AS result`;
    assert.equal(lookup.result.tokenId, oldToken.tokenId);
    assert.equal('tokenHash' in lookup.result, false);
    await sql`SELECT public.api_token_mark_used(${oldToken.tokenId})`;

    const [owned] = await sql`SELECT public.api_token_list_owned_agent_tokens(${ownerId}) AS result`;
    assert.equal(owned.result.length, 3);
    assert.equal(JSON.stringify(owned.result).includes(oldToken.tokenHash), false);
    const [notOwned] = await sql`SELECT public.api_token_list_owned_agent_tokens(${otherOwnerId}) AS result`;
    assert.deepEqual(notOwned.result, []);
    await assert.rejects(
      sql`SELECT public.api_token_revoke_owned_agent_token(${otherOwnerId}, ${oldToken.tokenId}, 'not mine')`,
      /\[API_TOKEN_NOT_FOUND\]/,
    );

    const rotations = await Promise.allSettled([
      sql`SELECT public.api_token_rotate_owned_agent_token(
        ${ownerId}, ${oldToken.tokenId}, ${replacementA.tokenId}, 'concurrent rotation A'
      )`,
      sql`SELECT public.api_token_rotate_owned_agent_token(
        ${ownerId}, ${oldToken.tokenId}, ${replacementB.tokenId}, 'concurrent rotation B'
      )`,
    ]);
    assert.equal(rotations.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(rotations.filter(({ status }) => status === 'rejected').length, 1);

    const [rotationState] = await sql`
      SELECT
        count(*) FILTER (WHERE token_id = ${oldToken.tokenId} AND revoked_at IS NOT NULL)::int AS "oldRevoked",
        count(*) FILTER (WHERE rotated_from_token_id = ${oldToken.tokenId})::int AS "successors"
      FROM public.api_tokens
      WHERE token_id IN (${oldToken.tokenId}, ${replacementA.tokenId}, ${replacementB.tokenId})
    `;
    assert.deepEqual(rotationState, { oldRevoked: 1, successors: 1 });
    const [successfulReplacement] = await sql`
      SELECT token_id AS "tokenId" FROM public.api_tokens
      WHERE rotated_from_token_id = ${oldToken.tokenId}
    `;
    await assert.rejects(
      sql`SELECT public.api_token_rotate_owned_agent_token(
        ${ownerId}, ${oldToken.tokenId}, ${successfulReplacement.tokenId}, 'replay'
      )`,
      /\[API_TOKEN_ROTATION_STATE_INVALID\]/,
    );

    const [privileges] = await sql`
      SELECT
        has_table_privilege('anon', 'public.api_tokens', 'SELECT') AS "anonRead",
        has_table_privilege('authenticated', 'public.api_tokens', 'SELECT') AS "authenticatedRead",
        has_table_privilege('service_role', 'public.api_tokens', 'SELECT') AS "serviceRead",
        has_table_privilege('authenticated', 'private.api_token_audit_events', 'SELECT') AS "auditRead",
        has_function_privilege('authenticated', 'public.api_token_list_owned_agent_tokens(text)', 'EXECUTE') AS "authenticatedRpc",
        has_function_privilege('service_role', 'public.api_token_list_owned_agent_tokens(text)', 'EXECUTE') AS "serviceRpc"
    `;
    assert.deepEqual(privileges, {
      anonRead: false,
      authenticatedRead: false,
      serviceRead: false,
      auditRead: false,
      authenticatedRpc: false,
      serviceRpc: true,
    });
    const [audit] = await sql`
      SELECT count(*)::int AS count FROM private.api_token_audit_events
      WHERE token_id IN (${oldToken.tokenId}, ${replacementA.tokenId}, ${replacementB.tokenId})
    `;
    assert.equal(audit.count, 6);
    await assert.rejects(
      sql`DELETE FROM private.api_token_audit_events WHERE token_id = ${oldToken.tokenId}`,
      /\[API_TOKEN_AUDIT_IMMUTABLE\]/,
    );
  } finally {
    await sql.end();
  }
});

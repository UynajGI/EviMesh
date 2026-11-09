import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;
const rollback = new Error('rollback public admission integration fixture');

test('public admission RPCs fail closed on approval and atomically persist key, invitation, membership, and audit state', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    try {
      await sql.begin(async (transaction) => {
        const suffix = randomUUID();
        const applicantId = `admission-applicant-${suffix}`;
        const stewardId = `admission-steward-${suffix}`;
        const inviteeId = `admission-invitee-${suffix}`;
        const uuidTail = suffix.replaceAll('-', '').slice(0, 12);
        const applicationProjectId = `project_018f0f4a-5c00-7000-8000-${uuidTail}`;
        const projectId = `project_018f0f4a-5c00-7001-8000-${uuidTail}`;
        const keyId = `admission-key-${suffix}`;
        const now = new Date();
        const later = (milliseconds) => new Date(now.getTime() + milliseconds);

        await transaction`
          INSERT INTO public.actors (
            actor_id, actor_type, identity_strength, terms_version,
            terms_accepted_at, profile_completed_at, created_at, updated_at
          ) VALUES
            (${applicantId}, 'human', 'verified', 'test-terms', ${now}, ${now}, ${now}, ${now}),
            (${stewardId}, 'maintainer', 'verified', 'test-terms', ${now}, ${now}, ${now}, ${now}),
            (${inviteeId}, 'human', 'verified', 'test-terms', ${now}, ${now}, ${now}, ${now})
        `;

        const [submitted] = await transaction`
          SELECT public.project_application_submit(
            ${applicantId}, ${applicationProjectId}, ${'Admission integration'}, ${'Atomic public project approval'},
            ${'CC-BY-4.0'}, ${later(1_000)}
          ) AS result
        `;
        assert.equal(submitted.result.status, 'pending');

        await assert.rejects(
          transaction.savepoint((savepoint) => savepoint`
              SELECT public.project_application_decide(
                ${submitted.result.application_id}, ${stewardId}, ${'approved'}, ${'eligible open project'}, ${later(2_000)}
              )
            `),
          /\[PROJECT_APPROVAL_GRAPH_WRITE_NOT_READY\]/,
        );
        const [rejected] = await transaction`
          SELECT public.project_application_decide(
            ${submitted.result.application_id}, ${stewardId}, ${'rejected'}, ${'awaiting graph integration'}, ${later(2_000)}
          ) AS result
        `;
        assert.equal(rejected.result.status, 'rejected');
        const [approvalGate] = await transaction`
          SELECT enabled FROM private.admission_feature_gates
          WHERE gate = 'project_approval_graph_write'
        `;
        assert.equal(approvalGate.enabled, false);

        await transaction`
          INSERT INTO public.projects (
            project_id, state, name, summary, created_by, license, created_at, updated_at
          ) VALUES (
            ${projectId}, 'active', 'Invitation fixture', 'Direct test fixture only',
            ${applicantId}, 'CC0-1.0', ${later(2_000)}, ${later(2_000)}
          )
        `;
        await transaction`
          INSERT INTO public.project_revisions (
            project_id, revision, state, name, summary, created_by, maintainer_ids, license, created_at
          ) VALUES (
            ${projectId}, 1, 'active', 'Invitation fixture', 'Direct test fixture only',
            ${applicantId}, ${JSON.stringify([applicantId])}::jsonb, 'CC0-1.0', ${later(2_000)}
          )
        `;
        await transaction`
          INSERT INTO public.project_members (
            project_id, actor_id, role, status, joined_at, created_at, updated_at
          ) VALUES (
            ${projectId}, ${applicantId}, 'owner', 'active', ${later(2_000)}, ${later(2_000)}, ${later(2_000)}
          )
        `;

        const publicKey = Buffer.concat([
          Buffer.from('302a300506032b6570032100', 'hex'),
          Buffer.alloc(32, 1),
        ]).toString('base64url');
        const [registered] = await transaction`
          SELECT public.signing_key_register(
            ${applicantId}, ${keyId}, ${publicKey}, ${'Laptop key'}, ${later(3_000)}
          ) AS result
        `;
        assert.match(registered.result.fingerprint, /^sha256:[0-9a-f]{64}$/);
        assert.equal('privateKey' in registered.result, false);
        const [listed] = await transaction`SELECT public.signing_key_list(${applicantId}) AS result`;
        assert.equal(listed.result.length, 1);
        const [revoked] = await transaction`
          SELECT public.signing_key_revoke(
            ${applicantId}, ${keyId}, ${'rotated locally'}, ${later(4_000)}
          ) AS result
        `;
        assert.equal(revoked.result.revocationReason, 'rotated locally');

        const [invited] = await transaction`
          SELECT public.project_invitation_create(
            ${projectId}, ${inviteeId}, ${applicantId}, ${'contributor'},
            ${new Date(0)}, ${later(86_400_000)}
          ) AS result
        `;
        const [accepted] = await transaction`
          SELECT public.project_invitation_respond(
            ${invited.result.invitation_id}, ${inviteeId}, ${'accepted'}, ${new Date(0)}
          ) AS result
        `;
        assert.equal(accepted.result.status, 'accepted');
        assert.ok(new Date(accepted.result.responded_at) >= new Date(invited.result.created_at));

        await transaction`
          SELECT public.project_membership_change_role(
            ${projectId}, ${inviteeId}, ${applicantId}, ${'viewer'}, ${'scope adjusted'}, ${later(7_000)}
          )
        `;
        await transaction`
          SELECT public.project_membership_remove(
            ${projectId}, ${inviteeId}, ${applicantId}, ${'left project'}, ${later(8_000)}
          )
        `;
        const [removed] = await transaction`
          SELECT role, status, removal_reason AS "removalReason"
          FROM public.project_members WHERE project_id = ${projectId} AND actor_id = ${inviteeId}
        `;
        assert.deepEqual(removed, { role: 'viewer', status: 'removed', removalReason: 'left project' });

        const [audit] = await transaction`
          SELECT count(*)::int AS count FROM private.admission_audit_events
          WHERE actor_id IN (${applicantId}, ${stewardId}, ${inviteeId})
        `;
        assert.equal(audit.count, 8);

        const [privileges] = await transaction`
          SELECT
            has_table_privilege('authenticated', 'private.project_applications', 'SELECT') AS "authenticatedTableRead",
            has_table_privilege('service_role', 'private.project_applications', 'SELECT') AS "serviceTableRead",
            has_table_privilege('authenticated', 'public.signing_keys', 'SELECT') AS "authenticatedSigningBaseRead",
            has_table_privilege('authenticated', 'public.signing_key_verification_keys', 'SELECT') AS "authenticatedSigningProjectionRead",
            has_function_privilege(
              'authenticated',
              'public.project_application_submit(text,text,text,text,text,timestamp with time zone)',
              'EXECUTE'
            ) AS "authenticatedRpc",
            has_function_privilege(
              'service_role',
              'public.project_application_submit(text,text,text,text,text,timestamp with time zone)',
              'EXECUTE'
            ) AS "serviceRpc"
        `;
        assert.deepEqual(privileges, {
          authenticatedTableRead: false,
          serviceTableRead: false,
          authenticatedSigningBaseRead: false,
          authenticatedSigningProjectionRead: true,
          authenticatedRpc: false,
          serviceRpc: true,
        });

        await assert.rejects(
          transaction.savepoint((savepoint) => savepoint`DELETE FROM private.admission_audit_events WHERE actor_id = ${applicantId}`),
          /\[ADMISSION_AUDIT_IMMUTABLE\]/,
        );
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  } finally {
    await sql.end();
  }
});

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.EVIMESH_TEST_DATABASE_URL;

test('concurrent owners cannot jointly demote/remove the final active owner', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl, { max: 4 });
  try {
    const suffix = randomUUID();
    const ownerA = `owner-a-${suffix}`;
    const ownerB = `owner-b-${suffix}`;
    const projectId = `project_018f0f4a-5c00-7002-8000-${suffix.replaceAll('-', '').slice(0, 12)}`;
    const now = new Date();

    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO public.actors (
          actor_id, actor_type, identity_strength, terms_version,
          terms_accepted_at, profile_completed_at, created_at, updated_at
        ) VALUES
          (${ownerA}, 'human', 'verified', 'test-terms', ${now}, ${now}, ${now}, ${now}),
          (${ownerB}, 'human', 'verified', 'test-terms', ${now}, ${now}, ${now}, ${now})
      `;
      await transaction`
        INSERT INTO public.projects (
          project_id, state, name, summary, created_by, license, created_at, updated_at
        ) VALUES (
          ${projectId}, 'active', 'Concurrent owner fixture', 'Integration-only lock fixture',
          ${ownerA}, 'CC0-1.0', ${now}, ${now}
        )
      `;
      await transaction`
        INSERT INTO public.project_revisions (
          project_id, revision, state, name, summary, created_by, maintainer_ids, license, created_at
        ) VALUES (
          ${projectId}, 1, 'active', 'Concurrent owner fixture', 'Integration-only lock fixture',
          ${ownerA}, ${JSON.stringify([ownerA, ownerB])}::jsonb, 'CC0-1.0', ${now}
        )
      `;
      await transaction`
        INSERT INTO public.project_members (
          project_id, actor_id, role, status, joined_at, created_at, updated_at
        ) VALUES
          (${projectId}, ${ownerA}, 'owner', 'active', ${now}, ${now}, ${now}),
          (${projectId}, ${ownerB}, 'owner', 'active', ${now}, ${now}, ${now})
      `;
    });

    const results = await Promise.allSettled([
      sql`
        SELECT public.project_membership_change_role(
          ${projectId}, ${ownerB}, ${ownerA}, 'maintainer', 'concurrent demotion', clock_timestamp()
        )
      `,
      sql`
        SELECT public.project_membership_remove(
          ${projectId}, ${ownerA}, ${ownerB}, 'concurrent removal', clock_timestamp()
        )
      `,
    ]);

    assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
    assert.equal(results.filter(({ status }) => status === 'rejected').length, 1);
    const [ownerCount] = await sql`
      SELECT count(*)::int AS count
      FROM public.project_members
      WHERE project_id = ${projectId}
        AND role = 'owner'
        AND status = 'active'
        AND deleted_at IS NULL
    `;
    assert.equal(ownerCount.count, 1);
  } finally {
    await sql.end();
  }
});

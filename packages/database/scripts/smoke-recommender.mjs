/* End-to-end smoke for the production recommendation loop:
 * seed two throwaway actors with real question refs, or (with --verify /
 * --cleanup) inspect and remove them. Never touches real actors. */
import postgres from 'postgres';

const mode = process.argv[2] ?? 'seed';
const password = process.env.EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD;
if (!password) {
  console.error('EVIMESH_SUPABASE_PRODUCTION_DB_PASSWORD is required');
  process.exit(2);
}
const sql = postgres(`postgres://postgres.rruhruccjnuffodfbkuh:${encodeURIComponent(password)}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`, { ssl: 'prefer', max: 1 });

const ACTORS = ['actor_smoke_a_20260821', 'actor_smoke_b_20260821'];

try {
  if (mode === 'seed') {
    /* The production database currently has no content rows, so the smoke
     * uses synthetic object ids: the trainer and cache pipeline do not
     * require the targets to exist (existence is enforced on the API path). */
    const questions = [1, 2, 3, 4, 5].map((n) => `question_smoke_${n}_20260821`);
    for (const actorId of ACTORS) {
      await sql`INSERT INTO actors (actor_id, actor_type, identity_strength, auth_subject)
                VALUES (${actorId}, 'human', 'self_declared', ${'smoke-' + actorId})`;
    }
    const plan = [
      [ACTORS[0], questions[0], 'helpful'],
      [ACTORS[0], questions[1], 'favorite'],
      [ACTORS[0], questions[2], 'view'],
      [ACTORS[0], questions[3], 'helpful'],
      [ACTORS[1], questions[0], 'helpful'],
      [ACTORS[1], questions[1], 'helpful'],
      [ACTORS[1], questions[2], 'favorite'],
      [ACTORS[1], questions[3], 'view'],
      [ACTORS[1], questions[4], 'helpful'],
    ];
    for (const [actorId, questionId, kind] of plan) {
      await sql`INSERT INTO engagement_interactions (interaction_id, actor_id, object_type, object_id, kind)
                VALUES (${'itx_smoke_' + Math.random().toString(36).slice(2, 12)}, ${actorId}, 'question', ${questionId}, ${kind})
                ON CONFLICT DO NOTHING`;
    }
    console.log(`seeded ${ACTORS.length} actors + ${plan.length} interactions`);
  } else if (mode === 'verify') {
    const rows = await sql`SELECT actor_id, object_type, object_id, rank, reason, model FROM recommendation_cache WHERE actor_id IN ${sql(ACTORS)} ORDER BY actor_id, rank`;
    console.log(`recommendation_cache rows for smoke actors: ${rows.length}`);
    for (const row of rows) console.log(`  ${row.actor_id} #${row.rank} ${row.object_type}:${row.object_id.slice(0, 18)} reason=${row.reason} model=${row.model}`);
    if (rows.length === 0) {
      console.error('FAIL: trainer produced no rows for the seeded actors');
      process.exitCode = 1;
    }
  } else if (mode === 'cleanup') {
    for (const actorId of ACTORS) {
      await sql`DELETE FROM actors WHERE actor_id = ${actorId}`;
    }
    const left = await sql`SELECT count(*)::int AS n FROM engagement_interactions WHERE actor_id IN ${sql(ACTORS)}`;
    console.log(`deleted smoke actors; leftover interactions: ${left[0].n}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}

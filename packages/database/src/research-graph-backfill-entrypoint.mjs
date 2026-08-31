import postgres from 'postgres';
import { runResearchGraphBackfill } from '../../domain/src/research-graph-backfill-runner.mjs';
import { createPostgresResearchGraphBackfillRepository } from './research-graph-backfill-repository.mjs';

export class ResearchGraphBackfillEntrypointError extends Error {
  constructor(message, code = 'RESEARCH_GRAPH_BACKFILL_ENTRYPOINT_INVALID') {
    super(message);
    this.name = 'ResearchGraphBackfillEntrypointError';
    this.code = code;
  }
}

export function parseResearchGraphBackfillArgs(argv = []) {
  if (!Array.isArray(argv)) throw new ResearchGraphBackfillEntrypointError('argv must be an array');
  const options = { projectId: null, pageSize: 100, dryRun: true, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--apply') options.dryRun = false;
    else if (argument === '--project') {
      const next = argv[++index];
      if (typeof next !== 'string' || next.startsWith('--')) throw new ResearchGraphBackfillEntrypointError('--project requires a value');
      options.projectId = next;
    }
    else if (argument.startsWith('--project=')) options.projectId = argument.slice('--project='.length);
    else if (argument === '--page-size') {
      const next = argv[++index];
      if (typeof next !== 'string' || next.startsWith('--')) throw new ResearchGraphBackfillEntrypointError('--page-size requires a value');
      options.pageSize = Number(next);
    }
    else if (argument.startsWith('--page-size=')) options.pageSize = Number(argument.slice('--page-size='.length));
    else throw new ResearchGraphBackfillEntrypointError(`unknown argument: ${argument}`);
  }
  if (options.help) return Object.freeze(options);
  if (typeof options.projectId !== 'string' || options.projectId.trim().length === 0) {
    throw new ResearchGraphBackfillEntrypointError('--project is required');
  }
  options.projectId = options.projectId.trim();
  if (!Number.isSafeInteger(options.pageSize) || options.pageSize < 1 || options.pageSize > 1000) {
    throw new ResearchGraphBackfillEntrypointError('--page-size must be an integer from 1 to 1000');
  }
  return Object.freeze(options);
}

export const RESEARCH_GRAPH_BACKFILL_HELP = `Usage:
  pnpm --filter @evimesh/database graph:backfill -- --project <project-id> [--page-size 100]
  pnpm --filter @evimesh/database graph:backfill -- --project <project-id> --apply

The command is dry-run by default. --apply is the only switch that persists
checkpoint, staging, crosswalk, finding, or formal DAG rows. DATABASE_URL is
required; the connection must be permitted to SET LOCAL ROLE service_role.`;

function publicSummary(result, options) {
  const plan = result.plan ?? null;
  return Object.freeze({
    mode: options.dryRun ? 'dry-run' : 'apply',
    projectId: options.projectId,
    pageSize: options.pageSize,
    dryRun: result.dryRun,
    noOp: result.noOp,
    cutoverReady: result.cutoverReady,
    checkpointPhase: result.checkpoint?.phase ?? null,
    planChecksum: plan?.planChecksum ?? result.checkpoint?.planChecksum ?? null,
    sourceCounts: plan?.sourceCounts ?? result.checkpoint?.sourceCounts ?? {},
    findings: result.audit?.findings?.length ?? 0,
    quarantined: result.audit?.records?.filter((record) => record.status === 'quarantined').length ?? 0,
  });
}

/** Injectable package-level entrypoint; tests use fakes and never connect. */
export async function runResearchGraphBackfillEntrypoint({
  argv = process.argv.slice(2),
  env = process.env,
  output = process.stdout,
  createSql = (databaseUrl) => postgres(databaseUrl, { max: 4, prepare: false }),
  createRepository = createPostgresResearchGraphBackfillRepository,
  runBackfill = runResearchGraphBackfill,
} = {}) {
  const options = parseResearchGraphBackfillArgs(argv);
  if (options.help) {
    output.write(`${RESEARCH_GRAPH_BACKFILL_HELP}\n`);
    return Object.freeze({ help: true, exitCode: 0 });
  }
  const databaseUrl = env?.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new ResearchGraphBackfillEntrypointError('DATABASE_URL is required');
  }
  const sql = createSql(databaseUrl);
  if (!sql || typeof sql.end !== 'function') throw new ResearchGraphBackfillEntrypointError('createSql must return a closable Postgres.js client');
  try {
    const repository = createRepository({ sql });
    if (!repository || typeof repository.withConsistentSnapshot !== 'function') {
      throw new ResearchGraphBackfillEntrypointError('repository must support withConsistentSnapshot');
    }
    const result = await repository.withConsistentSnapshot((snapshotRepository) => runBackfill({
      repository: snapshotRepository,
      projectId: options.projectId,
      pageSize: options.pageSize,
      dryRun: options.dryRun,
    }));
    const summary = publicSummary(result, options);
    output.write(`${JSON.stringify(summary, null, 2)}\n`);
    return Object.freeze({ result, summary, exitCode: result.cutoverReady ? 0 : 2 });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

import { semanticHash } from '../../protocol/src/hash.mjs';
import { RESEARCH_NODE_KINDS } from '../../protocol/src/research-graph.mjs';

const SERVICE_ROLE = 'service_role';
const MAX_PAGE_SIZE = 1000;
const SNAPSHOT_ID = /^[0-9a-f-]+$/i;

export class ResearchGraphBackfillRepositoryError extends Error {
  constructor(message, code = 'RESEARCH_GRAPH_BACKFILL_REPOSITORY_INVALID', status = 500) {
    super(message);
    this.name = 'ResearchGraphBackfillRepositoryError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ResearchGraphBackfillRepositoryError(`${field} must be a non-empty string`, 'RESEARCH_GRAPH_BACKFILL_REPOSITORY_INPUT', 400);
  }
  return value.trim();
}

function requiredPositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ResearchGraphBackfillRepositoryError(`${field} must be a positive safe integer`, 'RESEARCH_GRAPH_BACKFILL_REPOSITORY_INPUT', 400);
  }
  return value;
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function iso(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new ResearchGraphBackfillRepositoryError('database returned an invalid timestamp');
  return date.toISOString();
}

function plain(value) {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return Object.freeze({ encoding: 'base64', value: value.toString('base64') });
  if (value instanceof Uint8Array) return Object.freeze({ encoding: 'base64', value: Buffer.from(value).toString('base64') });
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  throw new ResearchGraphBackfillRepositoryError(`database returned unsupported ${typeof value}`);
}

function encodeCursor(key) {
  return Buffer.from(JSON.stringify({ version: 1, key }), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (cursor === null || cursor === undefined) return '';
  try {
    const parsed = JSON.parse(Buffer.from(requiredText(cursor, 'backfill cursor'), 'base64url').toString('utf8'));
    if (parsed?.version !== 1 || typeof parsed.key !== 'string' || parsed.key.length === 0) throw new TypeError('invalid cursor payload');
    return parsed.key;
  } catch {
    throw new ResearchGraphBackfillRepositoryError('backfill cursor is invalid', 'RESEARCH_GRAPH_BACKFILL_CURSOR_INVALID', 400);
  }
}

function assertSqlClient(sql) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') {
    throw new ResearchGraphBackfillRepositoryError('a Postgres.js client with begin() is required');
  }
}

async function setServiceRole(tx, { verify = true } = {}) {
  if (!tx || typeof tx.unsafe !== 'function') throw new ResearchGraphBackfillRepositoryError('Postgres transaction executor is invalid');
  await tx.unsafe('SET LOCAL ROLE service_role');
  if (!verify) return;
  await assertServiceRole(tx);
}

async function assertServiceRole(tx) {
  const rows = await tx.unsafe('SELECT current_role::text AS "currentRole"');
  if (rows?.[0]?.currentRole !== SERVICE_ROLE) {
    throw new ResearchGraphBackfillRepositoryError('backfill repository must execute as service_role', 'RESEARCH_GRAPH_BACKFILL_SERVICE_ROLE_REQUIRED', 403);
  }
}

function rowValue(row, ...names) {
  for (const name of names) if (row?.[name] !== undefined && row?.[name] !== null) return row[name];
  return null;
}

function actorFromPayload(payload) {
  return rowValue(payload, 'createdBy', 'created_by', 'actorId', 'actor_id');
}

function createdAtFromPayload(payload, fallback) {
  return rowValue(payload, 'createdAt', 'created_at') ?? fallback;
}

function edgeIdentity(edge) {
  return `edge_${semanticHash({ schema: 'evimesh.research-edge.v1', ...edge })}`;
}

function compareRank(left, right) {
  const leftCommit = BigInt(left.commitRank);
  const rightCommit = BigInt(right.commitRank);
  if (leftCommit !== rightCommit) return leftCommit < rightCommit ? -1 : 1;
  return Number(left.batchRank) - Number(right.batchRank);
}

function checkpointRow(row) {
  if (!row) return null;
  return plain({
    schemaVersion: row.schemaVersion,
    projectId: row.projectId,
    phase: row.phase,
    cursors: row.cursors,
    completedSources: row.completedSources,
    sourceCounts: row.sourceCounts,
    sourceChecksums: row.sourceChecksums,
    planChecksum: row.planChecksum,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  });
}

function stagingRow(row) {
  if (!row) return null;
  return plain({
    projectId: row.projectId,
    source: row.source,
    sourceKey: row.sourceKey,
    sourcePayload: row.sourcePayload,
    sourceChecksum: row.sourceChecksum,
    scannedAt: row.scannedAt,
  });
}

const CHECKPOINT_SELECT = `
SELECT project_id AS "projectId", schema_version AS "schemaVersion", phase,
  cursors, completed_sources AS "completedSources", source_counts AS "sourceCounts",
  source_checksums AS "sourceChecksums", plan_checksum AS "planChecksum",
  created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
FROM private.research_graph_backfill_checkpoints`;

const LEGACY_EVENT_MATCH = Object.freeze({
  claim_relation: `
    SELECT CASE WHEN count(*) = 1 THEN min(event_id) END
    FROM public.research_events AS event
    WHERE event.event_type = 'claim.relation.created'
      AND event.payload->>'source_claim_id' = relation.source_claim_id
      AND event.payload->>'target_claim_id' = relation.target_claim_id
      AND event.payload->>'relation_type' = relation.relation_type`,
  evidence_claim_link: `
    SELECT CASE WHEN count(*) = 1 THEN min(event_id) END
    FROM public.research_events AS event
    WHERE event.event_type = 'evidence.claim_linked'
      AND event.payload->>'evidence_id' = link.evidence_id
      AND event.payload->>'claim_id' = link.claim_id
      AND event.payload->>'claim_revision' = link.claim_revision::text
      AND event.payload->>'relation_type' = link.relation_type`,
  challenge_revision: `
    SELECT CASE WHEN count(*) = 1 THEN min(event_id) END
    FROM public.research_events AS event
    WHERE event.event_type IN ('challenge.created', 'challenge.upheld', 'challenge.state_changed')
      AND event.payload->>'challenge_id' = revision.challenge_id
      AND event.payload->>'revision' = revision.revision::text
      AND event.payload->>'target_claim_id' = revision.target_claim_id
      AND event.payload->>'target_claim_revision' = revision.target_claim_revision::text`,
  run: `
    SELECT CASE WHEN count(*) = 1 THEN min(event_id) END
    FROM public.research_events AS event
    WHERE event.event_type = 'run.created'
      AND event.payload->>'run_id' = run.run_id`,
});

export const LEGACY_RESEARCH_NODE_SCANNER_COVERAGE = Object.freeze(Object.fromEntries(RESEARCH_NODE_KINDS.map((kind) => [kind, Object.freeze(
  ['answer', 'rebuttal', 'evaluation', 'dataset', 'tool'].includes(kind)
    ? { status: 'not_applicable', source: null, reason: 'v2.1-native kind has no legacy source table' }
    : kind === 'research_contract'
      ? { status: 'quarantine_when_present', source: 'research_contracts/research_contract_revisions', reason: 'legacy schema has no project ownership key' }
      : { status: 'supported', source: 'strong typed legacy table' },
)])));

const NODE_SCAN_SQL = `
WITH artifact_projects AS (
  SELECT artifact_id, min(project_id) AS project_id, count(DISTINCT project_id) AS project_count
  FROM (
    SELECT io.artifact_id, question.project_id
    FROM (
      SELECT run_id,artifact_id FROM public.run_inputs
      UNION ALL SELECT run_id,artifact_id FROM public.run_outputs
    ) AS io
    JOIN public.runs AS run ON run.run_id=io.run_id
    JOIN public.tasks AS task ON task.task_id=run.task_id
    JOIN public.questions AS question ON question.question_id=task.question_id
    UNION ALL
    SELECT evidence.artifact_id, question.project_id
    FROM public.evidence
    JOIN public.evidence_claim_links AS link ON link.evidence_id=evidence.evidence_id
    JOIN public.claims AS claim ON claim.claim_id=link.claim_id
    JOIN public.questions AS question ON question.question_id=claim.question_id
  ) AS ownership GROUP BY artifact_id
), evidence_projects AS (
  SELECT evidence_id,min(project_id) AS project_id,count(DISTINCT project_id) AS project_count
  FROM (
    SELECT evidence.evidence_id,question.project_id FROM public.evidence
    JOIN public.evidence_claim_links AS link ON link.evidence_id=evidence.evidence_id
    JOIN public.claims AS claim ON claim.claim_id=link.claim_id
    JOIN public.questions AS question ON question.question_id=claim.question_id
    UNION ALL
    SELECT evidence.evidence_id,question.project_id FROM public.evidence
    JOIN public.runs AS run ON run.run_id=evidence.run_id
    JOIN public.tasks AS task ON task.task_id=run.task_id
    JOIN public.questions AS question ON question.question_id=task.question_id
  ) AS ownership GROUP BY evidence_id
), verification_contract_projects AS (
  SELECT contract_id,min(question.project_id) AS project_id,count(DISTINCT question.project_id) AS project_count
  FROM public.verification_receipts AS receipt
  JOIN public.claims AS claim ON claim.claim_id=receipt.claim_id
  JOIN public.questions AS question ON question.question_id=claim.question_id
  GROUP BY contract_id
), verification_policy_projects AS (
  SELECT policy_id,min(project_id) AS project_id,count(DISTINCT project_id) AS project_count
  FROM (
    SELECT proposal.policy_id,question.project_id
    FROM public.merge_proposals AS proposal
    JOIN public.claims AS claim ON claim.claim_id=proposal.claim_id
    JOIN public.questions AS question ON question.question_id=claim.question_id
    UNION ALL
    SELECT evaluation.policy_id,question.project_id
    FROM public.policy_evaluations AS evaluation
    JOIN public.claims AS claim ON claim.claim_id=evaluation.claim_id
    JOIN public.questions AS question ON question.question_id=claim.question_id
  ) AS ownership GROUP BY policy_id
), base AS (
  SELECT 'project'::text AS kind,revision.project_id AS id,revision.revision,revision.project_id,
    project.created_by AS stable_created_by,project.created_at AS stable_created_at,project.deleted_at AS retired_at,
    revision.created_by,revision.created_at,revision.name AS label,revision.state::text AS state,
    '/projects/'||revision.project_id AS canonical_href,to_jsonb(revision) AS content,
    'project.'::text AS event_prefix,'project_id'::text AS event_id_key,true AS event_has_revision,
    'supported'::text AS coverage_status,NULL::text AS coverage_reason
  FROM public.project_revisions AS revision JOIN public.projects AS project USING(project_id)
  WHERE revision.project_id=$1
  UNION ALL
  SELECT 'question',revision.question_id,revision.revision,question.project_id,question.created_by,question.created_at,question.deleted_at,
    revision.created_by,revision.created_at,revision.title,revision.state::text,'/questions/'||revision.question_id,to_jsonb(revision),
    'question.','question_id',true,'supported',NULL
  FROM public.question_revisions AS revision JOIN public.questions AS question USING(question_id) WHERE question.project_id=$1
  UNION ALL
  SELECT 'task',revision.task_id,revision.revision,question.project_id,task.created_by,task.created_at,task.deleted_at,
    revision.created_by,revision.created_at,revision.title,revision.state::text,'/tasks/'||revision.task_id,to_jsonb(revision),
    'task.','task_id',true,'supported',NULL
  FROM public.task_revisions AS revision JOIN public.tasks AS task USING(task_id)
  JOIN public.questions AS question ON question.question_id=COALESCE(revision.question_id,task.question_id) WHERE question.project_id=$1
  UNION ALL
  SELECT 'claim',revision.claim_id,revision.revision,question.project_id,claim.created_by,claim.created_at,claim.deleted_at,
    revision.created_by,revision.created_at,revision.statement,revision.state::text,'/claims/'||revision.claim_id,to_jsonb(revision),
    'claim.','claim_id',true,'supported',NULL
  FROM public.claim_revisions AS revision JOIN public.claims AS claim USING(claim_id)
  JOIN public.questions AS question ON question.question_id=COALESCE(revision.question_id,claim.question_id) WHERE question.project_id=$1
  UNION ALL
  SELECT 'artifact',revision.artifact_id,revision.revision,ownership.project_id,artifact.created_by,artifact.created_at,artifact.deleted_at,
    revision.created_by,revision.created_at,COALESCE(revision.description,revision.artifact_type::text||' artifact'),
    'published','/artifacts/'||revision.artifact_id,to_jsonb(revision),'artifact.','artifact_id',true,'supported',NULL
  FROM public.artifact_revisions AS revision JOIN public.artifacts AS artifact USING(artifact_id)
  JOIN artifact_projects AS ownership USING(artifact_id) WHERE ownership.project_id=$1 AND ownership.project_count=1
  UNION ALL
  SELECT 'attempt',attempt.attempt_id,1,question.project_id,attempt.actor_id,attempt.created_at,attempt.deleted_at,
    attempt.actor_id,attempt.created_at,'Attempt '||attempt.attempt_id,CASE WHEN attempt.deleted_at IS NULL THEN 'published' ELSE 'retracted' END,
    '/attempts/'||attempt.attempt_id,to_jsonb(attempt),'attempt.created','attempt_id',false,'supported',NULL
  FROM public.attempts AS attempt JOIN public.tasks AS task USING(task_id)
  JOIN public.questions AS question ON question.question_id=task.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'context_bundle',bundle.context_bundle_id,1,question.project_id,NULL,bundle.created_at,NULL,NULL,bundle.created_at,
    'Context bundle '||bundle.context_bundle_id,'published','/context-bundles/'||bundle.context_bundle_id,to_jsonb(bundle),
    'context_bundle.created','context_bundle_id',false,'supported',NULL
  FROM public.context_bundles AS bundle JOIN public.tasks AS task USING(task_id)
  JOIN public.questions AS question ON question.question_id=task.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'run',run.run_id,1,question.project_id,NULL,run.started_at,NULL,NULL,run.started_at,
    'Run '||run.run_id,'published','/runs/'||run.run_id,to_jsonb(run),'run.created','run_id',false,'supported',NULL
  FROM public.runs AS run JOIN public.tasks AS task USING(task_id)
  JOIN public.questions AS question ON question.question_id=task.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'evidence',evidence.evidence_id,1,ownership.project_id,evidence.created_by,evidence.created_at,NULL,evidence.created_by,evidence.created_at,
    evidence.evidence_type::text||' evidence','published','/evidence/'||evidence.evidence_id,to_jsonb(evidence),
    'evidence.created','evidence_id',false,'supported',NULL
  FROM public.evidence JOIN evidence_projects AS ownership USING(evidence_id) WHERE ownership.project_id=$1 AND ownership.project_count=1
  UNION ALL
  SELECT 'verification_contract',revision.contract_id,revision.revision,ownership.project_id,contract.created_by,contract.created_at,contract.deleted_at,
    revision.created_by,revision.created_at,'Verification contract '||revision.contract_id,'published','/verification-contracts/'||revision.contract_id,
    to_jsonb(revision),'verification_contract.','contract_id',true,'supported',NULL
  FROM public.verification_contract_revisions AS revision JOIN public.verification_contracts AS contract USING(contract_id)
  JOIN verification_contract_projects AS ownership USING(contract_id) WHERE ownership.project_id=$1 AND ownership.project_count=1
  UNION ALL
  SELECT 'verification_policy',revision.policy_id,revision.revision,ownership.project_id,policy.created_by,policy.created_at,policy.deleted_at,
    revision.created_by,revision.created_at,'Verification policy '||revision.policy_id,'published','/verification-policies/'||revision.policy_id,
    to_jsonb(revision),'verification_policy.','policy_id',true,'supported',NULL
  FROM public.verification_policy_revisions AS revision JOIN public.verification_policies AS policy USING(policy_id)
  JOIN verification_policy_projects AS ownership USING(policy_id) WHERE ownership.project_id=$1 AND ownership.project_count=1
  UNION ALL
  SELECT 'policy_evaluation',evaluation.evaluation_id,1,question.project_id,NULL,evaluation.created_at,NULL,NULL,evaluation.created_at,
    'Policy evaluation '||evaluation.evaluation_id,'published','/policy-evaluations/'||evaluation.evaluation_id,to_jsonb(evaluation),
    'policy.evaluated','evaluation_id',false,'supported',NULL
  FROM public.policy_evaluations AS evaluation JOIN public.claims AS claim USING(claim_id)
  JOIN public.questions AS question ON question.question_id=claim.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'verification_receipt',receipt.receipt_id,1,question.project_id,receipt.created_by,receipt.created_at,NULL,receipt.created_by,receipt.created_at,
    'Verification receipt '||receipt.receipt_id,'published','/verifications/'||receipt.receipt_id,to_jsonb(receipt),
    'verification.submitted','receipt_id',false,'supported',NULL
  FROM public.verification_receipts AS receipt JOIN public.claims AS claim USING(claim_id)
  JOIN public.questions AS question ON question.question_id=claim.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'verification_finding',finding.finding_id,1,question.project_id,NULL,finding.created_at,NULL,NULL,finding.created_at,
    finding.code,'published','/verification-findings/'||finding.finding_id,to_jsonb(finding),
    'verification.finding_created','finding_id',false,'supported',NULL
  FROM public.verification_findings AS finding JOIN public.verification_receipts AS receipt USING(receipt_id)
  JOIN public.claims AS claim USING(claim_id) JOIN public.questions AS question ON question.question_id=claim.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'challenge',revision.challenge_id,revision.revision,question.project_id,challenge.created_by,challenge.created_at,challenge.deleted_at,
    revision.created_by,revision.created_at,'Challenge: '||revision.reason,'published','/challenges/'||revision.challenge_id,to_jsonb(revision),
    'challenge.','challenge_id',true,'supported',NULL
  FROM public.challenge_revisions AS revision JOIN public.challenges AS challenge USING(challenge_id)
  JOIN public.claims AS claim ON claim.claim_id=revision.target_claim_id
  JOIN public.questions AS question ON question.question_id=claim.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'merge_proposal',proposal.proposal_id,1,question.project_id,proposal.created_by,proposal.created_at,proposal.deleted_at,
    proposal.created_by,proposal.created_at,'Merge proposal '||proposal.proposal_id,
    CASE WHEN proposal.deleted_at IS NULL THEN 'published' ELSE 'retracted' END,'/merge-proposals/'||proposal.proposal_id,to_jsonb(proposal),
    'merge_proposal.created','proposal_id',false,'supported',NULL
  FROM public.merge_proposals AS proposal JOIN public.claims AS claim USING(claim_id)
  JOIN public.questions AS question ON question.question_id=claim.question_id WHERE question.project_id=$1
  UNION ALL
  SELECT 'frontier_snapshot',snapshot.snapshot_id,1,snapshot.project_id,snapshot.created_by,snapshot.created_at,NULL,
    snapshot.created_by,snapshot.created_at,'Frontier snapshot '||snapshot.sequence::text,'published','/frontier-snapshots/'||snapshot.snapshot_id,
    to_jsonb(snapshot),'frontier.created','snapshot_id',false,'supported',NULL
  FROM public.frontier_snapshots AS snapshot WHERE snapshot.project_id=$1
  UNION ALL
  SELECT 'project','coverage:'||project.project_id||':project-revision',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Project without a revision','published','/projects/'||project.project_id,
    jsonb_build_object('missing_revision_count',1),'project.','project_id',false,'unsupported','legacy Project has no revision to preserve'
  FROM public.projects AS project WHERE project.project_id=$1 AND NOT EXISTS (
    SELECT 1 FROM public.project_revisions AS revision WHERE revision.project_id=project.project_id)
  UNION ALL
  SELECT 'question','coverage:'||project.project_id||':question-revision',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Questions without revisions','published','/questions/coverage:'||project.project_id,
    jsonb_build_object('missing_revision_count',(SELECT count(*) FROM public.questions AS node WHERE node.project_id=$1 AND NOT EXISTS (SELECT 1 FROM public.question_revisions AS revision WHERE revision.question_id=node.question_id))),
    'question.','question_id',false,'unsupported','legacy Question stable rows without revisions cannot be projected'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.questions AS node WHERE node.project_id=$1 AND NOT EXISTS (SELECT 1 FROM public.question_revisions AS revision WHERE revision.question_id=node.question_id))
  UNION ALL
  SELECT 'task','coverage:'||project.project_id||':task-revision',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Tasks without revisions','published','/tasks/coverage:'||project.project_id,
    jsonb_build_object('missing_revision_count',(SELECT count(*) FROM public.tasks AS node JOIN public.questions AS question USING(question_id) WHERE question.project_id=$1 AND NOT EXISTS (SELECT 1 FROM public.task_revisions AS revision WHERE revision.task_id=node.task_id))),
    'task.','task_id',false,'unsupported','legacy Task stable rows without revisions cannot be projected'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.tasks AS node JOIN public.questions AS question USING(question_id) WHERE question.project_id=$1 AND NOT EXISTS (SELECT 1 FROM public.task_revisions AS revision WHERE revision.task_id=node.task_id))
  UNION ALL
  SELECT 'task','coverage:'||project.project_id||':task-ownership',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Unscoped legacy tasks','published','/tasks/coverage:'||project.project_id,
    jsonb_build_object('unscoped_revision_count',(SELECT count(*) FROM public.task_revisions AS revision JOIN public.tasks AS node USING(task_id) WHERE COALESCE(revision.question_id,node.question_id) IS NULL),
      'unscoped_stable_count',(SELECT count(*) FROM public.tasks AS node WHERE node.question_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.task_revisions AS revision WHERE revision.task_id=node.task_id))),
    'task.','task_id',false,'unsupported','legacy Task has no project ownership evidence'
  FROM public.projects AS project WHERE project.project_id=$1 AND (
    EXISTS (SELECT 1 FROM public.task_revisions AS revision JOIN public.tasks AS node USING(task_id) WHERE COALESCE(revision.question_id,node.question_id) IS NULL)
    OR EXISTS (SELECT 1 FROM public.tasks AS node WHERE node.question_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.task_revisions AS revision WHERE revision.task_id=node.task_id)))
  UNION ALL
  SELECT 'claim','coverage:'||project.project_id||':claim-revision',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Claims without revisions','published','/claims/coverage:'||project.project_id,
    jsonb_build_object('missing_revision_count',(SELECT count(*) FROM public.claims AS node JOIN public.questions AS question USING(question_id) WHERE question.project_id=$1 AND NOT EXISTS (SELECT 1 FROM public.claim_revisions AS revision WHERE revision.claim_id=node.claim_id))),
    'claim.','claim_id',false,'unsupported','legacy Claim stable rows without revisions cannot be projected'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.claims AS node JOIN public.questions AS question USING(question_id) WHERE question.project_id=$1 AND NOT EXISTS (SELECT 1 FROM public.claim_revisions AS revision WHERE revision.claim_id=node.claim_id))
  UNION ALL
  SELECT 'claim','coverage:'||project.project_id||':claim-ownership',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Unscoped legacy claims','published','/claims/coverage:'||project.project_id,
    jsonb_build_object('unscoped_revision_count',(SELECT count(*) FROM public.claim_revisions AS revision JOIN public.claims AS node USING(claim_id) WHERE COALESCE(revision.question_id,node.question_id) IS NULL),
      'unscoped_stable_count',(SELECT count(*) FROM public.claims AS node WHERE node.question_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.claim_revisions AS revision WHERE revision.claim_id=node.claim_id))),
    'claim.','claim_id',false,'unsupported','legacy Claim has no project ownership evidence'
  FROM public.projects AS project WHERE project.project_id=$1 AND (
    EXISTS (SELECT 1 FROM public.claim_revisions AS revision JOIN public.claims AS node USING(claim_id) WHERE COALESCE(revision.question_id,node.question_id) IS NULL)
    OR EXISTS (SELECT 1 FROM public.claims AS node WHERE node.question_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.claim_revisions AS revision WHERE revision.claim_id=node.claim_id)))
  UNION ALL
  SELECT 'challenge','coverage:'||project.project_id||':challenge-revision',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Challenges without revisions','published','/challenges/coverage:'||project.project_id,
    jsonb_build_object('unscoped_missing_revision_count',(SELECT count(*) FROM public.challenges AS node WHERE NOT EXISTS (SELECT 1 FROM public.challenge_revisions AS revision WHERE revision.challenge_id=node.challenge_id))),
    'challenge.','challenge_id',false,'unsupported','legacy Challenge stable rows without revisions have neither revision content nor project ownership evidence'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.challenges AS node WHERE NOT EXISTS (SELECT 1 FROM public.challenge_revisions AS revision WHERE revision.challenge_id=node.challenge_id))
  UNION ALL
  SELECT 'research_contract','coverage:'||project.project_id||':research-contract',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Unsupported legacy research contracts','published','/contracts/coverage:'||project.project_id,
    jsonb_build_object('unscoped_count',(SELECT count(*) FROM public.research_contract_revisions)),
    'contract.','contract_id',false,'unsupported','legacy research_contract rows have no project ownership key'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (SELECT 1 FROM public.research_contract_revisions)
  UNION ALL
  SELECT 'artifact','coverage:'||project.project_id||':artifact-ownership',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Ambiguous legacy artifacts','published','/artifacts/coverage:'||project.project_id,
    jsonb_build_object('unscoped_or_shared_count',(SELECT count(*) FROM public.artifacts AS artifact LEFT JOIN artifact_projects AS ownership USING(artifact_id) WHERE ownership.project_id IS NULL OR ownership.project_count<>1)),
    'artifact.','artifact_id',false,'unsupported','legacy Artifact has no unique project ownership evidence'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.artifacts AS artifact LEFT JOIN artifact_projects AS ownership USING(artifact_id)
    WHERE ownership.project_id IS NULL OR ownership.project_count<>1)
  UNION ALL
  SELECT 'artifact','coverage:'||project.project_id||':artifact-revision',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Artifacts without revisions','published','/artifacts/coverage:'||project.project_id,
    jsonb_build_object('missing_revision_count',(SELECT count(*) FROM public.artifacts AS node JOIN artifact_projects AS ownership USING(artifact_id) WHERE ownership.project_id=$1 AND ownership.project_count=1 AND NOT EXISTS (SELECT 1 FROM public.artifact_revisions AS revision WHERE revision.artifact_id=node.artifact_id))),
    'artifact.','artifact_id',false,'unsupported','legacy Artifact stable rows without revisions cannot be projected'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.artifacts AS node JOIN artifact_projects AS ownership USING(artifact_id) WHERE ownership.project_id=$1 AND ownership.project_count=1 AND NOT EXISTS (SELECT 1 FROM public.artifact_revisions AS revision WHERE revision.artifact_id=node.artifact_id))
  UNION ALL
  SELECT 'evidence','coverage:'||project.project_id||':evidence-ownership',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Ambiguous legacy evidence','published','/evidence/coverage:'||project.project_id,
    jsonb_build_object('unscoped_or_shared_count',(SELECT count(*) FROM public.evidence AS node LEFT JOIN evidence_projects AS ownership USING(evidence_id) WHERE ownership.project_id IS NULL OR ownership.project_count<>1)),
    'evidence.created','evidence_id',false,'unsupported','legacy Evidence has no unique project ownership evidence'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.evidence AS node LEFT JOIN evidence_projects AS ownership USING(evidence_id) WHERE ownership.project_id IS NULL OR ownership.project_count<>1)
  UNION ALL
  SELECT 'verification_contract','coverage:'||project.project_id||':verification-contract-ownership',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Ambiguous verification contracts','published','/verification-contracts/coverage:'||project.project_id,
    jsonb_build_object('unscoped_or_shared_count',(SELECT count(*) FROM public.verification_contracts AS node LEFT JOIN verification_contract_projects AS ownership USING(contract_id) WHERE ownership.project_id IS NULL OR ownership.project_count<>1)),
    'verification_contract.','contract_id',false,'unsupported','legacy VerificationContract has no unique project ownership evidence'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.verification_contracts AS node LEFT JOIN verification_contract_projects AS ownership USING(contract_id) WHERE ownership.project_id IS NULL OR ownership.project_count<>1)
  UNION ALL
  SELECT 'verification_policy','coverage:'||project.project_id||':verification-policy-ownership',1,project.project_id,project.created_by,project.created_at,NULL,
    project.created_by,project.created_at,'Ambiguous verification policies','published','/verification-policies/coverage:'||project.project_id,
    jsonb_build_object('unscoped_or_shared_count',(SELECT count(*) FROM public.verification_policies AS node LEFT JOIN verification_policy_projects AS ownership USING(policy_id) WHERE ownership.project_id IS NULL OR ownership.project_count<>1)),
    'verification_policy.','policy_id',false,'unsupported','legacy VerificationPolicy has no unique project ownership evidence'
  FROM public.projects AS project WHERE project.project_id=$1 AND EXISTS (
    SELECT 1 FROM public.verification_policies AS node LEFT JOIN verification_policy_projects AS ownership USING(policy_id) WHERE ownership.project_id IS NULL OR ownership.project_count<>1)
), matched AS (
  SELECT base.*,event.event_id,event.hash AS event_hash,event.signature AS event_signature,event.payload AS event_payload
  FROM base LEFT JOIN LATERAL (
    SELECT CASE WHEN count(*)=1 THEN min(event_id) END AS event_id,
      CASE WHEN count(*)=1 THEN min(hash) END AS hash,
      CASE WHEN count(*)=1 THEN (jsonb_agg(signature ORDER BY event_id)->0) END AS signature,
      CASE WHEN count(*)=1 THEN (jsonb_agg(payload ORDER BY event_id)->0) END AS payload
    FROM public.research_events
    WHERE (event_type=base.event_prefix OR (base.event_has_revision AND event_type LIKE base.event_prefix||'%'))
      AND payload->>base.event_id_key=base.id
      AND (NOT base.event_has_revision OR payload->>'revision'=base.revision::text)
  ) AS event ON true
), source_rows AS (
  SELECT kind||'|'||id||'|'||lpad(revision::text,12,'0') AS scan_key,
    kind,id,revision,project_id AS "projectId",stable_created_by AS "stableCreatedBy",stable_created_at AS "stableCreatedAt",
    retired_at AS "retiredAt",COALESCE(created_by,event_payload->>'actor_id') AS "createdBy",created_at AS "createdAt",
    label,state,canonical_href AS "canonicalHref",content,event_id AS "sourceEventId",event_hash AS "sourceEventHash",
    event_signature AS "sourceSignature",coverage_status AS "coverageStatus",coverage_reason AS "coverageReason"
  FROM matched
)
SELECT * FROM source_rows WHERE scan_key>$2 ORDER BY scan_key LIMIT $3`;

const SCAN_SQL = Object.freeze({
  research_node: NODE_SCAN_SQL,
  claim_relation: `
WITH source_rows AS (
  SELECT concat_ws('|', relation.source_claim_id, relation.relation_type, relation.target_claim_id) AS scan_key,
    relation.source_claim_id AS "sourceClaimId", NULL::integer AS "sourceRevision",
    relation.target_claim_id AS "targetClaimId", NULL::integer AS "targetRevision",
    relation.relation_type AS "relationType", relation.created_by AS "createdBy",
    relation.created_at AS "createdAt", relation.updated_at AS "updatedAt", relation.deleted_at AS "deletedAt",
    (${LEGACY_EVENT_MATCH.claim_relation}) AS "provenanceEventId"
  FROM public.claim_relations AS relation
  LEFT JOIN private.research_nodes AS source_node ON source_node.node_kind='claim' AND source_node.node_id=relation.source_claim_id
  LEFT JOIN public.claims AS source_claim ON source_claim.claim_id = relation.source_claim_id
  LEFT JOIN public.questions AS source_question ON source_question.question_id = source_claim.question_id
  WHERE COALESCE(source_node.project_id, source_question.project_id) = $1
)
SELECT * FROM source_rows WHERE scan_key > $2 ORDER BY scan_key LIMIT $3`,
  evidence_claim_link: `
WITH source_rows AS (
  SELECT concat_ws('|', link.evidence_id, link.relation_type, link.claim_id, link.claim_revision::text) AS scan_key,
    link.evidence_id AS "evidenceId", link.claim_id AS "claimId", link.claim_revision AS "claimRevision",
    link.relation_type AS "relationType", link.created_by AS "createdBy", link.created_at AS "createdAt",
    (${LEGACY_EVENT_MATCH.evidence_claim_link}) AS "provenanceEventId"
  FROM public.evidence_claim_links AS link
  LEFT JOIN private.research_nodes AS claim_node ON claim_node.node_kind='claim' AND claim_node.node_id=link.claim_id
  LEFT JOIN public.claims AS claim ON claim.claim_id = link.claim_id
  LEFT JOIN public.questions AS question ON question.question_id = claim.question_id
  WHERE COALESCE(claim_node.project_id, question.project_id) = $1
)
SELECT * FROM source_rows WHERE scan_key > $2 ORDER BY scan_key LIMIT $3`,
  challenge_revision: `
WITH source_rows AS (
  SELECT concat_ws('|', revision.challenge_id, lpad(revision.revision::text, 12, '0')) AS scan_key,
    revision.challenge_id AS "challengeId", revision.revision AS "challengeRevision",
    revision.target_claim_id AS "targetClaimId", revision.target_claim_revision AS "targetClaimRevision",
    revision.state, revision.reason, revision.impact, revision.proposed_resolution AS "proposedResolution",
    revision.created_by AS "createdBy", revision.created_at AS "createdAt",
    challenge.created_at AS "nodeCreatedAt", challenge.deleted_at AS "deletedAt",
    (${LEGACY_EVENT_MATCH.challenge_revision}) AS "provenanceEventId"
  FROM public.challenge_revisions AS revision
  JOIN public.challenges AS challenge ON challenge.challenge_id = revision.challenge_id
  LEFT JOIN private.research_nodes AS claim_node ON claim_node.node_kind='claim' AND claim_node.node_id=revision.target_claim_id
  LEFT JOIN public.claims AS claim ON claim.claim_id = revision.target_claim_id
  LEFT JOIN public.questions AS question ON question.question_id = claim.question_id
  WHERE COALESCE(claim_node.project_id, question.project_id) = $1
)
SELECT * FROM source_rows WHERE scan_key > $2 ORDER BY scan_key LIMIT $3`,
  challenge_impact: `
WITH source_rows AS (
  SELECT impact.impact_id AS scan_key, impact.impact_id AS "impactId",
    impact.challenge_id AS "challengeId", impact.challenge_revision AS "challengeRevision",
    impact.claim_id AS "claimId", impact.claim_revision AS "claimRevision",
    impact.impact_type AS "impactType", impact.reason, impact.details, impact.created_at AS "createdAt"
  FROM public.challenge_impacts AS impact
  JOIN public.challenge_revisions AS challenge_revision
    ON challenge_revision.challenge_id = impact.challenge_id AND challenge_revision.revision = impact.challenge_revision
  LEFT JOIN private.research_nodes AS target_node ON target_node.node_kind='claim' AND target_node.node_id=challenge_revision.target_claim_id
  LEFT JOIN public.claims AS target_claim ON target_claim.claim_id = challenge_revision.target_claim_id
  LEFT JOIN public.questions AS target_question ON target_question.question_id = target_claim.question_id
  WHERE COALESCE(target_node.project_id, target_question.project_id) = $1
)
SELECT * FROM source_rows WHERE scan_key > $2 ORDER BY scan_key LIMIT $3`,
  task_dependency: `
WITH source_rows AS (
  SELECT concat_ws('|', dependency.source_task_id, dependency.dependency_type, dependency.target_task_id) AS scan_key,
    dependency.source_task_id AS "sourceTaskId", NULL::integer AS "sourceTaskRevision",
    dependency.target_task_id AS "targetTaskId", NULL::integer AS "targetTaskRevision",
    dependency.dependency_type AS "dependencyType", dependency.created_by AS "createdBy",
    dependency.created_at AS "createdAt", dependency.updated_at AS "updatedAt", dependency.deleted_at AS "deletedAt",
    (SELECT CASE WHEN count(*) = 1 THEN min(event_id) END FROM public.research_events AS event
      WHERE event.event_type = 'task.dependency_created'
        AND event.payload->>'source_task_id' = dependency.source_task_id
        AND event.payload->>'target_task_id' = dependency.target_task_id
        AND event.payload->>'dependency_type' = dependency.dependency_type) AS "provenanceEventId"
  FROM public.task_dependencies AS dependency
  LEFT JOIN private.research_nodes AS source_node ON source_node.node_kind='task' AND source_node.node_id=dependency.source_task_id
  LEFT JOIN public.tasks AS source_task ON source_task.task_id = dependency.source_task_id
  LEFT JOIN public.questions AS source_question ON source_question.question_id = source_task.question_id
  WHERE COALESCE(source_node.project_id, source_question.project_id) = $1
)
SELECT * FROM source_rows WHERE scan_key > $2 ORDER BY scan_key LIMIT $3`,
  run_input: `
WITH source_rows AS (
  SELECT concat_ws('|', input.run_id, input.artifact_id, lpad(input.artifact_revision::text, 12, '0')) AS scan_key,
    input.run_id AS "runId", 1 AS "runRevision", input.artifact_id AS "artifactId",
    input.artifact_revision AS "artifactRevision", input.created_at AS "createdAt",
    (${LEGACY_EVENT_MATCH.run}) AS "provenanceEventId"
  FROM public.run_inputs AS input
  JOIN public.runs AS run ON run.run_id = input.run_id
  LEFT JOIN private.research_nodes AS run_node ON run_node.node_kind='run' AND run_node.node_id=run.run_id
  LEFT JOIN public.tasks AS task ON task.task_id = run.task_id
  LEFT JOIN public.questions AS question ON question.question_id = task.question_id
  WHERE COALESCE(run_node.project_id, question.project_id) = $1
)
SELECT * FROM source_rows WHERE scan_key > $2 ORDER BY scan_key LIMIT $3`,
  run_output: `
WITH source_rows AS (
  SELECT concat_ws('|', output.run_id, output.artifact_id, lpad(output.artifact_revision::text, 12, '0')) AS scan_key,
    output.run_id AS "runId", 1 AS "runRevision", output.artifact_id AS "artifactId",
    output.artifact_revision AS "artifactRevision", output.created_at AS "createdAt",
    (${LEGACY_EVENT_MATCH.run}) AS "provenanceEventId"
  FROM public.run_outputs AS output
  JOIN public.runs AS run ON run.run_id = output.run_id
  LEFT JOIN private.research_nodes AS run_node ON run_node.node_kind='run' AND run_node.node_id=run.run_id
  LEFT JOIN public.tasks AS task ON task.task_id = run.task_id
  LEFT JOIN public.questions AS question ON question.question_id = task.question_id
  WHERE COALESCE(run_node.project_id, question.project_id) = $1
)
SELECT * FROM source_rows WHERE scan_key > $2 ORDER BY scan_key LIMIT $3`,
});

async function scanPage(executor, source, { projectId, cursor = null, limit = 100 } = {}) {
  projectId = requiredText(projectId, 'backfill project id');
  requiredPositiveInteger(limit, 'backfill page limit');
  if (limit > MAX_PAGE_SIZE) throw new ResearchGraphBackfillRepositoryError(`backfill page limit cannot exceed ${MAX_PAGE_SIZE}`, 'RESEARCH_GRAPH_BACKFILL_REPOSITORY_INPUT', 400);
  const after = decodeCursor(cursor);
  const rows = await executor.unsafe(SCAN_SQL[source], [projectId, after, limit + 1]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const lastKey = page.at(-1)?.scan_key ?? page.at(-1)?.scanKey ?? null;
  return Object.freeze({
    rows: Object.freeze(page.map((row) => {
      const { scan_key: _snake, scanKey: _camel, ...payload } = row;
      return Object.freeze(plain(payload));
    })),
    nextCursor: hasMore ? encodeCursor(requiredText(lastKey, 'database scan key')) : null,
  });
}

async function resolveRevision(executor, ref) {
  const rows = await executor.unsafe(`
SELECT revision.node_kind AS kind, revision.node_id AS id, revision.revision,
  revision.commit_rank AS "commitRank", revision.batch_rank AS "batchRank",
  revision.supersedes_revision AS "supersedesRevision", revision.label,
  revision.state, revision.canonical_href AS "canonicalHref",
  revision.source_event_id AS "sourceEventId", revision.created_by AS "createdBy",
  revision.created_at AS "createdAt", revision.canonical_content_hash AS "canonicalContentHash",
  node.project_id AS "projectId"
FROM private.research_node_revisions AS revision
JOIN private.research_nodes AS node ON node.node_kind = revision.node_kind AND node.node_id = revision.node_id
WHERE revision.node_kind = $1 AND revision.node_id = $2 AND revision.revision = $3`, [ref.kind, ref.id, ref.revision]);
  if (rows.length !== 1) throw new ResearchGraphBackfillRepositoryError(`kernel revision not found: ${ref.kind}:${ref.id}@${ref.revision}`, 'RESEARCH_GRAPH_BACKFILL_DANGLING_REVISION', 409);
  return plain(rows[0]);
}

async function requireEvent(executor, record) {
  const eventId = record.sourceEventId
    ?? rowValue(record.sourcePayload, 'sourceEventId', 'source_event_id', 'provenanceEventId', 'provenance_event_id');
  const actorId = actorFromPayload(record.sourcePayload);
  if (!eventId || !actorId) {
    throw new ResearchGraphBackfillRepositoryError(`legacy source lacks a unique signed event or actor: ${record.source}:${record.sourceKey}`, 'RESEARCH_GRAPH_BACKFILL_PROVENANCE_MISSING', 409);
  }
  const rows = await executor.unsafe(`
SELECT event_id AS "eventId", payload->>'actor_id' AS "actorId", created_at AS "createdAt"
FROM public.research_events WHERE event_id = $1`, [eventId]);
  if (rows.length !== 1 || rows[0].actorId !== actorId) {
    throw new ResearchGraphBackfillRepositoryError(`legacy signed event attribution mismatch: ${record.source}:${record.sourceKey}`, 'RESEARCH_GRAPH_BACKFILL_PROVENANCE_MISMATCH', 409);
  }
  return plain(rows[0]);
}

async function insertEdge(executor, { edgeId, edge, source, target, eventId, actorId, createdAt }) {
  if (compareRank(source, target) >= 0) {
    throw new ResearchGraphBackfillRepositoryError(`legacy edge is not forward-ranked: ${edge.type} ${edge.source.kind}:${edge.source.id}@${edge.source.revision} -> ${edge.target.kind}:${edge.target.id}@${edge.target.revision}`, 'RESEARCH_GRAPH_BACKFILL_RANK_CONFLICT', 409);
  }
  const rows = await executor.unsafe(`
INSERT INTO private.research_edges (
  edge_id, edge_type, source_kind, source_id, source_revision, source_commit_rank, source_batch_rank,
  target_kind, target_id, target_revision, target_commit_rank, target_batch_rank,
  provenance_event_id, created_by, created_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::timestamptz)
ON CONFLICT DO NOTHING RETURNING edge_id AS "edgeId"`, [
    edgeId, edge.type,
    edge.source.kind, edge.source.id, edge.source.revision, source.commitRank, source.batchRank,
    edge.target.kind, edge.target.id, edge.target.revision, target.commitRank, target.batchRank,
    eventId, actorId, iso(createdAt),
  ]);
  if (rows.length === 1) return rows[0];
  const existing = await executor.unsafe(`
SELECT edge_id AS "edgeId", edge_type AS type, source_kind AS "sourceKind", source_id AS "sourceId",
 source_revision AS "sourceRevision", target_kind AS "targetKind", target_id AS "targetId",
 target_revision AS "targetRevision", provenance_event_id AS "eventId", created_by AS "createdBy"
FROM private.research_edges WHERE edge_id = $1`, [edgeId]);
  const row = existing[0];
  if (!row || row.type !== edge.type || row.sourceKind !== edge.source.kind || row.sourceId !== edge.source.id
    || Number(row.sourceRevision) !== edge.source.revision || row.targetKind !== edge.target.kind || row.targetId !== edge.target.id
    || Number(row.targetRevision) !== edge.target.revision || row.eventId !== eventId || row.createdBy !== actorId) {
    throw new ResearchGraphBackfillRepositoryError(`research edge identity conflict: ${edgeId}`, 'RESEARCH_GRAPH_BACKFILL_IDENTITY_CONFLICT', 409);
  }
  return row;
}

function canonicalProjectionHash(record, content) {
  return `sha256:${semanticHash({ schema: 'evimesh.legacy-projection.v1', mappingId: record.mappingId, sourceChecksum: record.sourceChecksum, content })}`;
}

async function materializeDirectEdge(executor, { record, edgeId, edge }) {
  const source = await resolveRevision(executor, edge.source);
  const target = await resolveRevision(executor, edge.target);
  if (target.projectId !== record.projectId) {
    throw new ResearchGraphBackfillRepositoryError('legacy edge target belongs to a different project', 'RESEARCH_GRAPH_BACKFILL_PROJECT_MISMATCH', 409);
  }
  const rawActor = actorFromPayload(record.sourcePayload);
  if (rawActor && rawActor !== target.createdBy) {
    throw new ResearchGraphBackfillRepositoryError('legacy edge actor does not match immutable target revision author', 'RESEARCH_GRAPH_BACKFILL_ATTRIBUTION_CONFLICT', 409);
  }
  // Kernel edges are immutable facts about a newly produced target revision.
  // The legacy relation event remains byte-for-byte in the crosswalk payload;
  // the formal edge is bound to the target revision event, as required by the
  // kernel trigger, instead of inventing a new signature.
  return insertEdge(executor, {
    edgeId, edge, source, target,
    eventId: target.sourceEventId,
    actorId: target.createdBy,
    createdAt: createdAtFromPayload(record.sourcePayload, target.createdAt),
  });
}

async function insertMotifNode(executor, { record, operation, event }) {
  const actorId = actorFromPayload(record.sourcePayload);
  const createdAt = createdAtFromPayload(record.sourcePayload, event.createdAt);
  const label = operation.motifType === 'evaluation'
    ? `Legacy ${operation.stance} evaluation`
    : `Legacy ${operation.mode} rebuttal`;
  const content = operation.motifType === 'evaluation'
    ? { subject: operation.subject, bases: operation.bases, stance: operation.stance, rationale: `Mechanical migration projection of ${record.source}:${record.sourceKey}.`, method: 'legacy-crosswalk' }
    : { subject: operation.subject, bases: operation.bases, mode: operation.mode, title: label, argument: `Mechanical migration projection of ${record.source}:${record.sourceKey}.`, scope: [] };
  const nodeRows = await executor.unsafe(`
INSERT INTO private.research_nodes (node_id, node_kind, project_id, created_by, created_at)
VALUES ($1,$2,$3,$4,$5::timestamptz) ON CONFLICT DO NOTHING RETURNING node_id AS "nodeId"`, [
    operation.node.id, operation.node.kind, record.projectId, actorId, iso(createdAt),
  ]);
  if (nodeRows.length !== 1) throw new ResearchGraphBackfillRepositoryError(`legacy motif node already exists without its crosswalk: ${operation.node.id}`, 'RESEARCH_GRAPH_BACKFILL_IDENTITY_CONFLICT', 409);
  const revisionRows = await executor.unsafe(`
INSERT INTO private.research_node_revisions (
 node_kind,node_id,revision,supersedes_revision,batch_rank,canonical_content_hash,label,state,canonical_href,source_event_id,created_by,created_at
) VALUES ($1,$2,1,NULL,1,$3,$4,'published',$5,$6,$7,$8::timestamptz)
RETURNING node_kind AS kind,node_id AS id,revision,commit_rank AS "commitRank",batch_rank AS "batchRank",
 source_event_id AS "sourceEventId",created_by AS "createdBy",created_at AS "createdAt"`, [
    operation.node.kind, operation.node.id, canonicalProjectionHash(record, content), label,
    `/${operation.node.kind}s/${operation.node.id}`, event.eventId, actorId, iso(createdAt),
  ]);
  if (revisionRows.length !== 1) throw new ResearchGraphBackfillRepositoryError('failed to insert legacy motif revision');
  return { target: plain(revisionRows[0]), content, actorId, createdAt };
}

async function materializeMotif(executor, { record, operation }) {
  const event = await requireEvent(executor, record);
  const resolved = new Map();
  for (const ref of [operation.subject, ...operation.bases]) {
    const key = `${ref.kind}:${ref.id}@${ref.revision}`;
    if (!resolved.has(key)) resolved.set(key, await resolveRevision(executor, ref));
  }
  const { target, content, actorId, createdAt } = await insertMotifNode(executor, { record, operation, event });
  if (operation.motifType === 'evaluation') {
    await executor.unsafe(`
INSERT INTO private.evaluation_revisions (
 evaluation_id,revision,node_kind,subject_kind,subject_id,subject_revision,stance,rationale,method
) VALUES ($1,1,'evaluation',$2,$3,$4,$5,$6,$7)`, [
      operation.node.id, content.subject.kind, content.subject.id, content.subject.revision,
      content.stance, content.rationale, content.method,
    ]);
    for (const basis of operation.bases) {
      await executor.unsafe(`
INSERT INTO private.evaluation_bases (evaluation_id,evaluation_revision,basis_kind,basis_id,basis_revision)
VALUES ($1,1,$2,$3,$4)`, [operation.node.id, basis.kind, basis.id, basis.revision]);
    }
  } else if (operation.motifType === 'rebuttal') {
    await executor.unsafe(`
INSERT INTO private.rebuttal_revisions (rebuttal_id,revision,node_kind,title,argument,scope)
VALUES ($1,1,'rebuttal',$2,$3,$4::text[])`, [operation.node.id, content.title, content.argument, content.scope]);
  } else {
    throw new ResearchGraphBackfillRepositoryError(`unsupported legacy motif: ${operation.motifType}`);
  }
  const targetRef = operation.node;
  const edgeSpecs = operation.motifType === 'evaluation'
    ? [{ type: 'evaluates', source: operation.subject, target: targetRef }, ...operation.bases.map((basis) => ({ type: 'evaluation_basis', source: basis, target: targetRef }))]
    : [{ type: 'rebuts', source: operation.subject, target: targetRef }, ...operation.bases.map((basis) => ({ type: 'grounds_rebuttal', source: basis, target: targetRef }))];
  for (const edge of edgeSpecs) {
    const source = resolved.get(`${edge.source.kind}:${edge.source.id}@${edge.source.revision}`);
    await insertEdge(executor, {
      edgeId: edgeIdentity(edge), edge, source, target,
      eventId: event.eventId, actorId, createdAt,
    });
  }
  return target;
}

async function materializeChallenge(executor, { record, ref }) {
  const payload = record.sourcePayload;
  const event = await requireEvent(executor, record);
  const actorId = actorFromPayload(payload);
  const revision = requiredPositiveInteger(ref.revision, 'Challenge revision');
  const createdAt = createdAtFromPayload(payload, event.createdAt);
  const nodeCreatedAt = rowValue(payload, 'nodeCreatedAt', 'node_created_at') ?? createdAt;
  const reason = requiredText(rowValue(payload, 'reason'), 'legacy Challenge reason');
  const content = {
    state: rowValue(payload, 'state'), reason, impact: rowValue(payload, 'impact') ?? {},
    proposedResolution: rowValue(payload, 'proposedResolution', 'proposed_resolution'),
    target: { kind: 'claim', id: rowValue(payload, 'targetClaimId', 'target_claim_id'), revision: rowValue(payload, 'targetClaimRevision', 'target_claim_revision') },
  };
  if (revision === 1) {
    const inserted = await executor.unsafe(`
INSERT INTO private.research_nodes (node_id,node_kind,project_id,created_by,created_at)
VALUES ($1,'challenge',$2,$3,$4::timestamptz) ON CONFLICT DO NOTHING RETURNING node_id AS "nodeId"`, [ref.id, record.projectId, actorId, iso(nodeCreatedAt)]);
    if (inserted.length !== 1) {
      const existing = await executor.unsafe(`SELECT node_id FROM private.research_nodes WHERE node_kind='challenge' AND node_id=$1 AND project_id=$2 AND created_by=$3`, [ref.id, record.projectId, actorId]);
      if (existing.length !== 1) throw new ResearchGraphBackfillRepositoryError(`Challenge node identity conflict: ${ref.id}`, 'RESEARCH_GRAPH_BACKFILL_IDENTITY_CONFLICT', 409);
    }
  } else {
    const stable = await executor.unsafe(`SELECT node_id FROM private.research_nodes WHERE node_kind='challenge' AND node_id=$1 AND project_id=$2`, [ref.id, record.projectId]);
    if (stable.length !== 1) throw new ResearchGraphBackfillRepositoryError(`previous Challenge lineage is missing: ${ref.id}@${revision - 1}`, 'RESEARCH_GRAPH_BACKFILL_DANGLING_REVISION', 409);
    await resolveRevision(executor, { kind: 'challenge', id: ref.id, revision: revision - 1 });
  }
  const expectedHash = canonicalProjectionHash(record, content);
  const revisionRows = await executor.unsafe(`
INSERT INTO private.research_node_revisions (
 node_kind,node_id,revision,supersedes_revision,batch_rank,canonical_content_hash,label,state,canonical_href,source_event_id,created_by,created_at
) VALUES ('challenge',$1,$2,$3,1,$4,$5,'published',$6,$7,$8,$9::timestamptz)
ON CONFLICT DO NOTHING
RETURNING node_kind AS kind,node_id AS id,revision,commit_rank AS "commitRank",batch_rank AS "batchRank",
 source_event_id AS "sourceEventId",created_by AS "createdBy",created_at AS "createdAt"`, [
    ref.id, revision, revision === 1 ? null : revision - 1,
    expectedHash, `Challenge: ${reason}`, `/challenges/${ref.id}`, event.eventId, actorId, iso(createdAt),
  ]);
  let target = revisionRows[0] ? plain(revisionRows[0]) : await resolveRevision(executor, ref);
  if (target.sourceEventId !== event.eventId || target.createdBy !== actorId
    || (target.canonicalContentHash && target.canonicalContentHash !== expectedHash)) {
    throw new ResearchGraphBackfillRepositoryError(`Challenge revision identity conflict: ${ref.id}@${revision}`, 'RESEARCH_GRAPH_BACKFILL_IDENTITY_CONFLICT', 409);
  }
  if (revision > 1 && revisionRows.length === 1) {
    const previousRef = { kind: 'challenge', id: ref.id, revision: revision - 1 };
    const previous = await resolveRevision(executor, previousRef);
    const edge = { type: 'supersedes', source: previousRef, target: ref };
    await insertEdge(executor, { edgeId: edgeIdentity(edge), edge, source: previous, target, eventId: event.eventId, actorId, createdAt });
  }
  return target;
}

async function materializeNodeRegistration(executor, { record, registration }) {
  const event = await requireEvent(executor, record);
  const { ref } = registration;
  if (event.eventId !== registration.sourceEventId || event.actorId !== registration.createdBy) {
    throw new ResearchGraphBackfillRepositoryError(`legacy node event binding mismatch: ${record.sourceKey}`, 'RESEARCH_GRAPH_BACKFILL_PROVENANCE_MISMATCH', 409);
  }
  if (ref.revision === 1) {
    const inserted = await executor.unsafe(`
INSERT INTO private.research_nodes (node_id,node_kind,project_id,created_by,created_at,retired_at)
VALUES ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
ON CONFLICT DO NOTHING RETURNING node_id AS "nodeId"`, [
      ref.id, ref.kind, registration.projectId, registration.stableCreatedBy,
      iso(registration.stableCreatedAt), registration.retiredAt ? iso(registration.retiredAt) : null,
    ]);
    if (inserted.length !== 1) {
      const existing = await executor.unsafe(`
SELECT node_id AS "nodeId",node_kind AS kind,project_id AS "projectId",created_by AS "createdBy",
 created_at AS "createdAt",retired_at AS "retiredAt"
FROM private.research_nodes WHERE node_id=$1`, [ref.id]);
      const node = existing[0];
      if (!node || node.kind !== ref.kind || node.projectId !== registration.projectId || node.createdBy !== registration.stableCreatedBy) {
        throw new ResearchGraphBackfillRepositoryError(`legacy stable node identity conflict: ${ref.kind}:${ref.id}`, 'RESEARCH_GRAPH_BACKFILL_IDENTITY_CONFLICT', 409);
      }
      if (iso(node.createdAt) !== iso(registration.stableCreatedAt)
        || iso(node.retiredAt) !== iso(registration.retiredAt)) {
        throw new ResearchGraphBackfillRepositoryError(`legacy stable node lifecycle conflict: ${ref.kind}:${ref.id}`, 'RESEARCH_GRAPH_BACKFILL_IDENTITY_CONFLICT', 409);
      }
    }
  } else {
    const stable = await executor.unsafe(`
SELECT node_id FROM private.research_nodes WHERE node_id=$1 AND node_kind=$2 AND project_id=$3`, [ref.id, ref.kind, registration.projectId]);
    if (stable.length !== 1) throw new ResearchGraphBackfillRepositoryError(`legacy stable node is missing: ${ref.kind}:${ref.id}`, 'RESEARCH_GRAPH_BACKFILL_DANGLING_REVISION', 409);
    await resolveRevision(executor, { ...ref, revision: ref.revision - 1 });
  }
  const inserted = await executor.unsafe(`
INSERT INTO private.research_node_revisions (
 node_kind,node_id,revision,supersedes_revision,batch_rank,canonical_content_hash,label,state,canonical_href,source_event_id,created_by,created_at
) VALUES ($1,$2,$3,$4,1,$5,$6,$7,$8,$9,$10,$11::timestamptz)
ON CONFLICT DO NOTHING
RETURNING node_kind AS kind,node_id AS id,revision,commit_rank AS "commitRank",batch_rank AS "batchRank",
 supersedes_revision AS "supersedesRevision",label,state,canonical_href AS "canonicalHref",
 source_event_id AS "sourceEventId",created_by AS "createdBy",created_at AS "createdAt",canonical_content_hash AS "canonicalContentHash"`, [
    ref.kind, ref.id, ref.revision, registration.supersedesRevision, registration.canonicalContentHash,
    registration.label, registration.state, registration.canonicalHref, registration.sourceEventId,
    registration.createdBy, iso(registration.createdAt),
  ]);
  const target = inserted[0] ? plain(inserted[0]) : await resolveRevision(executor, ref);
  if (target.sourceEventId !== registration.sourceEventId || target.createdBy !== registration.createdBy
    || target.canonicalContentHash !== registration.canonicalContentHash
    || Number(target.supersedesRevision ?? 0) !== Number(registration.supersedesRevision ?? 0)
    || target.label !== registration.label || target.state !== registration.state
    || target.canonicalHref !== registration.canonicalHref
    || iso(target.createdAt) !== iso(registration.createdAt)) {
    throw new ResearchGraphBackfillRepositoryError(`legacy node revision identity conflict: ${ref.kind}:${ref.id}@${ref.revision}`, 'RESEARCH_GRAPH_BACKFILL_IDENTITY_CONFLICT', 409);
  }
  if (ref.revision > 1 && inserted.length === 1) {
    const previousRef = { ...ref, revision: ref.revision - 1 };
    const previous = await resolveRevision(executor, previousRef);
    const edge = { type: 'supersedes', source: previousRef, target: ref };
    await insertEdge(executor, {
      edgeId: edgeIdentity(edge), edge, source: previous, target,
      eventId: registration.sourceEventId, actorId: registration.createdBy, createdAt: registration.createdAt,
    });
  }
  return target;
}

function makeRepository({ sql, scoped = null, snapshotId = null }) {
  const runRead = async (callback) => {
    if (scoped) return callback(scoped);
    return sql.begin('ISOLATION LEVEL REPEATABLE READ READ ONLY', async (tx) => {
      if (snapshotId) {
        // SET TRANSACTION SNAPSHOT must precede the first snapshot-taking
        // query. SET LOCAL is safe, but the role verification SELECT is not.
        await setServiceRole(tx, { verify: false });
        if (!SNAPSHOT_ID.test(snapshotId)) throw new ResearchGraphBackfillRepositoryError('exported snapshot id is invalid');
        await tx.unsafe(`SET TRANSACTION SNAPSHOT '${snapshotId}'`);
        await assertServiceRole(tx);
      } else await setServiceRole(tx);
      return callback(tx);
    });
  };
  const runWrite = async (callback) => {
    if (scoped) return callback(scoped);
    return sql.begin('ISOLATION LEVEL SERIALIZABLE', async (tx) => {
      await setServiceRole(tx);
      return callback(tx);
    });
  };
  const repo = {
    async withConsistentSnapshot(callback) {
      if (scoped || snapshotId) return callback(repo);
      if (typeof callback !== 'function') throw new ResearchGraphBackfillRepositoryError('snapshot callback is required');
      return sql.begin('ISOLATION LEVEL REPEATABLE READ READ ONLY', async (keeper) => {
        await setServiceRole(keeper);
        const rows = await keeper.unsafe('SELECT pg_export_snapshot() AS "snapshotId"');
        const exported = rows?.[0]?.snapshotId;
        if (!SNAPSHOT_ID.test(exported ?? '')) throw new ResearchGraphBackfillRepositoryError('database did not export a valid snapshot');
        return callback(makeRepository({ sql, snapshotId: exported }));
      });
    },
    async withTransaction(callback) {
      if (typeof callback !== 'function') throw new ResearchGraphBackfillRepositoryError('transaction callback is required');
      return runWrite((tx) => callback(makeRepository({ sql, scoped: tx, snapshotId })));
    },
    scanLegacyClaimRelationsPage: (args) => runRead((tx) => scanPage(tx, 'claim_relation', args)),
    scanLegacyEvidenceClaimLinksPage: (args) => runRead((tx) => scanPage(tx, 'evidence_claim_link', args)),
    scanLegacyChallengeRevisionsPage: (args) => runRead((tx) => scanPage(tx, 'challenge_revision', args)),
    scanLegacyChallengeImpactsPage: (args) => runRead((tx) => scanPage(tx, 'challenge_impact', args)),
    scanLegacyTaskDependenciesPage: (args) => runRead((tx) => scanPage(tx, 'task_dependency', args)),
    scanLegacyRunInputsPage: (args) => runRead((tx) => scanPage(tx, 'run_input', args)),
    scanLegacyRunOutputsPage: (args) => runRead((tx) => scanPage(tx, 'run_output', args)),
    async listKnownResearchNodeRevisionRefs({ projectId } = {}) {
      requiredText(projectId, 'backfill project id');
      return runRead(async (tx) => plain(await tx.unsafe(`
SELECT revision.node_kind AS kind, revision.node_id AS id, revision.revision
FROM private.research_node_revisions AS revision
JOIN private.research_nodes AS node ON node.node_kind=revision.node_kind AND node.node_id=revision.node_id
ORDER BY revision.node_kind,revision.node_id,revision.revision`)));
    },
    async getResearchGraphBackfillCheckpoint(projectId) {
      return runRead(async (tx) => checkpointRow((await tx.unsafe(`${CHECKPOINT_SELECT} WHERE project_id=$1`, [requiredText(projectId, 'backfill project id')]))[0]));
    },
    async insertResearchGraphBackfillCheckpoint(checkpoint) {
      return runWrite(async (tx) => checkpointRow((await tx.unsafe(`
INSERT INTO private.research_graph_backfill_checkpoints (
 project_id,schema_version,phase,cursors,completed_sources,source_counts,source_checksums,plan_checksum,created_at,updated_at,completed_at
) VALUES ($1,$2,$3,$4::jsonb,$5::text[],$6::jsonb,$7::jsonb,$8,$9::timestamptz,$9::timestamptz,$10::timestamptz)
ON CONFLICT DO NOTHING RETURNING project_id AS "projectId",schema_version AS "schemaVersion",phase,cursors,
 completed_sources AS "completedSources",source_counts AS "sourceCounts",source_checksums AS "sourceChecksums",
 plan_checksum AS "planChecksum",created_at AS "createdAt",updated_at AS "updatedAt",completed_at AS "completedAt"`, [
        checkpoint.projectId, checkpoint.schemaVersion, checkpoint.phase, json(checkpoint.cursors), checkpoint.completedSources,
        json(checkpoint.sourceCounts), json(checkpoint.sourceChecksums), checkpoint.planChecksum, checkpoint.updatedAt, checkpoint.completedAt,
      ]))[0]));
    },
    async updateResearchGraphBackfillCheckpoint(checkpoint) {
      return runWrite(async (tx) => checkpointRow((await tx.unsafe(`
UPDATE private.research_graph_backfill_checkpoints SET phase=$2,cursors=$3::jsonb,completed_sources=$4::text[],
 source_counts=$5::jsonb,source_checksums=$6::jsonb,plan_checksum=$7,updated_at=$8::timestamptz,completed_at=$9::timestamptz
WHERE project_id=$1 AND phase <> 'complete'
RETURNING project_id AS "projectId",schema_version AS "schemaVersion",phase,cursors,completed_sources AS "completedSources",
 source_counts AS "sourceCounts",source_checksums AS "sourceChecksums",plan_checksum AS "planChecksum",
 created_at AS "createdAt",updated_at AS "updatedAt",completed_at AS "completedAt"`, [
        checkpoint.projectId, checkpoint.phase, json(checkpoint.cursors), checkpoint.completedSources,
        json(checkpoint.sourceCounts), json(checkpoint.sourceChecksums), checkpoint.planChecksum, checkpoint.updatedAt, checkpoint.completedAt,
      ]))[0]));
    },
    async getResearchGraphBackfillStaging(projectId, source, sourceKey) {
      return runRead(async (tx) => stagingRow((await tx.unsafe(`
SELECT project_id AS "projectId",source,source_key AS "sourceKey",source_payload AS "sourcePayload",
 source_checksum AS "sourceChecksum",scanned_at AS "scannedAt"
FROM private.research_graph_backfill_staging WHERE project_id=$1 AND source=$2 AND source_key=$3`, [projectId, source, sourceKey]))[0]));
    },
    async insertResearchGraphBackfillStaging(row) {
      return runWrite(async (tx) => stagingRow((await tx.unsafe(`
INSERT INTO private.research_graph_backfill_staging (project_id,source,source_key,source_payload,source_checksum)
VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT DO NOTHING
RETURNING project_id AS "projectId",source,source_key AS "sourceKey",source_payload AS "sourcePayload",
 source_checksum AS "sourceChecksum",scanned_at AS "scannedAt"`, [row.projectId, row.source, row.sourceKey, json(row.sourcePayload), row.sourceChecksum]))[0]));
    },
    async listResearchGraphBackfillStaging(projectId, source = null) {
      return runRead(async (tx) => (await tx.unsafe(`
SELECT project_id AS "projectId",source,source_key AS "sourceKey",source_payload AS "sourcePayload",
 source_checksum AS "sourceChecksum",scanned_at AS "scannedAt"
FROM private.research_graph_backfill_staging WHERE project_id=$1 AND ($2::text IS NULL OR source::text=$2)
ORDER BY source,source_key`, [projectId, source])).map(stagingRow));
    },
    async getLegacyRelationRecord(source, sourceKey) {
      return runRead(async (tx) => plain((await tx.unsafe(`
SELECT mapping_id AS "mappingId",project_id AS "projectId",source,source_key AS "sourceKey",
 source_payload AS "sourcePayload",source_checksum AS "sourceChecksum",mapping_kind AS "mappingKind",status,
 mapped_node_kind AS "mappedNodeKind",mapped_node_id AS "mappedNodeId",mapped_node_revision AS "mappedNodeRevision",
 mapped_edge_id AS "mappedEdgeId",created_at AS "createdAt"
FROM private.legacy_relation_records WHERE source=$1 AND source_key=$2`, [source, sourceKey]))[0] ?? null));
    },
    async getLegacyNodeRecord(sourceKind, sourceId, sourceRevision) {
      return runRead(async (tx) => plain((await tx.unsafe(`
SELECT mapping_id AS "mappingId",project_id AS "projectId",source_kind AS "sourceKind",source_id AS "sourceId",
 source_revision AS "sourceRevision",source_payload AS "sourcePayload",source_checksum AS "sourceChecksum",status,
 mapped_node_kind AS "mappedNodeKind",mapped_node_id AS "mappedNodeId",mapped_node_revision AS "mappedNodeRevision",
 source_event_id AS "sourceEventId",created_at AS "createdAt"
FROM private.legacy_node_records WHERE source_kind=$1 AND source_id=$2 AND source_revision=$3`, [sourceKind, sourceId, sourceRevision]))[0] ?? null));
    },
    async insertLegacyNodeRecord(record) {
      return runWrite(async (tx) => plain((await tx.unsafe(`
INSERT INTO private.legacy_node_records (
 mapping_id,project_id,source_kind,source_id,source_revision,source_payload,source_checksum,status,
 mapped_node_kind,mapped_node_id,mapped_node_revision,source_event_id
) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)
ON CONFLICT DO NOTHING RETURNING mapping_id AS "mappingId"`, [
        record.mappingId, record.projectId, record.sourceKind, record.sourceId, record.sourceRevision,
        json(record.sourcePayload), record.sourceChecksum, record.status,
        record.mappedNodeKind, record.mappedNodeId, record.mappedNodeRevision, record.sourceEventId,
      ]))[0] ?? null));
    },
    async insertLegacyRelationRecord(record) {
      return runWrite(async (tx) => plain((await tx.unsafe(`
INSERT INTO private.legacy_relation_records (
 mapping_id,project_id,source,source_key,source_payload,source_checksum,mapping_kind,status,
 mapped_node_kind,mapped_node_id,mapped_node_revision,mapped_edge_id
) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)
ON CONFLICT DO NOTHING RETURNING mapping_id AS "mappingId"`, [
        record.mappingId, record.projectId, record.source, record.sourceKey, json(record.sourcePayload), record.sourceChecksum,
        record.mappingKind, record.status, record.mappedNodeKind, record.mappedNodeId, record.mappedNodeRevision, record.mappedEdgeId,
      ]))[0] ?? null));
    },
    async getResearchGraphMigrationFinding(findingId) {
      return runRead(async (tx) => plain((await tx.unsafe(`
SELECT finding_id AS "findingId",project_id AS "projectId",finding_type AS "findingType",severity,status,
 member_refs AS "memberRefs",details,legacy_mapping_id AS "legacyMappingId",created_at AS "createdAt",
 legacy_node_mapping_id AS "legacyNodeMappingId",resolved_at AS "resolvedAt",resolved_by AS "resolvedBy"
FROM private.research_graph_migration_findings WHERE finding_id=$1`, [findingId]))[0] ?? null));
    },
    async insertResearchGraphMigrationFinding(finding) {
      return runWrite(async (tx) => plain((await tx.unsafe(`
INSERT INTO private.research_graph_migration_findings (
 finding_id,project_id,finding_type,severity,status,member_refs,details,legacy_mapping_id,legacy_node_mapping_id,resolved_at,resolved_by
) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::timestamptz,$11)
ON CONFLICT DO NOTHING RETURNING finding_id AS "findingId"`, [
        finding.findingId, finding.projectId, finding.findingType, finding.severity, finding.status,
        json(finding.memberRefs), finding.details, finding.legacyMappingId, finding.legacyNodeMappingId ?? null, finding.resolvedAt, finding.resolvedBy,
      ]))[0] ?? null));
    },
    materializeLegacyResearchNode(args) { return runWrite((tx) => materializeNodeRegistration(tx, args)); },
    materializeLegacyResearchEdge(args) { return runWrite((tx) => materializeDirectEdge(tx, args)); },
    materializeLegacyResearchMotif(args) { return runWrite((tx) => materializeMotif(tx, args)); },
    materializeLegacyChallengeRevision(args) { return runWrite((tx) => materializeChallenge(tx, args)); },
  };
  return Object.freeze(repo);
}

/**
 * Service-only Postgres.js adapter for the deterministic backfill runner.
 * Browser roles never receive this object or direct table grants. The caller
 * should wrap one complete run in withConsistentSnapshot(); each write still
 * commits independently so scan checkpoints survive interruption.
 */
export function createPostgresResearchGraphBackfillRepository({ sql } = {}) {
  assertSqlClient(sql);
  return makeRepository({ sql });
}

export const RESEARCH_GRAPH_BACKFILL_SQL = Object.freeze({
  checkpointSelect: CHECKPOINT_SELECT,
  scanners: SCAN_SQL,
});

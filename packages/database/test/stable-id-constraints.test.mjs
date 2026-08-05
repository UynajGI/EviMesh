import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { schema } from '../src/schema.mjs';

const stableIdColumns = {
  actors: 'actorId',
  actorProfiles: 'actorId',
  identities: 'identityId',
  signingKeys: 'keyId',
  apiTokens: 'tokenId',
  organizations: 'organizationId',
  projects: 'projectId',
  questions: 'questionId',
  researchContracts: 'contractId',
  tasks: 'taskId',
  attempts: 'attemptId',
  traceEvents: 'eventId',
  claims: 'claimId',
  artifacts: 'artifactId',
  artifactLocations: 'locationId',
  runs: 'runId',
  evidence: 'evidenceId',
  verificationContracts: 'contractId',
  verificationPolicies: 'policyId',
  verificationReceipts: 'receiptId',
  verificationFindings: 'findingId',
  challenges: 'challengeId',
  challengeImpacts: 'impactId',
  mergeProposals: 'proposalId',
  frontierSnapshots: 'snapshotId',
  contextBundles: 'contextBundleId',
  contributionStatements: 'statementId',
  researchEvents: 'eventId',
  eventOutbox: 'outboxId',
  merkleCheckpoints: 'checkpointId',
  notifications: 'notificationId',
};

test('M3-55 keeps every stable entity ID protected by a single-column primary key', () => {
  for (const [tableName, columnName] of Object.entries(stableIdColumns)) {
    const column = getTableColumns(schema[tableName])[columnName];

    assert.ok(column, `${tableName}.${columnName} must exist`);
    assert.equal(
      column.primary,
      true,
      `${tableName}.${columnName} must remain unique through its primary key`,
    );
  }
});

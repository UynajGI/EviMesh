import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPolicyEvaluation, PolicyEvaluationCommandError } from '../src/policy-evaluation-command.mjs';

function repository() { const calls = []; const repo = { calls, withTransaction: async (callback) => callback(repo), insertPolicyEvaluation: async (value) => { calls.push(value); return value; } }; return repo; }
const evaluation = { policy_id: 'policy-1', revision: 2, input: { blind_reproductions: 1 }, requirement_results: [{ key: 'blind_reproductions', met: true }], requirements_met: true, recommended_outcome: 'provisionally_accepted' };
test('persists the policy revision, input summary, and result atomically', async () => { const repo = repository(); const result = await recordPolicyEvaluation({ repository: repo, evaluationId: 'evaluation-1', claimId: 'claim-1', policyId: 'policy-1', policyRevision: 2, evaluation }); assert.equal(result.result.recommendedOutcome, 'provisionally_accepted'); assert.equal(repo.calls.length, 1); });
test('rejects evaluation records that do not bind to the named policy revision', async () => { await assert.rejects(() => recordPolicyEvaluation({ repository: repository(), evaluationId: 'evaluation-1', claimId: 'claim-1', policyId: 'policy-1', policyRevision: 2, evaluation: { ...evaluation, revision: 1 } }), PolicyEvaluationCommandError); });

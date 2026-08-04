import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../question.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validQuestion = {
  schema: 'srp.question.v1',
  question_id: 'question_018f0f4a-5c00-4000-8000-000000000001',
  revision: 1,
  state: 'draft',
  title: 'Can the method be reproduced?',
  statement: 'Under the stated assumptions, can independent implementations reproduce the reported result?',
  research_contract: {
    problem: 'Define and test the reproduction target.',
    definitions: { reproduction: 'same result within the stated tolerance' },
    background: 'Prior published results motivate the question.',
    scope: ['the published numerical method'],
    exclusions: ['unrelated datasets'],
    progress_criteria: ['two independent successful reproductions'],
    acceptable_evidence: ['numerical_result', 'code_test'],
    falsification: ['a verified counterexample'],
    license: 'CC-BY-4.0',
    risk_level: 'open',
    maintainer_ids: ['actor_01'],
  },
  created_at: '2026-08-04T06:00:00.000Z',
  created_by: 'actor_01',
};

function validateQuestion(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.question.v1') return 'schema mismatch';
  if (!/^question_[0-9a-f-]{36}$/.test(value.question_id)) return 'question_id format';
  if (!Number.isInteger(value.revision) || value.revision < 1) return 'revision';
  if (!schema.properties.state.enum.includes(value.state)) return 'state';
  if (typeof value.title !== 'string' || value.title.length < 1) return 'title';
  if (typeof value.statement !== 'string' || value.statement.length < 1) return 'statement';
  const contract = value.research_contract;
  if (!contract || typeof contract !== 'object') return 'research_contract';
  for (const field of schema.$defs.researchContract.required) if (!(field in contract) || contract[field] === undefined || contract[field] === null) return `contract.${field}`;
  if (!schema.$defs.researchContract.properties.risk_level.enum.includes(contract.risk_level)) return 'contract.risk_level';
  return Number.isNaN(Date.parse(value.created_at)) ? 'created_at' : null;
}

test('defines Question and ResearchContract schemas', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/question.schema.json');
  assert.equal(schema.properties.research_contract.$ref, '#/$defs/researchContract');
  assert.deepEqual(schema.$defs.researchContract.required, ['problem', 'definitions', 'background', 'scope', 'progress_criteria', 'acceptable_evidence', 'falsification', 'license', 'risk_level', 'maintainer_ids']);
  assert.equal(validateQuestion(validQuestion), null);
});

test('rejects Question vectors without a valid ResearchContract', () => {
  for (const invalid of [
    { ...validQuestion, research_contract: undefined },
    { ...validQuestion, research_contract: { ...validQuestion.research_contract, risk_level: 'critical' } },
    { ...validQuestion, research_contract: { ...validQuestion.research_contract, falsification: undefined } },
    { ...validQuestion, state: 'deleted' },
  ]) {
    assert.notEqual(validateQuestion(invalid), null);
  }
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../app/agent/page.js', import.meta.url), 'utf8');

test('Agent manual documents the published CLI and MCP packages', () => {
  assert.match(source, /npm install --global @evimesh\/cli/);
  assert.match(source, /sq config init --api-url https:\/\/api\.evimesh\.com/);
  assert.match(source, /"@evimesh\/mcp"/);
  assert.match(source, /"command": "npx"/);
});

test('Agent manual states token and write-consent boundaries', () => {
  assert.match(source, /Consent before writes/);
  assert.match(source, /confirm is explicitly true/);
  assert.match(source, /Least-privilege tokens/);
  assert.match(source, /Never paste a token into chat/);
  assert.match(source, /href="\/settings\/tokens"/);
});

test('Agent manual distinguishes CLI hash verification from MCP context access', () => {
  assert.match(source, /CLI verifies a bundle hash when you run sq context pull/);
  assert.match(source, /MCP clients should not assume a local hash check/);
  assert.doesNotMatch(source, /hash-verified before an Agent works from them/);
});

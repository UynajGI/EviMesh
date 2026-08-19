import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = await readFile(new URL('../app/agent/manual/route.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../lib/agent-manual.js', import.meta.url), 'utf8');

test('Agent manual is served as a direct Markdown document', () => {
  assert.match(route, /new Response\(agentManualMarkdown/);
  assert.match(route, /Content-Type': 'text\/markdown; charset=utf-8/);
  assert.match(route, /Vary': 'Accept/);
});

test('Agent manual documents the published CLI and MCP packages', () => {
  assert.match(source, /npm install --global @evimesh\/cli/);
  assert.match(source, /sq config init --api-url https:\/\/api\.evimesh\.com/);
  assert.match(source, /"@evimesh\/mcp"/);
  assert.match(source, /"command": "npx"/);
});

test('Agent manual states token and write-consent boundaries', () => {
  assert.match(source, /Consent before writes/);
  assert.match(source, /confirm.*explicitly.*true/s);
  assert.match(source, /least-privilege tokens/i);
  assert.match(source, /Never paste a token into chat/);
  assert.match(source, /https:\/\/www\.evimesh\.com\/settings\/tokens/);
});

test('Agent manual distinguishes CLI hash verification from MCP context access', () => {
  assert.match(source, /CLI verifies a bundle hash/);
  assert.match(source, /MCP clients currently receive the server bundle without a local hash verification step/);
  assert.doesNotMatch(source, /hash-verified before an Agent works from them/);
});

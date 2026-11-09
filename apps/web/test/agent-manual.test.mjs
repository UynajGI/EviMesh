import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../app/agent/page.js', import.meta.url), 'utf8');
const route = await readFile(new URL('../app/agent.md/route.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../lib/agent-manual.js', import.meta.url), 'utf8');

/*
 * M13.8 replaces the three-step onboarding page with the six-step connection
 * center; the canonical manual URL and its copy action carry over.
 */
test('/agent is the connection center and keeps the canonical manual URL', async () => {
  assert.match(page, /export default function AgentCenterPage/);
  assert.match(page, /https:\/\/www\.evimesh\.com\/agent\.md/);
  assert.match(page, /copyManualUrl/);
  for (const step of ['Choose a client', 'Test the connection', 'Check provenance and continue']) assert.match(page, new RegExp(step));
  await assert.rejects(access(new URL('../app/agent/route.js', import.meta.url)));
});

test('/agent.md is served as a direct Markdown document', () => {
  assert.match(route, /new Response\(agentManualMarkdown/);
  assert.match(route, /Content-Type': 'text\/markdown; charset=utf-8/);
  assert.doesNotMatch(route, /text\/html/);
});

test('Agent manual identifies its canonical machine-readable URL', () => {
  assert.match(source, /canonical public URL is https:\/\/www\.evimesh\.com\/agent\.md/i);
  assert.doesNotMatch(source, /served as Markdown at `\/agent`/);
});

test('Agent manual gates installation on the public capability document', () => {
  assert.match(source, /https:\/\/api\.evimesh\.com\/meta\/capabilities/);
  assert.match(source, /available.*minimumVersion/s);
  assert.doesNotMatch(source, /npm install --global @evimesh\/cli/);
  assert.doesNotMatch(source, /"@evimesh\/mcp"/);
});

test('Agent manual states token and human-signature boundaries', () => {
  assert.match(source, /Consent before writes/);
  assert.match(source, /No .*confirm.*substitutes for the human signature/s);
  assert.match(source, /no MCP tool may expose the local signer or private key/i);
  assert.match(source, /least-privilege tokens/i);
  assert.match(source, /Never paste a token into chat/);
  assert.match(source, /https:\/\/www\.evimesh\.com\/settings\/tokens/);
});

test('Agent manual forbids unsupported local-verification claims', () => {
  assert.match(source, /Do not claim local verification unless the released client has actually recomputed and checked the bundle hash/);
});

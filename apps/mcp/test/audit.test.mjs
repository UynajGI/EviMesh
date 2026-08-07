import test from "node:test";
import assert from "node:assert/strict";
import { listTools } from "../src/tools.mjs";
import { listResources } from "../src/resources.mjs";

const FORBIDDEN = /\b(github|gitlab|pull[_ ]?request|merge[_ ]?request|branch|fork|changeset|pull request)\b|commit/i;

function collectStrings(value, sink) {
  if (typeof value === "string") sink.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, sink));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, sink));
}

test("tool names and schemas carry no GitHub/PR/branch/commit semantics", () => {
  const { tools } = listTools();
  for (const tool of tools) {
    assert.ok(!FORBIDDEN.test(tool.name), `tool name ${tool.name} is forbidden`);
    const strings = [];
    collectStrings(tool.inputSchema, strings);
    collectStrings(tool.outputSchema, strings);
    for (const text of strings) {
      assert.ok(!FORBIDDEN.test(text), `tool ${tool.name} schema mentions forbidden term in: ${text}`);
    }
  }
});

test("resource URIs and names carry no GitHub semantics", () => {
  const { resources, resourceTemplates } = listResources();
  for (const entry of [...resources, ...resourceTemplates]) {
    const uri = entry.uri ?? entry.uriTemplate;
    assert.ok(!FORBIDDEN.test(uri), `resource uri ${uri} is forbidden`);
    assert.ok(!FORBIDDEN.test(entry.name), `resource name ${entry.name} is forbidden`);
  }
});

test("all tools are research-network actions with output schemas", () => {
  const { tools } = listTools();
  assert.ok(tools.length >= 13);
  for (const tool of tools) {
    assert.ok(tool.name.includes("_"), `tool ${tool.name} should use snake_case research verbs`);
    assert.ok(tool.outputSchema && tool.outputSchema.type === "object", `${tool.name} outputSchema must be an object schema`);
  }
});

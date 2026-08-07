import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { schemaFileForDocument, validateAgainstSchema } from "../src/validator.mjs";

const schemaDir = new URL("../", import.meta.url);

async function loadSchema(name) {
  return JSON.parse(await readFile(new URL(name, schemaDir), "utf8"));
}

async function loadFixture(kind, name) {
  return JSON.parse(await readFile(new URL(`fixtures/${kind}/${name}`, schemaDir), "utf8"));
}

test("validates every valid fixture against its schema", async () => {
  for (const name of ["claim.json", "task.json", "question.json", "project.json", "run.json", "artifact.json", "event.json", "challenge.json", "verification.json", "contribution.json", "frontier.json"]) {
    const fixture = await loadFixture("valid", name);
    const file = schemaFileForDocument(fixture);
    assert.ok(file, `${name} should map to a schema file`);
    const schema = await loadSchema(file);
    const result = validateAgainstSchema(schema, fixture);
    assert.equal(result.valid, true, `${name} should validate: ${JSON.stringify(result.findings)}`);
  }
});

test("rejects invalid fixtures with path findings", async () => {
  const claim = await loadFixture("invalid", "claim.json");
  const schema = await loadSchema("claim.schema.json");
  const documents = Array.isArray(claim) ? claim : [claim];
  for (const document of documents) {
    const result = validateAgainstSchema(schema, document);
    assert.equal(result.valid, false);
    assert.ok(result.findings.length > 0);
    assert.ok(result.findings.every((finding) => typeof finding.path === "string" && finding.message.length > 0));
  }
});

test("flags unknown properties when additionalProperties is false", async () => {
  const claim = await loadFixture("valid", "claim.json");
  const schema = await loadSchema("claim.schema.json");
  const result = validateAgainstSchema(schema, { ...claim, unexpected: true });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.path === "unexpected"));
});

test("returns null for documents without a known schema discriminator", () => {
  assert.equal(schemaFileForDocument({}), null);
  assert.equal(schemaFileForDocument({ schema: "srp.unknown.v9" }), null);
  assert.equal(schemaFileForDocument(null), null);
});

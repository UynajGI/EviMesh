import test from "node:test";
import assert from "node:assert/strict";
import { parseJsonBody, RequestValidationError } from "../src/validation.mjs";

const schema = {
  safeParse(value) {
    return typeof value?.name === "string"
      ? { success: true, data: { name: value.name.trim() } }
      : { success: false, error: { issues: [{ path: ["name"], message: "name is required" }] } };
  },
};

test("parses valid JSON through a safeParse-compatible schema", async () => {
  assert.deepEqual(await parseJsonBody(new Request("https://example.test", {
    method: "POST", body: JSON.stringify({ name: " Project " }),
  }), schema), { name: "Project" });
});

test("returns field paths for invalid JSON or schema values", async () => {
  await assert.rejects(
    parseJsonBody(new Request("https://example.test", { method: "POST", body: "{" }), schema),
    (error) => error instanceof RequestValidationError && error.issues[0].path.length === 0,
  );
  await assert.rejects(
    parseJsonBody(new Request("https://example.test", { method: "POST", body: "{}" }), schema),
    (error) => error instanceof RequestValidationError && error.issues[0].path[0] === "name",
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, flagString, flagBool } from "../src/args.mjs";

test("parseArgs separates command, positionals, and flags", () => {
  const parsed = parseArgs(["task", "list", "--status", "open", "--tag=cpu-only", "--json", "extra"]);
  assert.equal(parsed.command, "task");
  assert.deepEqual(parsed.positionals, ["list", "extra"]);
  assert.equal(parsed.flags.status, "open");
  assert.equal(parsed.flags.tag, "cpu-only");
  assert.equal(parsed.flags.json, true);
});

test("flag helpers coerce values safely", () => {
  assert.equal(flagString({ limit: "5" }, "limit", "1"), "5");
  assert.equal(flagString({ json: true }, "json", "fallback"), "fallback");
  assert.equal(flagBool({ json: true }, "json"), true);
  assert.equal(flagBool({}, "json"), false);
});

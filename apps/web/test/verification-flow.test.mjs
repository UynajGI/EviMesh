import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D07: the Verification flow makes blind context, findings, and signing explicit. */
const source = await readFile(new URL("../components/verification-workspace.js", import.meta.url), "utf8");

test("verification keeps the blind context boundary visible", () => {
  assert.match(source, /aria-label="Verification workspace"/);
  assert.match(source, /aria-label="Blind Context"/);
  assert.match(source, /Expected outputs hidden/);
  assert.match(source, /blindContext/);
  assert.match(source, /intentionally excluded/);
});

test("verification carries findings, signing key, and outcome fields", () => {
  assert.match(source, /findings/);
  assert.match(source, /verificationTypes/);
  assert.match(source, /signingKeyId/);
  assert.match(source, /outcome/);
  assert.match(source, /contextMode/);
  assert.match(source, /JSON\.parse/);
});

test("verification previews and confirms before submission", () => {
  assert.match(source, /Verification receipt preview/);
  assert.match(source, /I have signed this receipt/);
  assert.match(source, /Not yet signed/);
  assert.match(source, /Confirm/);
  assert.match(source, /Submit this verification\?/);
  assert.match(source, /immutable revision history/);
});

test("verification uses tokens and primitives only", () => {
  assert.match(source, /Switch/);
  assert.match(source, /Select/);
  assert.match(source, /Label htmlFor=/);
  assert.match(source, /Alert variant="destructive"/);
  assert.doesNotMatch(source, /amber|slate|indigo|bg-white/);
});

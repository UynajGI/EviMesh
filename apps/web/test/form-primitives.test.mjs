import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B04: text form primitives are token-based and composable. */
const formSource = await readFile(new URL("../components/ui/form.js", import.meta.url), "utf8");
const inputSource = await readFile(new URL("../components/ui/input.js", import.meta.url), "utf8");

test("form primitives export Label, Help, Error, and FieldGroup", () => {
  for (const name of ["Label", "Help", "Error", "FieldGroup", "Textarea", "Input"]) {
    assert.match(formSource, new RegExp(`export function ${name}\\(`), `missing ${name} in form.js`);
  }
});

test("form primitives use semantic tokens, not hardcoded colors", () => {
  for (const source of [formSource, inputSource]) {
    assert.doesNotMatch(source, /indigo|slate|#[0-9a-f]{6}/i, "form primitives must not hardcode colors");
    assert.match(source, /border-border/);
    assert.match(source, /bg-card/);
    assert.match(source, /ring-focus/);
    assert.match(source, /destructive/);
  }
  assert.match(formSource, /text-destructive/);
});

test("fields expose invalid and disabled states", () => {
  assert.match(inputSource, /aria-\[invalid=true\]:border-destructive/);
  assert.match(inputSource, /disabled:cursor-not-allowed disabled:opacity-50/);
  assert.match(formSource, /min-h-24/);
});

test("FieldGroup wires error and help text with stable ids", () => {
  assert.match(formSource, /htmlFor=\{htmlFor\}/);
  assert.match(formSource, /\$\{htmlFor\}-error/);
  assert.match(formSource, /\$\{htmlFor\}-help/);
});

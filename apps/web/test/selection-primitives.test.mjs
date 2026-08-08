import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B05: selection primitives are token-based and keyboard-operable. */
const source = await readFile(new URL("../components/ui/selection.js", import.meta.url), "utf8");

test("selection primitives export Checkbox, Radio, Select, and Switch", () => {
  for (const name of ["Checkbox", "Radio", "Select", "Switch"]) {
    assert.match(source, new RegExp(`export function ${name}\\(`), `missing ${name}`);
  }
});

test("selection primitives use semantic tokens, not hardcoded colors", () => {
  assert.doesNotMatch(source, /\b(indigo|slate)\b|#[0-9a-f]{6}/i, "selection primitives must not hardcode colors");
  assert.match(source, /ring-focus/);
  assert.match(source, /border-destructive/);
  assert.match(source, /accent-primary/);
});

test("Switch is a keyboard-operable role=switch toggle", () => {
  assert.match(source, /role="switch"/);
  assert.match(source, /aria-checked=\{checked\}/);
  assert.match(source, /onClick=\{\(\) => onCheckedChange\?\.\(!checked\)\}/);
});

test("Select is a styled native element for platform keyboard support", () => {
  assert.match(source, /<select className=/);
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-focus/);
});

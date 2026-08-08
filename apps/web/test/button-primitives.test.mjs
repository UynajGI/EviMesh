import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B03: action primitives expose every variant and state. */
const buttonSource = await readFile(new URL("../components/ui/button.js", import.meta.url), "utf8");

test("Button defines all six semantic variants", () => {
  for (const variant of ["default", "secondary", "outline", "ghost", "destructive", "link"]) {
    assert.match(buttonSource, new RegExp(`${variant}: '`), `missing ${variant} variant`);
  }
});

test("Button variants are built from semantic tokens, not hardcoded colors", () => {
  assert.doesNotMatch(buttonSource, /\b(indigo|slate)\b|#[0-9a-f]{6}/i, "button must not hardcode colors");
  assert.match(buttonSource, /bg-primary/);
  assert.match(buttonSource, /bg-secondary/);
  assert.match(buttonSource, /bg-destructive/);
  assert.match(buttonSource, /ring-focus/);
  assert.match(buttonSource, /ring-offset-background/);
});

test("Button supports loading and disabled states", () => {
  assert.match(buttonSource, /loading = false/);
  assert.match(buttonSource, /aria-busy/);
  assert.match(buttonSource, /disabled:pointer-events-none disabled:opacity-50/);
});

test("Button exports link variants for next/link", () => {
  assert.match(buttonSource, /buttonLinkVariants/);
  assert.match(buttonSource, /underline-offset-4/);
});

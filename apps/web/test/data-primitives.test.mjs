import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B07: data primitives are token-based and tabular-numeral aware. */
const source = await readFile(new URL("../components/ui/data.js", import.meta.url), "utf8");

test("data primitives export Badge, Card, CardHeader, CardContent, and Metadata", () => {
  for (const name of ["Badge", "Card", "CardHeader", "CardContent", "Metadata"]) {
    assert.match(source, new RegExp(`export function ${name}\\(`), `missing ${name}`);
  }
});

test("data primitives use semantic tokens, not hardcoded colors", () => {
  assert.doesNotMatch(source, /\b(indigo|slate)\b|#[0-9a-f]{6}/i, "data primitives must not hardcode colors");
  for (const token of ["bg-muted text-muted-foreground", "bg-primary/10 text-primary", "bg-success/10 text-success", "bg-warning/10 text-warning", "bg-destructive/10 text-destructive", "bg-info/10 text-info"]) {
    assert.match(source, new RegExp(token), `missing ${token} badge variant`);
  }
});

test("Badge covers all status variants plus the default", () => {
  for (const variant of ["default", "primary", "success", "warning", "destructive", "info"]) {
    assert.match(source, new RegExp(`${variant}: '`), `missing ${variant} badge`);
  }
});

test("Card is a flat hairline surface and Metadata uses tabular numerals", () => {
  assert.match(source, /rounded-lg border border-border bg-card/);
  assert.match(source, /tabular-nums/);
  assert.match(source, /<dl /);
});

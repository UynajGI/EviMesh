import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B06: feedback primitives are token-based and recoverable. */
const source = await readFile(new URL("../components/ui/feedback.js", import.meta.url), "utf8");

test("feedback primitives export Alert, Empty, ErrorState, and Skeleton", () => {
  for (const name of ["Alert", "Empty", "ErrorState", "Skeleton"]) {
    assert.match(source, new RegExp(`export function ${name}\\(`), `missing ${name}`);
  }
});

test("feedback primitives use semantic tokens, not hardcoded colors", () => {
  assert.doesNotMatch(source, /\b(indigo|slate)\b|#[0-9a-f]{6}/i, "feedback primitives must not hardcode colors");
  for (const token of ["border-info", "border-success", "border-warning", "border-destructive", "bg-primary", "bg-muted"]) {
    assert.match(source, new RegExp(token), `missing ${token}`);
  }
});

test("Alert covers all four status variants", () => {
  for (const variant of ["info", "success", "warning", "destructive"]) {
    assert.match(source, new RegExp(`${variant}: 'border-${variant} text-${variant}'`), `missing ${variant} alert variant`);
  }
  assert.match(source, /role="alert"/);
});

test("ErrorState and Empty expose recovery and empty patterns", () => {
  assert.match(source, /onRetry/);
  assert.match(source, /retryLabel = 'Try again'/);
  assert.match(source, /border-dashed border-border/);
});

test("feedback primitives omit competitive meter patterns", () => {
  assert.doesNotMatch(source, /role="progressbar"|aria-valuenow/);
});

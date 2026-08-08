import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B08: overlay primitives are token-based and focus-managed. */
const dialogSource = await readFile(new URL("../components/ui/dialog.js", import.meta.url), "utf8");
const tooltipSource = await readFile(new URL("../components/ui/tooltip.js", import.meta.url), "utf8");

test("Dialog surfaces use semantic tokens, not hardcoded colors", () => {
  assert.doesNotMatch(dialogSource, /\b(indigo|slate)\b|#[0-9a-f]{6}/i, "dialog must not hardcode colors");
  assert.match(dialogSource, /bg-card/);
  assert.match(dialogSource, /border-border/);
  assert.match(dialogSource, /bg-background\/80 backdrop-blur-sm/);
  assert.match(dialogSource, /text-muted-foreground/);
});

test("Dialog keeps focus management from Radix and a close affordance", () => {
  assert.match(dialogSource, /@radix-ui\/react-dialog/);
  assert.match(dialogSource, /aria-label="Close dialog"/);
});

test("Confirm is a destructive-aware alertdialog with explicit labels", () => {
  assert.match(dialogSource, /role="alertdialog"/);
  assert.match(dialogSource, /aria-describedby="confirm-description"/);
  assert.match(dialogSource, /confirmLabel = 'Confirm'/);
  assert.match(dialogSource, /cancelLabel = 'Cancel'/);
  assert.match(dialogSource, /destructive = false/);
  assert.match(dialogSource, /variant=\{destructive \? 'destructive' : 'default'\}/);
});

test("Tooltip is hover and keyboard reachable with a tooltip role", () => {
  assert.match(tooltipSource, /role="tooltip"/);
  assert.match(tooltipSource, /aria-describedby=\{id\}/);
  assert.match(tooltipSource, /group-hover\/tooltip:opacity-100/);
  assert.match(tooltipSource, /group-focus-within\/tooltip:opacity-100/);
});

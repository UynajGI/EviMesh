import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B12: the component catalog renders every primitive state for regression. */
const source = await readFile(new URL("../app/design/page.js", import.meta.url), "utf8");

test("catalog showcases every action primitive state", () => {
  for (const variant of ['Primary', 'Secondary', 'Outline', 'Ghost', 'Destructive', 'Link']) {
    assert.match(source, new RegExp(variant), `missing button variant ${variant}`);
  }
  assert.match(source, /loading/);
  assert.match(source, /disabled/);
});

test("catalog showcases all six badge variants", () => {
  for (const variant of ['Primary', 'Success', 'Warning', 'Destructive', 'Info']) {
    assert.match(source, new RegExp(`variant="${variant.toLowerCase()}"`), `missing badge ${variant}`);
  }
  assert.match(source, /Badge>Default/);
});

test("catalog showcases form, selection, feedback, data, and overlay primitives", () => {
  for (const name of ['Input', 'Textarea', 'Checkbox', 'Radio', 'Switch', 'Alert', 'Skeleton', 'Empty', 'Metadata', 'Dialog', 'Tooltip']) {
    assert.match(source, new RegExp(name), `missing ${name}`);
  }
});

test("catalog is the regression baseline on tokens only", () => {
  assert.match(source, /Component catalog/);
  assert.match(source, /visual regression baseline/);
  assert.match(source, /Desktop 1440px \+ mobile 390px/);
  assert.doesNotMatch(source, /slate|indigo|amber|bg-white/);
});

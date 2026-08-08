import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-A06: primary navigation stays at or below six first-level items. */
const navSource = await readFile(new URL("../components/site-nav.js", import.meta.url), "utf8");

function arrayItems(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(match, `could not locate ${name} in site-nav.js`);
  return (match[1].match(/\{ href: '[^']+', label: '[^']+' \}/g) ?? []);
}

test("primary navigation has at most six items", () => {
  const items = arrayItems(navSource, "primaryLinks");
  assert.ok(items.length >= 4 && items.length <= 6, `primary navigation has ${items.length} items, expected 4-6`);
});

test("primary navigation contains the research discovery items", () => {
  const items = arrayItems(navSource, "primaryLinks").join("\n");
  for (const label of ["Projects", "Questions", "Tasks", "Claims", "Verification"]) {
    assert.ok(items.includes(label), `primary navigation is missing ${label}`);
  }
});

test("navigation exposes exactly one primary call to action", () => {
  const ctas = (navSource.match(/bg-primary/g) ?? []).length;
  assert.equal(ctas, 1, "exactly one primary CTA expected in the nav");
});

test("mobile navigation is collapsible with an accessible toggle", () => {
  assert.match(navSource, /aria-expanded/);
  assert.match(navSource, /aria-label="Toggle navigation menu"/);
  assert.match(navSource, /md:hidden/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-B11: page templates provide a consistent header and rhythm. */
const source = await readFile(new URL("../components/ui/page.js", import.meta.url), "utf8");

test("page templates export PageContainer, PageHeader, and SectionHeader", () => {
  for (const name of ["PageContainer", "PageHeader", "SectionHeader"]) {
    assert.match(source, new RegExp(`export function ${name}\\(`), `missing ${name}`);
  }
});

test("PageHeader supports eyebrow, title, description, and an action slot", () => {
  assert.match(source, /eyebrow/);
  assert.match(source, /title/);
  assert.match(source, /description/);
  assert.match(source, /action/);
  assert.match(source, /showDescription = false/);
  assert.match(source, /titleClassName/);
  assert.match(source, /titleColumnClass/);
  assert.match(source, /titleMaxClass/);
  assert.match(source, /grid-cols-12/);
  assert.match(source, /tracking-\[-0\.055em\]/);
});

test('generic page guidance is not rendered as a subtitle by default', async () => {
  const home = await readFile(new URL('../app/home/page.js', import.meta.url), 'utf8');
  assert.doesNotMatch(home, /Seven-day observation window|Change levels show attention priority/);
  assert.match(source, /showDescription && description/);
});

test("PageContainer and SectionHeader keep the quiet rhythm", () => {
  assert.match(source, /max-w-\[96rem\]/);
  assert.match(source, /--evimesh-container-px/);
  assert.match(source, /items-baseline justify-between/);
});

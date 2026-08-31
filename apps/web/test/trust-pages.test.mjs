import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C12: trust pages trace receipts, event causation, and contribution origin. */
const events = await readFile(new URL("../app/events/page.js", import.meta.url), "utf8");
const contributions = await readFile(new URL("../app/contributions/page.js", import.meta.url), "utf8");
const tools = await readFile(new URL("../app/tools/page.js", import.meta.url), "utf8");

test("event audit keeps hash chain and signature traces", () => {
  assert.match(events, /Event audit/);
  assert.match(events, /parents/);
  assert.match(events, /Genesis event/);
  assert.match(events, /signature/);
  assert.match(events, /hash/);
  assert.match(events, /apiFetch/);
});

test("event audit renders on the template with recovery states", () => {
  assert.match(events, /PageContainer/);
  assert.match(events, /PageHeader/);
  assert.match(events, /Skeleton/);
  assert.match(events, /ErrorState/);
  assert.match(events, /Empty/);
  assert.match(events, /requestId/);
});

test("contributions presents signed events as filterable chronology", () => {
  assert.match(contributions, /eventActor/);
  assert.match(contributions, /eventObject/);
  assert.match(contributions, /Filter the record/);
  assert.match(contributions, /Signed contribution events/);
  assert.doesNotMatch(contributions, /entry\.count|RoleBar|ranking/);
});

test("contributions renders on the server page template", () => {
  assert.match(contributions, /PageContainer/);
  assert.match(contributions, /PageHeader/);
  assert.match(contributions, /readEvents/);
  assert.match(contributions, /cache: 'no-store'/);
  assert.match(contributions, /titleClassName="sm:max-w-none sm:whitespace-nowrap"/);
});

test("tools keeps the instrument index title on one desktop line", () => {
  assert.match(tools, /title="Methods you can inspect\."/);
  assert.match(tools, /titleClassName="sm:max-w-none sm:whitespace-nowrap"/);
});

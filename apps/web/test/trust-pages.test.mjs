import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-C12: trust pages trace receipts, event causation, and contribution origin. */
const events = await readFile(new URL("../app/events/page.js", import.meta.url), "utf8");
const contributions = await readFile(new URL("../app/contributions/page.js", import.meta.url), "utf8");

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

test("contributions groups signed events by contributor", () => {
  assert.match(contributions, /byActor/);
  assert.match(contributions, /actorId/);
  assert.match(contributions, /Unknown contributor/);
  assert.match(contributions, /entry\.count/);
  assert.match(contributions, /entry\.types/);
});

test("contributions renders on the template with recovery states", () => {
  assert.match(contributions, /PageContainer/);
  assert.match(contributions, /PageHeader/);
  assert.match(contributions, /ErrorState/);
  assert.match(contributions, /Empty/);
  assert.match(contributions, /apiFetch/);
});

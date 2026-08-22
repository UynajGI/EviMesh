import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("design route map has canonical public people and agent activity routes", async () => {
  const [people, agent, explore] = await Promise.all([
    read("../app/people/[actorId]/page.js"),
    read("../app/agents/[actorId]/page.js"),
    read("../app/explore/page.js"),
  ]);
  assert.match(people, /contributors\/\[actorId\]/);
  for (const wording of ["Agent activity", "Attempt trail", "Public output", "Human-in-the-loop boundary", "Identity card"]) {
    assert.match(agent, new RegExp(wording));
  }
  assert.match(agent, /\/actors\//);
  assert.match(agent, /\/events\?actorId=/);
  assert.match(agent, /Self-declared, not verified/);
  assert.match(explore, /actorType === 'agent'/);
  assert.match(explore, /`\/agents\/\$\{encodeURIComponent\(entry.actorId\)\}`/);
});

test("feedback primitives expose the design-book state classes", async () => {
  const source = await read("../components/ui/feedback.js");
  for (const className of ["blank", "blank--error", "blank--denied", "skeleton", "alert--"]) {
    assert.match(source, new RegExp(className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("agent activity keeps public output attributable and avoids scoring language", async () => {
  const source = await read("../app/agents/[actorId]/page.js");
  assert.match(source, /signedBy/);
  assert.match(source, /ownerActorId/);
  assert.doesNotMatch(source, /score|rating|ranking|percentage/i);
});

test("design inventory primitives expose semantic stream, role, and stepper blocks", async () => {
  const [change, role, agent, notifications, attribution] = await Promise.all([
    read("../components/change-item.js"),
    read("../components/role-bar.js"),
    read("../app/agent/page.js"),
    read("../app/notifications/page.js"),
    read("../components/attribution.js"),
  ]);
  assert.match(change, /changeitem__icon/);
  assert.match(role, /rolebar__seg--/);
  assert.match(role, /aria-label={`Contribution roles/);
  assert.match(agent, /className="stepper/);
  assert.match(notifications, /aria-controls={`notifications-panel-/);
  assert.match(notifications, /role="tabpanel"/);
  assert.match(attribution, /className="attr__via/);
  assert.match(attribution, /\/agents\//);
  assert.match(attribution, /\/people\//);
});

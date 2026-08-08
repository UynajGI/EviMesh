import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D10: unified error recovery keeps raw API errors out of the UI. */
const client = await readFile(new URL("../lib/api-client.mjs", import.meta.url), "utf8");
const feedback = await readFile(new URL("../components/ui/feedback.js", import.meta.url), "utf8");
const claims = await readFile(new URL("../app/claims/page.js", import.meta.url), "utf8");

test("api client maps timeout, offline, and HTTP statuses to readable messages", () => {
  assert.match(client, /The request timed out\. Please try again\./);
  assert.match(client, /You appear to be offline\./);
  assert.match(client, /Your session has expired\. Please sign in again\./);
  assert.match(client, /You do not have permission/);
  assert.match(client, /The requested resource was not found\./);
  assert.match(client, /The service is temporarily unavailable\./);
  assert.match(client, /AbortController/);
  assert.match(client, /navigator\.onLine/);
});

test("api client carries the traceable request ID", () => {
  assert.match(client, /request_id/);
  assert.match(client, /requestId/);
  assert.match(client, /ApiError/);
});

test("ErrorState surfaces an optional request ID", () => {
  assert.match(feedback, /requestId/);
  assert.match(feedback, /request_id: \{requestId\}/);
});

test("claims list consumes apiFetch and shows the request ID on failure", () => {
  assert.match(claims, /apiFetch/);
  assert.match(claims, /reason\.requestId/);
  assert.match(claims, /requestId=\{requestId\}/);
});

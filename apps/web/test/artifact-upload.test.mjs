import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** M13.5-D05: the artifact upload flow shows progress, license, cancel, and retry. */
const panel = await readFile(new URL("../components/artifact-upload-panel.js", import.meta.url), "utf8");
const page = await readFile(new URL("../app/artifacts/upload/page.js", import.meta.url), "utf8");

test("upload flow keeps hashing, signing, and progress reporting", () => {
  assert.match(panel, /crypto\.subtle\.digest/);
  assert.match(panel, /artifacts\/upload-plan/);
  assert.match(panel, /fileName: file\.name/);
  assert.match(panel, /XMLHttpRequest/);
  assert.match(panel, /onprogress/);
  assert.match(panel, /SHA-256/);
  assert.match(panel, /<Progress value=\{progress\}/);
});

test("upload flow surfaces license, cancel, and retry", () => {
  assert.match(panel, /license/);
  assert.match(panel, /CC-BY-4\.0/);
  assert.match(panel, /Cancel upload/);
  assert.match(panel, /AbortController/);
  assert.match(panel, /request\.abort\(\)/);
  assert.match(panel, /Retry upload/);
  assert.match(panel, /Upload cancelled/);
});

test("upload page renders on the page template", () => {
  assert.match(page, /PageContainer/);
  assert.match(page, /PageHeader/);
  assert.match(page, /ArtifactUploadPanel/);
});

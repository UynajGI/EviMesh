import test from 'node:test';
import assert from 'node:assert/strict';
import { detectArtifactMediaType, MediaTypeDetectionError } from '../src/media-type-detection.mjs';

const input = { artifactId: 'artifact_1', revision: 1, expectedMediaType: 'application/json', object: { size: 1 } };

test('returns no Finding when detected and declared media types agree', async () => {
  const result = await detectArtifactMediaType({ ...input, detector: async () => 'application/json' });
  assert.deepEqual(result, { matches: true, actualMediaType: 'application/json', finding: null });
});

test('emits a Finding for an actual media-type conflict', async () => {
  const result = await detectArtifactMediaType({ ...input, detector: async () => 'text/plain' });
  assert.equal(result.finding.code, 'ARTIFACT_MEDIA_TYPE_MISMATCH');
  assert.equal(result.finding.actualMediaType, 'text/plain');
  await assert.rejects(() => detectArtifactMediaType({ ...input, detector: async () => 'not-a-type' }), MediaTypeDetectionError);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicCapabilities } from '../src/public-capabilities.mjs';

test('defaults to a truthful public preview with research writes disabled', () => {
  assert.deepEqual(resolvePublicCapabilities(), {
    schemaVersion: 'public-capabilities.v1',
    releaseChannel: 'preview',
    apiVersion: '0.3.0',
    graphSchemaVersion: 'research-neighborhood.v1',
    deviceAuthorization: { enabled: false },
    research: {
      read: true,
      prepare: false,
      submit: false,
      signing: 'human-local-only',
    },
    clients: {
      sdk: { available: false, minimumVersion: null },
      cli: { available: false, minimumVersion: null },
      mcp: { available: false, minimumVersion: null },
    },
  });
});

test('does not advertise a requested capability until its runtime is ready', () => {
  const capabilities = resolvePublicCapabilities({
    env: {
      EVIMESH_RELEASE_CHANNEL: 'ga',
      EVIMESH_DEVICE_AUTH_ENABLED: 'true',
      EVIMESH_RESEARCH_PREPARE_ENABLED: 'true',
      EVIMESH_RESEARCH_SUBMIT_ENABLED: 'true',
      EVIMESH_MINIMUM_CLI_VERSION: 'not-a-version',
    },
  });

  assert.equal(capabilities.releaseChannel, 'ga');
  assert.equal(capabilities.deviceAuthorization.enabled, false);
  assert.equal(capabilities.research.prepare, false);
  assert.equal(capabilities.research.submit, false);
  assert.deepEqual(capabilities.clients.cli, { available: false, minimumVersion: null });
});

test('advertises only explicitly enabled and wired capabilities', () => {
  const capabilities = resolvePublicCapabilities({
    env: {
      EVIMESH_RELEASE_CHANNEL: 'beta',
      EVIMESH_DEVICE_AUTH_ENABLED: 'true',
      EVIMESH_RESEARCH_PREPARE_ENABLED: 'true',
      EVIMESH_RESEARCH_SUBMIT_ENABLED: 'true',
      EVIMESH_MINIMUM_SDK_VERSION: '1.0.0-rc.1',
      EVIMESH_MINIMUM_CLI_VERSION: '1.0.0-rc.1',
      EVIMESH_MINIMUM_MCP_VERSION: '1.0.0-rc.1',
    },
    deviceAuthorizationAvailable: true,
    researchPrepareAvailable: true,
    researchSubmitAvailable: true,
  });

  assert.equal(capabilities.releaseChannel, 'beta');
  assert.equal(capabilities.deviceAuthorization.enabled, true);
  assert.equal(capabilities.research.prepare, true);
  assert.equal(capabilities.research.submit, true);
  assert.deepEqual(capabilities.clients.sdk, { available: true, minimumVersion: '1.0.0-rc.1' });
  assert.deepEqual(capabilities.clients.cli, { available: true, minimumVersion: '1.0.0-rc.1' });
  assert.deepEqual(capabilities.clients.mcp, { available: true, minimumVersion: '1.0.0-rc.1' });
});

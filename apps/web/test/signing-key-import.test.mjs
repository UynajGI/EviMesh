import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { parseExportedPublicKey, PUBLIC_KEY_SCHEMA } from '../lib/signing-key-import.mjs';

const publicKey = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64url');
const exported = (overrides = {}) => JSON.stringify({
  schema: PUBLIC_KEY_SCHEMA,
  keyId: 'key_0123456789abcdef',
  label: 'Laptop',
  algorithm: 'Ed25519',
  publicKey,
  fingerprint: 'sha256:abc',
  state: 'active',
  ...overrides,
});

test('accepts the sq key export-public record and keeps only public fields', () => {
  assert.deepEqual({ ...parseExportedPublicKey(exported()) }, { keyId: 'key_0123456789abcdef', publicKey, label: 'Laptop' });
});

test('refuses private or encrypted key material before any request', () => {
  assert.throws(() => parseExportedPublicKey('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'), /private key/);
  assert.throws(() => parseExportedPublicKey(exported({ privateKey: 'x' })), /private key fields/);
  assert.throws(() => parseExportedPublicKey(exported({ encryptedPrivateKey: { ciphertext: 'x' } })), /private key fields/);
});

test('rejects malformed, foreign, or disabled records', () => {
  assert.throws(() => parseExportedPublicKey(''), /sq key export-public/);
  assert.throws(() => parseExportedPublicKey('{'), /valid JSON/);
  assert.throws(() => parseExportedPublicKey(exported({ schema: 'other' })), /schema/);
  assert.throws(() => parseExportedPublicKey(exported({ algorithm: 'RSA' })), /Ed25519/);
  assert.throws(() => parseExportedPublicKey(exported({ publicKey: `${publicKey}=` })), /canonical/);
  assert.throws(() => parseExportedPublicKey(exported({ state: 'disabled' })), /disabled/);
});

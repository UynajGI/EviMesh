import { createLocalIdentity, revokeLocalIdentity } from "../../src/identity.mjs";

const TEST_KDF = Object.freeze({ N: 1024, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });

try {
  const request = JSON.parse(process.argv[2]);
  const env = { ...process.env, EVIMESH_CONFIG_DIR: request.dir, HOME: request.dir, USERPROFILE: request.dir };
  const common = { env, lockOptions: { timeoutMs: 5_000, retryMs: 5, staleMs: 500 } };
  const result = request.action === "create"
    ? createLocalIdentity({ ...common, passphrase: request.passphrase, label: request.label, kdfParams: TEST_KDF })
    : revokeLocalIdentity({ ...common, keyId: request.keyId });
  process.stdout.write(`${JSON.stringify({ ok: true, result })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, code: error?.code ?? "CLI_ERROR", message: error?.message ?? "operation failed" })}\n`);
  process.exitCode = 2;
}

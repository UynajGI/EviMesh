// One-shot E2E: mirror a sample frontier bundle to the public mirror repo.
// Usage: node scripts/mirror-e2e.mjs  (requires gh auth token in gh CLI)
import { execFileSync } from "node:child_process";
import { createSourceRepository } from "../packages/frontier-bundle/test/helpers.mjs";
import { exportFrontierBundle } from "../packages/frontier-bundle/src/exporter.mjs";
import { createGitHubMirrorClient } from "../packages/frontier-bundle/src/github-release.mjs";
import { mirrorFrontierBundle } from "../packages/frontier-bundle/src/mirror.mjs";

const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
const repository = createSourceRepository();
const receipts = [];
repository.insertMirrorReceipt = async (receipt) => { receipts.push(receipt); return receipt; };

const snapshot = await repository.getFrontierSnapshot("frontier_1");
const { zip, manifest } = await exportFrontierBundle({ repository, snapshotId: "frontier_1", zip: true });
console.log(`exported bundle ${manifest.bundleId}: ${zip.length} bytes, ${manifest.files.length} files`);

const client = createGitHubMirrorClient({ token, owner: "UynajGI", repo: "EviMesh-frontiers" });
const result = await mirrorFrontierBundle({ client, repository, snapshot, zipBytes: zip, fileName: `${snapshot.snapshotId}.zip` });
console.log("mirrored:", result.mirrored);
console.log("release:", result.releaseUrl);
console.log("asset:", result.assetUrl);
console.log("receipt:", JSON.stringify(receipts[0], null, 2));

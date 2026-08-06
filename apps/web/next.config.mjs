import { fileURLToPath } from 'node:url';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/** Keep Turbopack resolution inside the EviMesh pnpm workspace. */
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

initOpenNextCloudflareForDev();

export default {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

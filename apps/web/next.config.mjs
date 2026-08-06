import { fileURLToPath } from 'node:url';

/** Keep Turbopack resolution inside the EviMesh pnpm workspace. */
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

export default {
  turbopack: { root: workspaceRoot },
};

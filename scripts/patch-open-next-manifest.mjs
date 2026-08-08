import { readFile, writeFile } from 'node:fs/promises';

const handlerPath = new URL('../apps/web/.open-next/server-functions/default/apps/web/handler.mjs', import.meta.url);
const source = await readFile(handlerPath, 'utf8');
const from = 'getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}';
const to = 'getMiddlewareManifest(){return this.minimalMode?null:{version:3,middleware:{},sortedMiddleware:[],functions:{}}}';
const safe = 'getMiddlewareManifest(){return null}';
const sourceMatches = source.split(from).length - 1;
const patchedMatches = source.split(to).length - 1;
const safeMatches = source.split(safe).length - 1;

if (sourceMatches === 0 && patchedMatches + safeMatches === 1) {
  console.log('OpenNext middleware manifest loader is already safe for an app without middleware.');
} else if (sourceMatches === 1 && patchedMatches === 0 && safeMatches === 0) {
  await writeFile(handlerPath, source.replace(from, to), 'utf8');
  console.log('Patched OpenNext middleware manifest loader for an app without middleware.');
} else {
  throw new Error(
    `Expected one original or safe middleware manifest loader, found original=${sourceMatches}, patched=${patchedMatches}, safe=${safeMatches}`,
  );
}

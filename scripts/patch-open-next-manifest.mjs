import { readFile, writeFile } from 'node:fs/promises';

const handlerPath = new URL('../apps/web/.open-next/server-functions/default/apps/web/handler.mjs', import.meta.url);
const source = await readFile(handlerPath, 'utf8');
const from = 'getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}';
const to = 'getMiddlewareManifest(){return this.minimalMode?null:{version:3,middleware:{},sortedMiddleware:[],functions:{}}}';
const matches = source.split(from).length - 1;

if (matches !== 1) {
  throw new Error(`Expected exactly one middleware manifest loader, found ${matches}`);
}

await writeFile(handlerPath, source.replace(from, to), 'utf8');
console.log('Patched OpenNext middleware manifest loader for an app without middleware.');

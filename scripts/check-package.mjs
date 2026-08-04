import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const packagePath = join(process.cwd(), "package.json");
const readmePath = join(process.cwd(), "README.md");

if (!existsSync(packagePath)) {
  console.error(`Missing package manifest: ${packagePath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
if (!manifest.name) {
  console.error(`Package has no name: ${packagePath}`);
  process.exit(1);
}

if (!existsSync(readmePath)) {
  console.error(`Missing package README: ${readmePath}`);
  process.exit(1);
}

console.log(`${manifest.name}: manifest and README are present`);

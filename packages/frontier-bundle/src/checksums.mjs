import { sha256Hex } from "./manifest.mjs";

/**
 * Generate checksums.txt (M12-09): `sha256  <path>` lines for every bundle
 * file except checksums.txt itself, sorted by path.
 */
export function generateChecksums(files) {
  const lines = [];
  for (const [path, content] of Object.entries(files)) {
    if (path === "checksums.txt") continue;
    lines.push(`${sha256Hex(content)}  ${path}`);
  }
  lines.sort((a, b) => a.split("  ")[1].localeCompare(b.split("  ")[1]));
  return `${lines.join("\n")}\n`;
}

/** Parse checksums.txt into a path → sha256 map. */
export function parseChecksums(text) {
  const checksums = new Map();
  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const match = /^([0-9a-f]{64})\s{2}(\S+)$/.exec(trimmed);
    if (!match) throw new Error(`invalid checksum line: ${trimmed}`);
    checksums.set(match[2], match[1]);
  }
  return checksums;
}

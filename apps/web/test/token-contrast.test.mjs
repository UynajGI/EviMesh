import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * M13.5-B01: semantic color tokens must meet WCAG 2.2 AA (4.5:1) for text
 * pairs in both light and dark themes. Values are parsed straight from
 * globals.css, so any token regression fails CI.
 */
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function parseBlock(source, start) {
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

function extractTokens(block) {
  const tokens = {};
  const pattern = /--evimesh-([a-z0-9-]+):\s*(oklch\([^)]+\)|[^;]+);/g;
  let match;
  while ((match = pattern.exec(block)) !== null) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

function resolveColor(tokens, name, seen = new Set()) {
  assert.ok(tokens[name], `missing token --evimesh-${name}`);
  assert.ok(!seen.has(name), `cyclic token reference at --evimesh-${name}`);
  const next = new Set(seen).add(name);
  const reference = /^var\(--evimesh-([a-z0-9-]+)\)$/.exec(tokens[name]);
  return reference ? resolveColor(tokens, reference[1], next) : tokens[name];
}

function parseOklch(value) {
  const match = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/.exec(value.trim());
  assert.ok(match, `expected oklch, got: ${value}`);
  return { L: Number(match[1]), C: Number(match[2]), H: Number(match[3]) };
}

function oklchToLinearRgb({ L, C, H }) {
  const radians = (H * Math.PI) / 180;
  const a = C * Math.cos(radians);
  const b = C * Math.sin(radians);
  const lPrime = L + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = L - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ].map((value) => Math.min(1, Math.max(0, value)));
}

function luminance(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function tokensFor(theme) {
  const rootOpen = css.indexOf(":root");
  const block = theme === "dark" ? parseBlock(css, css.indexOf("prefers-color-scheme: dark")) : parseBlock(css, rootOpen);
  return extractTokens(block);
}

test("defines the complete semantic token set in both themes", () => {
  for (const theme of ["light", "dark"]) {
    const tokens = tokensFor(theme);
    for (const name of ["background", "foreground", "card", "card-foreground", "muted", "muted-foreground", "secondary", "secondary-foreground", "accent", "accent-foreground", "border", "primary", "primary-foreground", "destructive", "destructive-foreground", "success", "success-foreground", "warning", "warning-foreground", "info", "info-foreground", "focus", "ring"]) {
      assert.ok(tokens[name], `${theme} theme is missing --evimesh-${name}`);
    }
    // M13.8 status dual tiers + emphasis + DAG edges.
    for (const family of ["neutral", "accent", "success", "warning", "danger", "info"]) {
      for (const part of ["bg", "fg", "border"]) {
        assert.ok(tokens[`status-${family}-${part}`], `${theme} theme is missing --evimesh-status-${family}-${part}`);
      }
    }
    for (const name of ["emphasis-success", "emphasis-warning", "emphasis-danger", "emphasis-info", "emphasis-neutral", "emphasis-foreground", "dag-positive", "dag-negative", "dag-qualify", "dag-structural", "dag-lineage"]) {
      assert.ok(tokens[name], `${theme} theme is missing --evimesh-${name}`);
    }
  }
});

test("keeps primitive, semantic, and component token layers", () => {
  const light = tokensFor("light");
  const primitiveNames = Object.keys(light).filter((name) => name.startsWith("p-"));
  const componentNames = Object.keys(light).filter((name) => name.startsWith("c-"));
  assert.ok(primitiveNames.length >= 30, `expected primitive ramp, got ${primitiveNames.length}`);
  assert.ok(componentNames.length >= 6, `expected component decisions, got ${componentNames.length}`);
  assert.match(css, /--evimesh-background:\s*var\(--evimesh-p-/);
  assert.match(css, /--evimesh-c-card-bg:\s*var\(--evimesh-card\)/);
  assert.equal(resolveColor(light, "background"), light["p-neutral-50"]);
});

test("text pairs meet WCAG 2.2 AA contrast (4.5:1) in both themes", () => {
  for (const theme of ["light", "dark"]) {
    const tokens = tokensFor(theme);
    const color = (name) => oklchToLinearRgb(parseOklch(resolveColor(tokens, name)));
    const pairs = [
      ["foreground", "background"],
      ["card-foreground", "card"],
      ["muted-foreground", "background"],
      ["muted-foreground", "card"],
      ["muted-foreground", "muted"],
      ["secondary-foreground", "secondary"],
      ["accent-foreground", "accent"],
      ["primary-foreground", "primary"],
      ["destructive-foreground", "destructive"],
      ["success-foreground", "success"],
      ["warning-foreground", "warning"],
      ["info-foreground", "info"],
    ];
    for (const [fg, bg] of pairs) {
      const ratio = contrastRatio(color(fg), color(bg));
      assert.ok(ratio >= 4.5, `${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, expected >= 4.5:1`);
    }
    // M13.8: dual-tier badge text on its own surface AND on the page/card
    // background (badges also render as standalone text).
    for (const family of ["neutral", "accent", "success", "warning", "danger", "info"]) {
      const fg = `status-${family}-fg`;
      for (const bg of [`status-${family}-bg`, "background", "card"]) {
        const ratio = contrastRatio(color(fg), color(bg));
        assert.ok(ratio >= 4.5, `${theme}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, expected >= 4.5:1`);
      }
    }
    for (const family of ["success", "warning", "danger", "info", "neutral"]) {
      const ratio = contrastRatio(color("emphasis-foreground"), color(`emphasis-${family}`));
      assert.ok(ratio >= 4.5, `${theme}: emphasis-foreground on emphasis-${family} is ${ratio.toFixed(2)}:1, expected >= 4.5:1`);
    }
  }
});

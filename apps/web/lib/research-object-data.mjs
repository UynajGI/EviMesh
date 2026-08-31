const DIRECTIONS = new Set(['upstream', 'downstream', 'both']);

export function researchNeighborhoodPath(kind, id, { depth = 3, direction = 'both' } = {}) {
  const normalizedDepth = Number(depth);
  if (!Number.isInteger(normalizedDepth) || normalizedDepth < 1 || normalizedDepth > 3) {
    throw new RangeError('depth must be between 1 and 3');
  }
  if (!DIRECTIONS.has(direction)) throw new TypeError('direction must be upstream, downstream, or both');
  return `/research-graph/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/neighborhood?depth=${normalizedDepth}&direction=${direction}`;
}

/** Injected reader keeps the Server Component boundary easy to test. */
export function readResearchNeighborhood(readJson, { kind, id, depth = 3, direction = 'both' }) {
  return readJson(researchNeighborhoodPath(kind, id, { depth, direction }));
}

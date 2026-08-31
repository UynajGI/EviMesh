function commaList(value) {
  if (value === null || value === undefined) return undefined;
  return Array.isArray(value) ? value.join(",") : value;
}

export function createResearchGraphClient(http) {
  return Object.freeze({
    neighborhood: (kind, id, { revision = undefined, direction = "both", depth = 1, kinds = undefined, edgeTypes = undefined, cursor = undefined } = {}) =>
      http.request("GET", `/research-graph/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/neighborhood`, {
        query: { revision, direction, depth, kinds: commaList(kinds), edgeTypes: commaList(edgeTypes), cursor },
      }),
  });
}

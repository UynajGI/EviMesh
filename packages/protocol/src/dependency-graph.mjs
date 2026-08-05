function assertEndpoint(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function buildDependencyGraph(edges) {
  if (!Array.isArray(edges)) {
    throw new TypeError('dependency edges must be an array');
  }

  const graph = new Map();
  edges.forEach((edge) => {
    if (!edge || (edge.type !== undefined && edge.type !== 'depends_on')) {
      throw new TypeError('dependency graph accepts only depends_on edges');
    }
    assertEndpoint(edge.source, 'dependency source');
    assertEndpoint(edge.target, 'dependency target');
    if (edge.source === edge.target) {
      throw new RangeError('a claim cannot depend_on itself');
    }
    const targets = graph.get(edge.source) ?? new Set();
    targets.add(edge.target);
    graph.set(edge.source, targets);
  });

  return graph;
}

function hasPath(graph, from, target, visited = new Set()) {
  if (from === target) {
    return true;
  }
  if (visited.has(from)) {
    return false;
  }
  visited.add(from);
  return [...(graph.get(from) ?? [])].some((next) => hasPath(graph, next, target, visited));
}

export function assertDependencyGraph(edges) {
  const graph = buildDependencyGraph(edges);
  const visiting = new Set();
  const visited = new Set();

  function visit(node) {
    if (visiting.has(node)) {
      throw new RangeError('depends_on graph must be acyclic');
    }
    if (visited.has(node)) {
      return;
    }
    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      visit(next);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    visit(node);
  }
  return true;
}

export function canAddDependency(edges, source, target) {
  assertEndpoint(source, 'dependency source');
  assertEndpoint(target, 'dependency target');
  if (source === target) {
    return false;
  }
  assertDependencyGraph(edges);
  const graph = buildDependencyGraph(edges);
  return !hasPath(graph, target, source);
}

export function assertDependencyAddition(edges, source, target) {
  if (!canAddDependency(edges, source, target)) {
    throw new RangeError('depends_on addition would create a cycle');
  }
  return true;
}

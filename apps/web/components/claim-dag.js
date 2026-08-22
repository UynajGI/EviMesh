'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphStratify, sugiyama, layeringLongestPath, decrossTwoLayer, coordSimplex } from 'd3-dag';
import {
  Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/data';
import { Select } from '@/components/ui/selection';

/*
 * Claim relation graph (design book 00 §5.3 / 10 implementation map):
 * d3-dag Sugiyama layered layout as the layout engine + React Flow as the
 * interaction layer (pan, zoom, selection). The keyboard- and list-accessible
 * equivalent view stays a first-class citizen (M13.5 C11). Color is never the
 * only carrier: node states pair fill color with the state label, and the
 * legend lists every state with its name.
 */

export const CLAIM_STATE_COLORS = Object.freeze({
  hypothesis: 'var(--evimesh-status-neutral-fg)',
  candidate: 'var(--evimesh-status-accent-fg)',
  under_verification: 'var(--evimesh-status-info-fg)',
  provisionally_accepted: 'var(--evimesh-status-success-fg)',
  accepted: 'var(--evimesh-status-success-fg)',
  contested: 'var(--evimesh-status-warning-fg)',
  refuted: 'var(--evimesh-status-danger-fg)',
  superseded: 'var(--evimesh-status-neutral-fg)',
  retracted: 'var(--evimesh-status-neutral-fg)',
  dependency_tainted: 'var(--evimesh-status-warning-fg)',
});

const EDGE_FAMILIES = Object.freeze({
  depends_on: 'structural',
  supports: 'positive',
  refutes: 'negative',
  qualifies: 'qualify',
  reproduces: 'positive',
  extends: 'lineage',
  supersedes: 'lineage',
  contradicts: 'negative',
  derived_from: 'lineage',
  uses_method: 'structural',
  uses_dataset: 'structural',
  implements: 'structural',
  verifies: 'positive',
  challenges: 'negative',
});

function edgeFamilyFor(relation) {
  return EDGE_FAMILIES[relation] ?? 'structural';
}

/** Keyboard- and list-accessible alternative to the graph canvas. */
function ClaimDagList({ nodes, edges }) {
  return <div aria-label="Claim graph list view" className="grid gap-6 md:grid-cols-2">
    <div><h3 className="text-sm font-semibold">Nodes</h3><ul className="mt-3 space-y-2">{nodes.map((node) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3" key={node.id}><span className="text-sm font-medium tabular-nums">{node.id}</span><Badge>{node.state ?? 'unknown'}</Badge></li>)}</ul></div>
    <div><h3 className="text-sm font-semibold">Edges</h3>{edges.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No connections.</p> : <ul className="mt-3 space-y-2">{edges.map((edge) => <li className="rounded-lg border border-border bg-card p-3 text-sm tabular-nums" key={edge.id}>{edge.source} → {edge.target} <span className="ml-2 text-xs text-muted-foreground">{edge.relation ?? 'depends_on'}</span></li>)}</ul>}</div>
  </div>;
}

/** Sugiyama layout via d3-dag: returns nodes with x/y coordinates. */
function layoutGraph(nodes, edges) {
  if (nodes.length === 0) return { positioned: [], width: 0, height: 0 };
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const stratifyData = nodes.map((node) => ({
    id: node.id,
    parentIds: edges.filter((edge) => edge.target === node.id && byId.has(edge.source)).map((edge) => edge.source),
  }));
  try {
    const dagBuilder = graphStratify();
    const dag = dagBuilder(stratifyData);
    const layout = sugiyama().layering(layeringLongestPath()).decross(decrossTwoLayer()).coord(coordSimplex()).nodeSize([160, 56]).gap([24, 48]);
    const { width, height } = layout(dag);
    const positioned = [];
    for (const node of dag.nodes()) {
      positioned.push({ id: node.data.id, x: node.x, y: node.y });
    }
    return { positioned, width, height };
  } catch {
    /* cyclic or degenerate input: fall back to a vertical stack */
    return { positioned: nodes.map((node, index) => ({ id: node.id, x: 80, y: index * 80 })), width: 240, height: nodes.length * 80 };
  }
}

function ClaimGraphCanvas({ nodes, edges, onSelect }) {
  const { setCenter } = useReactFlow();
  const { positioned, width, height } = useMemo(() => layoutGraph(nodes, edges), [nodes, edges]);
  const coordinates = new Map(positioned.map((node) => [node.id, node]));

  const flowNodes = useMemo(() => nodes.map((node) => {
    const point = coordinates.get(node.id) ?? { x: 0, y: 0 };
    const color = CLAIM_STATE_COLORS[node.state] ?? 'var(--evimesh-status-accent-fg)';
    return {
      id: node.id,
      position: { x: point.x, y: point.y },
      data: { label: `${node.id} · ${node.state ?? 'unknown'}`, color, state: node.state },
      style: {
        background: color, color: 'var(--evimesh-emphasis-foreground)', border: 'none', borderRadius: '8px',
        fontSize: '11px', width: 160, padding: '4px 8px',
      },
    };
  }), [nodes, coordinates]);

  /* The graph API returns typed relation edges. Keep a depends_on label only
   * for legacy payloads that predate the edge list. */
  const flowEdges = useMemo(() => edges.map((edge, index) => {
    const family = edgeFamilyFor(edge.relation);
    return {
      id: edge.id ?? `edge-${index}`,
      source: edge.source,
      target: edge.target,
      animated: false,
      type: 'default',
      label: edge.relation ?? 'depends_on',
      labelStyle: { fill: 'var(--evimesh-muted-foreground)', fontSize: 9 },
      labelBgStyle: { fill: 'var(--evimesh-card)' },
      className: `dag__edge dag__edge--${family}`,
      style: { stroke: `var(--evimesh-dag-${family})`, strokeWidth: 1.5 },
    };
  }), [edges]);

  const onNodeClick = useCallback((_, node) => onSelect({ id: node.id, state: node.data.state }), [onSelect]);

  return (
    <div aria-label="Claim relation graph" className="dag mt-3 h-80 w-full overflow-hidden rounded-lg border border-border bg-card" role="application">
      <ReactFlow
        edges={flowEdges}
        fitView
        maxZoom={2}
        minZoom={0.2}
        nodes={flowNodes}
        nodesConnectable={false}
        nodesDraggable={false}
        onNodeClick={onNodeClick}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
        <Controls fitViewOptions={{ padding: 0.2 }} onFitView={() => setCenter(width / 2, height / 2, { zoom: 1 })} showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function ClaimDag({ elements }) {
  const [view, setView] = useState('graph');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const rawNodes = (elements ?? []).filter((element) => element.data?.id && !element.data?.source).map((element) => ({ id: element.data.id, state: element.data.state ?? null }));
  const rawEdges = (elements ?? []).filter((element) => element.data?.source).map((element) => ({ id: element.data.id, source: element.data.source, target: element.data.target, relation: element.data.relationType ?? element.data.relation ?? 'depends_on' }));
  const visibleNodeIds = new Set(stateFilter ? rawNodes.filter((node) => node.state === stateFilter).map((node) => node.id) : rawNodes.map((node) => node.id));
  const nodes = rawNodes.filter((node) => visibleNodeIds.has(node.id));
  const edges = rawEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  const states = [...new Set(rawNodes.map((node) => node.state).filter(Boolean))].sort();

  useEffect(() => {
    if (!selectedNode?.id) return undefined;
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}/claims/${selectedNode.id}`).then((response) => response.json()).then((payload) => {
      if (!cancelled) setSelectedDetail(payload);
    }).catch(() => {
      if (!cancelled) setSelectedDetail(null);
    });
    return () => { cancelled = true; };
  }, [selectedNode]);

  const evidence = selectedNode?.evidence ?? selectedDetail?.evidence ?? [];
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="tablist" aria-label="Claim graph view" className="flex gap-1 rounded-md border border-border p-1"><button type="button" role="tab" aria-selected={view === 'graph'} onClick={() => setView('graph')} className={view === 'graph' ? 'rounded px-3 py-1 text-sm font-medium bg-primary/10 text-primary' : 'rounded px-3 py-1 text-sm font-medium text-muted-foreground'}>Graph</button><button type="button" role="tab" aria-selected={view === 'list'} onClick={() => setView('list')} className={view === 'list' ? 'rounded px-3 py-1 text-sm font-medium bg-primary/10 text-primary' : 'rounded px-3 py-1 text-sm font-medium text-muted-foreground'}>List</button></div>
      <label className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Filter by state</span><Select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="w-44"><option value="">All states</option>{states.map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}</Select></label>
    </div>
    {view === 'graph'
      ? <ReactFlowProvider><ClaimGraphCanvas edges={edges} nodes={nodes} onSelect={setSelectedNode} /></ReactFlowProvider>
      : <div className="mt-3"><ClaimDagList edges={edges} nodes={nodes} /></div>}
    {selectedNode && view === 'graph' && <aside aria-label="Claim node details" className="mt-4 rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-mono text-sm tabular-nums">{selectedNode.id}</h3><button className="rounded-md border border-border px-2 py-1 text-xs" type="button" onClick={() => { setSelectedNode(null); setSelectedDetail(null); }}>Close</button></div><p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">State: {selectedNode.state ?? 'unknown'}</p><p className="mt-3 text-sm">Revision: {selectedDetail?.currentRevision?.revision ?? selectedNode.revision ?? 'Unavailable'}</p><p className="mt-2 text-sm">Evidence: {Array.isArray(evidence) ? evidence.length : 0} linked items</p>{Array.isArray(evidence) && evidence.length > 0 && <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-6">{JSON.stringify(evidence, null, 2)}</pre>}</aside>}
    <p className="mt-2 text-xs text-muted-foreground">Edges retain the protocol relation type; the list view exposes the same typed edges.</p>
    <div aria-label="Claim state legend" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{Object.keys(CLAIM_STATE_COLORS).map((state) => <span className="inline-flex items-center gap-2" key={state}><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: CLAIM_STATE_COLORS[state] }} />{state.replaceAll('_', ' ')}</span>)}</div>
    {/* Edge family legend (design book 02: five DAG edge families). */}
    <div aria-label="DAG edge family legend" className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {[['positive', 'supports / reproduces / verifies'], ['negative', 'refutes / contradicts / challenges'], ['qualify', 'qualifies'], ['structural', 'depends on / uses / implements'], ['lineage', 'extends / supersedes / derived from']].map(([family, label]) => (
        <span className="inline-flex items-center gap-2" key={family}>
          <span aria-hidden="true" className="h-1 w-4 rounded-full" style={{ backgroundColor: `var(--evimesh-dag-${family}, var(--evimesh-border))` }} />
          {label}
        </span>
      ))}
    </div>
  </div>;
}

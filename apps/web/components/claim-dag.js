'use client';

import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { Badge } from '@/components/ui/data';
import { Select } from '@/components/ui/selection';

export const CLAIM_STATE_COLORS = Object.freeze({
  hypothesis: '#64748b',
  candidate: '#2563eb',
  under_verification: '#7c3aed',
  provisionally_accepted: '#0891b2',
  accepted: '#16a34a',
  contested: '#d97706',
  refuted: '#dc2626',
  superseded: '#9333ea',
  retracted: '#475569',
  dependency_tainted: '#ea580c',
});

/** Keyboard- and list-accessible alternative to the Cytoscape canvas. */
function ClaimDagList({ nodes, edges }) {
  return <div aria-label="Claim graph list view" className="grid gap-6 md:grid-cols-2">
    <div><h3 className="text-sm font-semibold">Nodes</h3><ul className="mt-3 space-y-2">{nodes.map((node) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3" key={node.id}><span className="text-sm font-medium tabular-nums">{node.id}</span><Badge>{node.state ?? 'unknown'}</Badge></li>)}</ul></div>
    <div><h3 className="text-sm font-semibold">Edges</h3>{edges.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No connections.</p> : <ul className="mt-3 space-y-2">{edges.map((edge) => <li className="rounded-lg border border-border bg-card p-3 text-sm tabular-nums" key={edge.id}>{edge.source} → {edge.target}</li>)}</ul>}</div>
  </div>;
}

export function ClaimDag({ elements }) {
  const containerRef = useRef(null);
  const [view, setView] = useState('graph');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const rawNodes = (elements ?? []).filter((element) => element.data?.id && !element.data?.source).map((element) => ({ id: element.data.id, state: element.data.state ?? null }));
  const rawEdges = (elements ?? []).filter((element) => element.data?.source).map((element) => ({ id: element.data.id, source: element.data.source, target: element.data.target }));
  const visibleNodeIds = new Set(stateFilter ? rawNodes.filter((node) => node.state === stateFilter).map((node) => node.id) : rawNodes.map((node) => node.id));
  const nodes = rawNodes.filter((node) => visibleNodeIds.has(node.id));
  const edges = rawEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  const states = [...new Set(rawNodes.map((node) => node.state).filter(Boolean))].sort();

  useEffect(() => {
    const filtered = new Set(visibleNodeIds);
    const coloredElements = (elements ?? []).filter((element) => !element.data?.source || (filtered.has(element.data.source) && filtered.has(element.data.target))).map((element) => element.data?.state ? {
      ...element,
      data: { ...element.data, color: CLAIM_STATE_COLORS[element.data.state] ?? '#5146e5' },
    } : element);
    const cy = cytoscape({ container: containerRef.current, elements: coloredElements, layout: { name: 'breadthfirst', directed: true, padding: 24 }, style: [
      { selector: 'node', style: { label: 'data(label)', 'background-color': 'data(color)', color: '#ffffff', 'text-valign': 'center', 'text-halign': 'center', width: 46, height: 46, 'font-size': 11 } },
      { selector: 'edge', style: { width: 2, 'line-color': '#a8a29e', 'target-arrow-color': '#a8a29e', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
    ] });
    cy.on('tap', 'node', (event) => setSelectedNode(event.target.data()));
    return () => cy.destroy();
  }, [elements, stateFilter]);

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
    {view === 'graph' ? <div aria-label="Claim dependency graph" className="mt-3 h-80 w-full rounded-lg border border-border bg-card" ref={containerRef} /> : <div className="mt-3"><ClaimDagList nodes={nodes} edges={edges} /></div>}
    {selectedNode && view === 'graph' && <aside aria-label="Claim node details" className="mt-4 rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-mono text-sm tabular-nums">{selectedNode.id}</h3><button className="rounded-md border border-border px-2 py-1 text-xs" type="button" onClick={() => { setSelectedNode(null); setSelectedDetail(null); }}>Close</button></div><p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">State: {selectedNode.state ?? 'unknown'}</p><p className="mt-3 text-sm">Revision: {selectedDetail?.currentRevision?.revision ?? selectedNode.revision ?? 'Unavailable'}</p><p className="mt-2 text-sm">Evidence: {Array.isArray(evidence) ? evidence.length : 0} linked items</p>{Array.isArray(evidence) && evidence.length > 0 && <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-6">{JSON.stringify(evidence, null, 2)}</pre>}</aside>}
    <div aria-label="Claim state legend" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{Object.keys(CLAIM_STATE_COLORS).map((state) => <span className="inline-flex items-center gap-2" key={state}><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: CLAIM_STATE_COLORS[state] }} />{state.replaceAll('_', ' ')}</span>)}</div>
  </div>;
}

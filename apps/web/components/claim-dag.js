'use client';

import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';

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

export function ClaimDag({ elements }) {
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  useEffect(() => {
    const coloredElements = (elements ?? []).map((element) => element.data?.state ? {
      ...element,
      data: { ...element.data, color: CLAIM_STATE_COLORS[element.data.state] ?? '#5146e5' },
    } : element);
    const cy = cytoscape({ container: containerRef.current, elements: coloredElements, layout: { name: 'breadthfirst', directed: true, padding: 24 }, style: [
      { selector: 'node', style: { label: 'data(label)', 'background-color': 'data(color)', color: '#ffffff', 'text-valign': 'center', 'text-halign': 'center', width: 46, height: 46, 'font-size': 11 } },
      { selector: 'edge', style: { width: 2, 'line-color': '#a8a29e', 'target-arrow-color': '#a8a29e', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
    ] });
    cy.on('tap', 'node', (event) => setSelectedNode(event.target.data()));
    return () => cy.destroy();
  }, [elements]);
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
  return <div><div aria-label="Claim dependency graph" className="h-80 w-full rounded-xl border border-border bg-card" ref={containerRef} />{selectedNode && <aside aria-label="Claim node details" className="mt-4 rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-mono text-sm">{selectedNode.id}</h3><button className="rounded border border-border px-2 py-1 text-xs" type="button" onClick={() => { setSelectedNode(null); setSelectedDetail(null); }}>Close</button></div><p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">State: {selectedNode.state ?? 'unknown'}</p><p className="mt-3 text-sm">Revision: {selectedDetail?.currentRevision?.revision ?? selectedNode.revision ?? 'Unavailable'}</p><p className="mt-2 text-sm">Evidence: {Array.isArray(evidence) ? evidence.length : 0} linked items</p>{Array.isArray(evidence) && evidence.length > 0 && <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(evidence, null, 2)}</pre>}</aside>}<div aria-label="Claim state legend" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{Object.keys(CLAIM_STATE_COLORS).map((state) => <span className="inline-flex items-center gap-2" key={state}><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: CLAIM_STATE_COLORS[state] }} />{state.replaceAll('_', ' ')}</span>)}</div></div>;
}

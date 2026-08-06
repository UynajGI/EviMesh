'use client';

import { useEffect, useRef } from 'react';
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
  useEffect(() => {
    const coloredElements = (elements ?? []).map((element) => element.data?.state ? {
      ...element,
      data: { ...element.data, color: CLAIM_STATE_COLORS[element.data.state] ?? '#5146e5' },
    } : element);
    const cy = cytoscape({ container: containerRef.current, elements: coloredElements, layout: { name: 'breadthfirst', directed: true, padding: 24 }, style: [
      { selector: 'node', style: { label: 'data(label)', 'background-color': 'data(color)', color: '#ffffff', 'text-valign': 'center', 'text-halign': 'center', width: 46, height: 46, 'font-size': 11 } },
      { selector: 'edge', style: { width: 2, 'line-color': '#a8a29e', 'target-arrow-color': '#a8a29e', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
    ] });
    return () => cy.destroy();
  }, [elements]);
  return <div><div aria-label="Claim dependency graph" className="h-80 w-full rounded-xl border border-border bg-card" ref={containerRef} /><div aria-label="Claim state legend" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{Object.keys(CLAIM_STATE_COLORS).map((state) => <span className="inline-flex items-center gap-2" key={state}><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ backgroundColor: CLAIM_STATE_COLORS[state] }} />{state.replaceAll('_', ' ')}</span>)}</div></div>;
}

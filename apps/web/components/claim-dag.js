'use client';

import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

export function ClaimDag({ elements }) {
  const containerRef = useRef(null);
  useEffect(() => {
    const cy = cytoscape({ container: containerRef.current, elements, layout: { name: 'breadthfirst', directed: true, padding: 24 }, style: [
      { selector: 'node', style: { label: 'data(label)', 'background-color': '#5146e5', color: '#ffffff', 'text-valign': 'center', 'text-halign': 'center', width: 46, height: 46, 'font-size': 11 } },
      { selector: 'edge', style: { width: 2, 'line-color': '#a8a29e', 'target-arrow-color': '#a8a29e', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } },
    ] });
    return () => cy.destroy();
  }, [elements]);
  return <div aria-label="Claim dependency graph" className="h-80 w-full rounded-xl border border-border bg-card" ref={containerRef} />;
}

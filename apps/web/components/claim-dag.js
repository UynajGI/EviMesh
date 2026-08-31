'use client';

import Link from 'next/link';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  graphStratify, sugiyama, layeringLongestPath, decrossTwoLayer, coordSimplex,
} from 'd3-dag';
import {
  Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow,
  ReactFlowProvider, SelectionMode, useNodesState,
} from '@xyflow/react';
import {
  BookOpen, Database, Focus, GitBranch, Hand, Maximize2, Minimize2,
  MousePointer2, Play, Scan, ShieldCheck,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { Select } from '@/components/ui/selection';
import {
  filterResearchNeighborhood,
  normalizeResearchNeighborhood,
  relationshipsForSelection,
  resolveResearchNodeKey,
} from '@/lib/research-neighborhood.mjs';

/*
 * v2.1 Kinetic Journal heterogeneous research neighborhood.
 * d3-dag computes the first layout. React Flow owns local pan, zoom,
 * selection and drag only. The Relationship Index is always visible beside
 * the canvas and consumes the same normalized nodes and edges.
 */

const EDGE_FAMILY_STYLES = Object.freeze({
  lineage: Object.freeze({ label: 'lineage', dash: '10 3 2 3', width: 1.4 }),
  reasoning: Object.freeze({ label: 'reasoning', dash: 'none', width: 1.5 }),
  challenge: Object.freeze({ label: 'challenge', dash: 'none', width: 1.8 }),
  evaluation: Object.freeze({ label: 'evaluation', dash: '6 4', width: 1.7 }),
  resource: Object.freeze({ label: 'resource', dash: '2 3', width: 1.4 }),
  execution: Object.freeze({ label: 'execution', dash: '8 3', width: 1.4 }),
  result: Object.freeze({ label: 'result', dash: 'none', width: 1.5 }),
  dependency: Object.freeze({ label: 'dependency', dash: '3 3', width: 1.4 }),
});

const FAMILY_ICONS = Object.freeze({
  structure: GitBranch,
  reasoning: BookOpen,
  resource: Database,
  execution: Play,
  verification: ShieldCheck,
});

function readable(value, fallback = 'not stated') {
  return String(value ?? fallback).replaceAll('_', ' ');
}

function edgeFamilyFor(edge) {
  return EDGE_FAMILY_STYLES[edge.family] ? edge.family : 'dependency';
}

function relationColor(family) {
  return family === 'challenge' || family === 'evaluation'
    ? 'var(--evimesh-primary)'
    : 'var(--evimesh-muted-foreground)';
}

function useReducedMotionPreference() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(query).matches
  ));

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return reducedMotion;
}

function ResearchNode({ data }) {
  const Icon = FAMILY_ICONS[data.family] ?? GitBranch;
  return (
    <div className="dag-node" data-node-family={data.family} data-node-kind={data.type}>
      <Handle aria-hidden="true" isConnectable={false} position={Position.Top} type="target" />
      <span className="dag-node__type"><Icon aria-hidden="true" size={12} strokeWidth={1.7} />{readable(data.type)}</span>
      <strong className="dag-node__label">{data.label}</strong>
      <span className="dag-node__meta tabular-nums">{data.id}@r{data.revision}{data.state ? ` / ${readable(data.state)}` : ''}</span>
      <Handle aria-hidden="true" isConnectable={false} position={Position.Bottom} type="source" />
    </div>
  );
}

const NODE_TYPES = Object.freeze({ research: ResearchNode });

function layoutGraph(nodes, edges) {
  if (nodes.length === 0) return [];
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const stratifyData = nodes.map((node) => ({
    id: node.key,
    parentIds: edges
      .filter((edge) => edge.layoutTarget === node.key && byKey.has(edge.layoutSource))
      .map((edge) => edge.layoutSource),
  }));
  try {
    const dag = graphStratify()(stratifyData);
    const layout = sugiyama()
      .layering(layeringLongestPath())
      .decross(decrossTwoLayer())
      .coord(coordSimplex())
      .nodeSize([204, 92])
      .gap([46, 76]);
    layout(dag);
    return [...dag.nodes()].map((node) => ({ id: node.data.id, x: node.x - 102, y: node.y - 46 }));
  } catch {
    return nodes.map((node, index) => ({ id: node.key, x: (index % 3) * 242, y: Math.floor(index / 3) * 132 }));
  }
}

function connectedPath(edges, selectedKey) {
  if (!selectedKey) return { edges: new Set(), nodes: new Set() };
  const edgeIds = new Set();
  const nodeKeys = new Set([selectedKey]);
  const walk = (side, nextSide) => {
    const queue = [selectedKey];
    const visited = new Set(queue);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const key = queue[cursor];
      for (const edge of edges) {
        if (edge[side] !== key) continue;
        edgeIds.add(edge.id);
        nodeKeys.add(edge[nextSide]);
        if (!visited.has(edge[nextSide])) {
          visited.add(edge[nextSide]);
          queue.push(edge[nextSide]);
        }
      }
    }
  };
  walk('source', 'target');
  walk('target', 'source');
  return { edges: edgeIds, nodes: nodeKeys };
}

function GraphCanvas({ edges, nodes, onFlowReady, onSelect, reducedMotion, selectedNodeKey }) {
  const frameRef = useRef(null);
  const [interactionMode, setInteractionMode] = useState('pan');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const positioned = useMemo(() => layoutGraph(nodes, edges), [nodes, edges]);
  const coordinates = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);
  const path = useMemo(() => connectedPath(edges, selectedNodeKey), [edges, selectedNodeKey]);
  const initialFlowNodes = useMemo(() => nodes.map((node) => {
    const point = coordinates.get(node.key) ?? { x: 0, y: 0 };
    return {
      id: node.key,
      type: 'research',
      position: { x: point.x, y: point.y },
      data: node,
      ariaLabel: `${readable(node.type)} ${node.label}, state ${readable(node.state)}`,
      style: { width: 204 },
    };
  }), [coordinates, nodes]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialFlowNodes);

  useEffect(() => setFlowNodes(initialFlowNodes), [initialFlowNodes, setFlowNodes]);
  useEffect(() => setFlowNodes((current) => current.map((node) => ({
    ...node,
    className: path.nodes.has(node.id) ? 'dag-node-path' : '',
    selected: node.id === selectedNodeKey,
  }))), [path.nodes, selectedNodeKey, setFlowNodes]);
  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === frameRef.current?.closest('.dag-workspace'));
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const flowEdges = useMemo(() => edges.map((edge) => {
    const family = edgeFamilyFor(edge);
    const edgeStyle = EDGE_FAMILY_STYLES[family];
    const onPath = path.edges.has(edge.id);
    const edgeColor = onPath ? 'var(--evimesh-primary)' : relationColor(family);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: false,
      className: onPath ? 'dag-edge--selected-path' : '',
      label: edge.forwardLabel ?? readable(edge.relation),
      labelStyle: { fill: onPath ? 'var(--evimesh-primary)' : 'var(--evimesh-muted-foreground)', fontSize: 9 },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 1,
      labelBgStyle: { fill: 'var(--evimesh-card)', fillOpacity: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      style: {
        stroke: edgeColor,
        strokeDasharray: edgeStyle.dash,
        strokeWidth: onPath ? Math.max(2.2, edgeStyle.width) : edgeStyle.width,
      },
    };
  }), [edges, path.edges]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const workspace = frameRef.current?.closest('.dag-workspace');
      if (document.fullscreenElement === workspace) await document.exitFullscreen();
      else await workspace?.requestFullscreen();
    } catch {
      // Fullscreen is an enhancement; the graph remains complete in place.
    }
  }, []);

  const initializeFlow = useCallback((instance) => {
    onFlowReady(instance);
    // React Flow's first fit can run before measured node dimensions exist,
    // which offsets a single-node fallback graph on narrow screens. Re-fit
    // after two paint frames so the real bounds, not zero-size placeholders,
    // drive the viewport transform.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      instance.fitView({ duration: reducedMotion ? 0 : 260, maxZoom: 1.3, minZoom: 0.35, padding: 0.2 });
    }));
  }, [onFlowReady, reducedMotion]);

  if (nodes.length === 0) {
    return <div aria-label="Research neighborhood graph" className="dag-canvas dag-canvas--empty" role="application"><p>No research objects match these filters.</p></div>;
  }

  return (
    <div className="dag-canvas" ref={frameRef}>
      <div aria-label="Graph interaction mode" className="dag-mode-switch" role="group">
        <button aria-label="Pan graph" aria-pressed={interactionMode === 'pan'} onClick={() => setInteractionMode('pan')} type="button"><Hand aria-hidden="true" size={15} /></button>
        <button aria-label="Select graph nodes" aria-pressed={interactionMode === 'select'} onClick={() => setInteractionMode('select')} type="button"><MousePointer2 aria-hidden="true" size={15} /></button>
        <button aria-label={isFullscreen ? 'Exit full screen graph' : 'Open full screen graph'} onClick={toggleFullscreen} type="button">{isFullscreen ? <Minimize2 aria-hidden="true" size={15} /> : <Maximize2 aria-hidden="true" size={15} />}</button>
      </div>
      <ReactFlow
        aria-label="Research neighborhood graph"
        className="dag-flow"
        deleteKeyCode={null}
        edges={flowEdges}
        elementsSelectable
        fitView
        fitViewOptions={{ duration: reducedMotion ? 0 : 280, maxZoom: 1.3, minZoom: 0.35, padding: 0.2 }}
        maxZoom={2.5}
        minZoom={0.25}
        nodeTypes={NODE_TYPES}
        nodes={flowNodes}
        nodesConnectable={false}
        nodesDraggable
        onInit={initializeFlow}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodesChange={onNodesChange}
        onSelectionChange={({ nodes: selected }) => { if (selected.length === 1) onSelect(selected[0].id); }}
        panOnDrag={interactionMode === 'pan' ? true : [1, 2]}
        panOnScroll
        proOptions={{ hideAttribution: true }}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={interactionMode === 'select'}
        snapGrid={[12, 12]}
        snapToGrid
        zoomOnDoubleClick
        zoomOnPinch
        zoomOnScroll
      >
        <Background color="var(--evimesh-border)" gap={32} size={1} />
        <Controls aria-label="Graph viewport controls" className="dag-controls" fitViewOptions={{ duration: reducedMotion ? 0 : 280, padding: 0.2 }} orientation="horizontal" showInteractive={false} />
        <MiniMap ariaLabel="Research graph overview" className="dag-minimap" maskColor="var(--evimesh-background)" nodeColor="var(--evimesh-primary)" pannable zoomable />
      </ReactFlow>
    </div>
  );
}

function RelationshipGroup({ heading, items, onSelect, selectedNodeKey }) {
  const grouped = useMemo(() => {
    const byType = new Map();
    for (const item of items) {
      const byRelation = byType.get(item.node.type) ?? new Map();
      const relation = item.relationLabel ?? item.relation;
      const rows = byRelation.get(relation) ?? [];
      rows.push(item);
      byRelation.set(relation, rows);
      byType.set(item.node.type, byRelation);
    }
    return [...byType.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [items]);
  return (
    <section className="relationship-group">
      <h3>{heading}<span className="tabular-nums">{String(items.length).padStart(2, '0')}</span></h3>
      {items.length === 0 ? <p className="relationship-empty">No direct {heading.toLowerCase()} relations in this filtered view.</p> : (
        grouped.map(([type, byRelation]) => <div className="relationship-type" key={type}>
          <h4>{readable(type)}</h4>
          {[...byRelation.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([relation, rows]) => <div className="relationship-relation" key={relation}>
            <h5>{readable(relation)}</h5>
            <ul>{rows.map((item) => <li key={item.id}>
              <button aria-pressed={selectedNodeKey === item.node.key} onClick={() => onSelect(item.node.key)} type="button">
                <span className="relationship-row__type">{readable(item.node.type)}</span>
                <strong>{item.node.label}</strong>
                <span className="relationship-row__relation">{readable(item.relationLabel ?? item.relation)}</span>
                <span className="relationship-row__meta"><span>distance {Math.max(1, item.node.distance ?? item.node.depth ?? 1)}</span><span>{readable(item.node.state)}</span><code>{item.node.id}@r{item.node.revision}</code></span>
              </button>
            </li>)}</ul>
          </div>)}
        </div>)
      )}
    </section>
  );
}

function RelationshipIndex({ complete, edges, nodes, onSelect, selectedNode }) {
  const relations = useMemo(() => relationshipsForSelection(nodes, edges, selectedNode?.key), [edges, nodes, selectedNode?.key]);
  const topology = !complete
    ? 'Topology unknown / bounded view'
    : relations.upstream.length === 0
      ? 'Root'
      : relations.downstream.length === 0
        ? 'Leaf'
        : 'Interior';
  return (
    <aside aria-label="Relationship Index" className="relationship-index">
      <header className="relationship-index__selected">
        <span>SELECTED NODE REVISION</span>
        <strong>{selectedNode?.label ?? 'Select an object'}</strong>
        {selectedNode ? <p><span>{readable(selectedNode.type)}</span><code>{selectedNode.id}@r{selectedNode.revision}</code><span>{topology}</span></p> : <p>Graph and index share selection.</p>}
        {selectedNode?.canonicalHref ? <Link className="relationship-index__detail" href={selectedNode.canonicalHref}>Open full detail <span aria-hidden="true">→</span></Link> : null}
      </header>
      {selectedNode ? <><RelationshipGroup heading="Upstream" items={relations.upstream} onSelect={onSelect} selectedNodeKey={selectedNode.key} /><RelationshipGroup heading="Downstream" items={relations.downstream} onSelect={onSelect} selectedNodeKey={selectedNode.key} /></> : null}
      <details className="relationship-all">
        <summary>All visible objects <span className="tabular-nums">{String(nodes.length).padStart(2, '0')}</span></summary>
        <ul>{nodes.map((node) => <li key={node.key}><button aria-pressed={selectedNode?.key === node.key} onClick={() => onSelect(node.key)} type="button"><span>{readable(node.type)}</span><strong>{node.label}</strong><code>{node.id}@r{node.revision}</code></button></li>)}</ul>
      </details>
    </aside>
  );
}

export function ResearchNeighborhood({ direction: controlledDirection, elements, focusId, graph, maxDepth: initialMaxDepth = 3, onDirectionChange }) {
  const reducedMotion = useReducedMotionPreference();
  const normalized = useMemo(() => normalizeResearchNeighborhood(graph ?? elements ?? []), [elements, graph]);
  const rootKey = useMemo(() => resolveResearchNodeKey(normalized.nodes, focusId) ?? normalized.rootKey, [focusId, normalized.nodes, normalized.rootKey]);
  const [direction, setDirection] = useState(controlledDirection ?? 'both');
  const [maxDepth, setMaxDepth] = useState(Math.min(3, Math.max(1, initialMaxDepth)));
  const [typeFilter, setTypeFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState(rootKey ?? normalized.nodes[0]?.key ?? null);
  const [flowApi, setFlowApi] = useState(null);

  useEffect(() => { if (controlledDirection) setDirection(controlledDirection); }, [controlledDirection]);
  useEffect(() => {
    if (rootKey && !normalized.nodes.some((node) => node.key === selectedKey)) setSelectedKey(rootKey);
    else if (!normalized.nodes.some((node) => node.key === selectedKey)) setSelectedKey(normalized.nodes[0]?.key ?? null);
  }, [normalized.nodes, rootKey, selectedKey]);

  const filtered = useMemo(() => filterResearchNeighborhood(normalized, {
    direction,
    focusKey: rootKey,
    maxDepth,
    states: stateFilter ? [stateFilter] : [],
    types: typeFilter ? [typeFilter] : [],
  }), [direction, maxDepth, normalized, rootKey, stateFilter, typeFilter]);
  const selectedNode = filtered.nodes.find((node) => node.key === selectedKey) ?? filtered.nodes[0] ?? null;
  const types = useMemo(() => [...new Set(normalized.nodes.map((node) => node.type))].sort(), [normalized.nodes]);
  const states = useMemo(() => [...new Set(normalized.nodes.map((node) => node.state).filter(Boolean))].sort(), [normalized.nodes]);

  const updateDirection = (value) => { setDirection(value); onDirectionChange?.(value); };
  const focusSelected = () => {
    if (!flowApi || !selectedNode) return;
    const node = flowApi.getNode(selectedNode.key);
    if (node) flowApi.setCenter(node.position.x + 102, node.position.y + 46, { duration: reducedMotion ? 0 : 260, zoom: 1.2 });
  };

  return (
    <section aria-label="Interactive research neighborhood" className="dag-workspace">
      <header className="dag-heading"><div><p>LOCAL RESEARCH NEIGHBORHOOD</p><h2>Graph + Relationship Index</h2></div><p>One normalized node and edge model. Selection and filters stay synchronized across both surfaces.</p></header>
      <div className="dag-toolbar">
        <label><span>Direction</span><Select onChange={(event) => updateDirection(event.target.value)} value={direction}><option value="both">Both</option><option value="upstream">Upstream</option><option value="downstream">Downstream</option></Select></label>
        <label><span>Depth</span><Select onChange={(event) => setMaxDepth(Number(event.target.value))} value={maxDepth}>{[1, 2, 3].map((depth) => <option key={depth} value={depth}>{depth}</option>)}</Select></label>
        <label><span>Type</span><Select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}><option value="">All types</option>{types.map((type) => <option key={type} value={type}>{readable(type)}</option>)}</Select></label>
        <label><span>State</span><Select onChange={(event) => setStateFilter(event.target.value)} value={stateFilter}><option value="">All states</option>{states.map((state) => <option key={state} value={state}>{readable(state)}</option>)}</Select></label>
        <div className="dag-toolbar__actions"><button onClick={() => flowApi?.fitView({ duration: reducedMotion ? 0 : 260, padding: 0.2 })} type="button"><Scan aria-hidden="true" size={14} />Fit</button><button disabled={!selectedNode} onClick={focusSelected} type="button"><Focus aria-hidden="true" size={14} />Focus</button></div>
      </div>
      <div className="dag-split">
        <ReactFlowProvider><GraphCanvas edges={filtered.edges} nodes={filtered.nodes} onFlowReady={setFlowApi} onSelect={setSelectedKey} reducedMotion={reducedMotion} selectedNodeKey={selectedNode?.key} /></ReactFlowProvider>
        <RelationshipIndex complete={filtered.complete} edges={filtered.edges} nodes={filtered.nodes} onSelect={setSelectedKey} selectedNode={selectedNode} />
      </div>
      <footer className="dag-legend"><div>{Object.entries(EDGE_FAMILY_STYLES).map(([family, style]) => <span key={family}><i style={{ borderTopColor: relationColor(family), borderTopStyle: style.dash === 'none' ? 'solid' : 'dashed', borderTopWidth: style.width }}></i>{style.label}</span>)}</div><p>Local movement changes only this viewport. Research relations remain read-only.</p></footer>
    </section>
  );
}

/** Backward-compatible export while callers migrate from Claim-only naming. */
export function ClaimDag(props) {
  return <ResearchNeighborhood {...props} />;
}

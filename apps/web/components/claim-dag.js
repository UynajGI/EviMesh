'use client';

import Link from 'next/link';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  graphStratify, sugiyama, layeringLongestPath, decrossTwoLayer, coordSimplex,
} from 'd3-dag';
import {
  Background, BackgroundVariant, BaseEdge, EdgeLabelRenderer, Handle, MarkerType, MiniMap,
  Panel, Position, ReactFlow, ReactFlowProvider, getBezierPath, useNodesState, useReactFlow,
} from '@xyflow/react';
import {
  BookOpen, Database, GitBranch, LocateFixed, Maximize2, Minimize2, Minus,
  Play, Plus, RotateCcw, Scan, ShieldCheck, SlidersHorizontal,
} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { Select } from '@/components/ui/selection';
import { shortId } from '@/lib/short-id.mjs';
import {
  filterResearchNeighborhood,
  normalizeResearchNeighborhood,
  relationshipsForSelection,
  resolveResearchNodeKey,
} from '@/lib/research-neighborhood.mjs';

/*
 * Research neighborhood. d3-dag lays the graph out left to right (upstream
 * on the left, downstream on the right); React Flow owns pan, zoom, drag and
 * selection. Hover lights a node's direct relations and fades the rest;
 * selection traces the full connected path. The Relationship Index beside
 * the canvas reads the same filtered model and is the keyboard list view.
 */

const EDGE_FAMILY_STYLES = Object.freeze({
  lineage: Object.freeze({ label: 'lineage', dash: '10 3 2 3', width: 1.25, color: 'var(--evimesh-c-dag-edge-lineage)' }),
  reasoning: Object.freeze({ label: 'reasoning', dash: 'none', width: 1.35, color: 'var(--evimesh-muted-foreground)' }),
  challenge: Object.freeze({ label: 'challenge', dash: 'none', width: 1.75, color: 'var(--evimesh-c-dag-edge-negative)' }),
  evaluation: Object.freeze({ label: 'evaluation', dash: '6 4', width: 1.5, color: 'var(--evimesh-c-dag-edge-qualify)' }),
  resource: Object.freeze({ label: 'resource', dash: '2 3', width: 1.35, color: 'var(--evimesh-c-dag-edge-structural)' }),
  execution: Object.freeze({ label: 'execution', dash: '8 3', width: 1.35, color: 'var(--evimesh-c-dag-edge-structural)' }),
  result: Object.freeze({ label: 'result', dash: 'none', width: 1.35, color: 'var(--evimesh-muted-foreground)' }),
  dependency: Object.freeze({ label: 'dependency', dash: '3 3', width: 1.25, color: 'var(--evimesh-c-dag-edge-structural)' }),
});

const FAMILY_ICONS = Object.freeze({
  structure: GitBranch,
  reasoning: BookOpen,
  resource: Database,
  execution: Play,
  verification: ShieldCheck,
});

const NODE_WIDTH = 232;
const NODE_HEIGHT = 80;
const FIT_OPTIONS = Object.freeze({ maxZoom: 1.15, minZoom: 0.3, padding: 0.22 });

function readable(value, fallback = 'not stated') {
  return String(value ?? fallback).replaceAll('_', ' ');
}

function edgeFamilyFor(edge) {
  return EDGE_FAMILY_STYLES[edge.family] ? edge.family : 'dependency';
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
      <Handle aria-hidden="true" isConnectable={false} position={data.vertical ? Position.Top : Position.Left} type="target" />
      <span className="dag-node__top">
        <span className="dag-node__glyph"><Icon aria-hidden="true" size={11} strokeWidth={1.9} /></span>
        <span className="dag-node__type">{readable(data.type)}</span>
        {data.state ? <span className="dag-node__state">{readable(data.state)}</span> : null}
      </span>
      <strong className="dag-node__label">{data.label}</strong>
      <Handle aria-hidden="true" isConnectable={false} position={data.vertical ? Position.Bottom : Position.Right} type="source" />
    </div>
  );
}

function ResearchEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data,
}) {
  const offset = data?.offset ?? 0;
  const dx = data?.vertical ? offset : 0;
  const dy = data?.vertical ? 0 : offset;
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sourceX + dx, sourceY: sourceY + dy, sourcePosition, targetX: targetX + dx, targetY: targetY + dy, targetPosition, curvature: 0.34,
  });
  return (
    <>
      <BaseEdge id={id} interactionWidth={20} markerEnd={markerEnd} path={path} style={style} />
      {data?.flowing ? <path className="dag-edge__flow" d={path} style={{ stroke: data.color }} /> : null}
      {data?.showLabel ? (
        <EdgeLabelRenderer>
          <span
            className="dag-edge-label nodrag nopan"
            data-emphasis={data.onPath ? 'path' : undefined}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.labels.map((item) => <span key={item.label}><i style={{ background: item.color }}></i>{item.label}</span>)}
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const NODE_TYPES = Object.freeze({ research: ResearchNode });
const EDGE_TYPES = Object.freeze({ research: ResearchEdge });

const LAYER_GAP = 168;
const SIBLING_GAP = 24;

/**
 * Sugiyama layout. Wide canvases read left to right (layers along x);
 * narrow canvases read top to bottom so nodes keep a legible size.
 */
function layoutGraph(nodes, edges, vertical) {
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
      .nodeSize(vertical ? [NODE_WIDTH, NODE_HEIGHT] : [NODE_HEIGHT, NODE_WIDTH])
      .gap(vertical ? [SIBLING_GAP, LAYER_GAP * 0.55] : [SIBLING_GAP, LAYER_GAP]);
    layout(dag);
    return [...dag.nodes()].map((node) => (vertical
      ? { id: node.data.id, x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2, layer: Math.round(node.y / (NODE_HEIGHT + LAYER_GAP * 0.55)) }
      : { id: node.data.id, x: node.y - NODE_WIDTH / 2, y: node.x - NODE_HEIGHT / 2, layer: Math.round(node.y / (NODE_WIDTH + LAYER_GAP)) }));
  } catch {
    return nodes.map((node, index) => ({
      id: node.key, x: Math.floor(index / 4) * (NODE_WIDTH + LAYER_GAP), y: (index % 4) * (NODE_HEIGHT + SIBLING_GAP), layer: Math.floor(index / 4),
    }));
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

function directNeighbors(edges, key) {
  if (!key) return null;
  const nodes = new Set([key]);
  const edgeIds = new Set();
  for (const edge of edges) {
    if (edge.source !== key && edge.target !== key) continue;
    edgeIds.add(edge.id);
    nodes.add(edge.source);
    nodes.add(edge.target);
  }
  return { edges: edgeIds, nodes };
}

function CanvasControls({ isFullscreen, moved, onFocus, onReset, onToggleFullscreen, reducedMotion }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const duration = reducedMotion ? 0 : 260;
  return (
    <Panel className="dag-panel dag-panel--controls" position="bottom-left">
      <div aria-label="Graph view" className="dag-tools" role="group">
        <button aria-label="Zoom out" onClick={() => zoomOut({ duration })} title="Zoom out" type="button"><Minus aria-hidden="true" size={15} /></button>
        <button aria-label="Zoom in" onClick={() => zoomIn({ duration })} title="Zoom in" type="button"><Plus aria-hidden="true" size={15} /></button>
        <button aria-label="Fit graph" onClick={() => fitView({ ...FIT_OPTIONS, duration })} title="Fit" type="button"><Scan aria-hidden="true" size={15} /></button>
        <button aria-label="Focus selected object" onClick={onFocus} title="Focus selection" type="button"><LocateFixed aria-hidden="true" size={15} /></button>
        {moved ? <button aria-label="Reset layout" onClick={onReset} title="Reset layout" type="button"><RotateCcw aria-hidden="true" size={15} /></button> : null}
        <button aria-label={isFullscreen ? 'Exit full screen graph' : 'Open full screen graph'} onClick={onToggleFullscreen} title={isFullscreen ? 'Exit full screen' : 'Full screen'} type="button">{isFullscreen ? <Minimize2 aria-hidden="true" size={15} /> : <Maximize2 aria-hidden="true" size={15} />}</button>
      </div>
    </Panel>
  );
}

function EdgeKey({ edges }) {
  const present = new Set(edges.map(edgeFamilyFor));
  const entries = Object.entries(EDGE_FAMILY_STYLES).filter(([family]) => present.has(family));
  if (entries.length === 0) return null;
  return (
    <Panel className="dag-panel dag-panel--key" position="bottom-right">
      <ul aria-label="Edge families" className="dag-legend">
        {entries.map(([family, style]) => <li key={family}><svg aria-hidden="true" height="6" viewBox="0 0 22 6" width="22"><line stroke={style.color} strokeDasharray={style.dash === 'none' ? undefined : style.dash} strokeWidth={style.width + 0.4} x1="0" x2="22" y1="3" y2="3" /></svg>{style.label}</li>)}
      </ul>
    </Panel>
  );
}

function GraphCanvas({ edges, nodes, onSelect, reducedMotion, selectedNodeKey, toolbar }) {
  const frameRef = useRef(null);
  const settleTimer = useRef(null);
  const firstLayout = useRef(true);
  const flowRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverKey, setHoverKey] = useState(null);
  const [hoverEdge, setHoverEdge] = useState(null);
  const [settling, setSettling] = useState(false);
  const [moved, setMoved] = useState(false);
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setVertical(entry.contentRect.width < 560));
    observer.observe(frame);
    return () => observer.disconnect();
  }, [nodes.length]);
  const positioned = useMemo(() => layoutGraph(nodes, edges, vertical), [nodes, edges, vertical]);
  const coordinates = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);
  const path = useMemo(() => connectedPath(edges, selectedNodeKey), [edges, selectedNodeKey]);
  const hovered = useMemo(() => directNeighbors(edges, hoverKey), [edges, hoverKey]);
  const selectedNeighbors = useMemo(() => directNeighbors(edges, selectedNodeKey), [edges, selectedNodeKey]);
  const initialFlowNodes = useMemo(() => nodes.map((node) => {
    const point = coordinates.get(node.key) ?? { x: 0, y: 0, layer: 0 };
    return {
      id: node.key,
      type: 'research',
      position: { x: point.x, y: point.y },
      data: { ...node, isRoot: node.direction === 'focus', vertical },
      ariaLabel: `${readable(node.type)} ${node.label}, state ${readable(node.state)}`,
      style: { width: NODE_WIDTH, '--dag-enter': `${Math.min(6, Math.max(0, point.layer ?? 0)) * 70}ms` },
    };
  }), [coordinates, nodes, vertical]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(initialFlowNodes);

  const settle = useCallback(() => {
    if (reducedMotion) return;
    setSettling(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettling(false), 460);
  }, [reducedMotion]);

  useEffect(() => {
    setFlowNodes(initialFlowNodes);
    setMoved(false);
    if (firstLayout.current) { firstLayout.current = false; return; }
    settle();
    const instance = flowRef.current;
    if (instance) window.requestAnimationFrame(() => instance.fitView({ ...FIT_OPTIONS, duration: reducedMotion ? 0 : 420 }));
  }, [initialFlowNodes, reducedMotion, setFlowNodes, settle]);
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);
  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === frameRef.current?.closest('.dag-workspace'));
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  const displayNodes = useMemo(() => flowNodes.map((node) => {
    const classes = [];
    if (node.data.isRoot) classes.push('is-root');
    if (path.nodes.has(node.id)) classes.push('dag-node-path');
    if (hovered && !hovered.nodes.has(node.id)) classes.push('is-faded');
    if (hovered && node.id === hoverKey) classes.push('is-hovered');
    return { ...node, className: classes.join(' '), selected: node.id === selectedNodeKey };
  }), [flowNodes, hoverKey, hovered, path.nodes, selectedNodeKey]);

  // Parallel relations between one pair of objects run as offset curves and
  // share a single label pill on the lead edge of the bundle.
  const bundles = useMemo(() => {
    const byPair = new Map();
    for (const edge of edges) {
      const pair = [edge.source, edge.target].sort().join(' -> ');
      const list = byPair.get(pair) ?? [];
      list.push(edge);
      byPair.set(pair, list);
    }
    const info = new Map();
    for (const list of byPair.values()) {
      list.forEach((edge, index) => info.set(edge.id, { lead: list[0].id, members: list, offset: (index - (list.length - 1) / 2) * 7 }));
    }
    return info;
  }, [edges]);

  const flowEdges = useMemo(() => edges.map((edge) => {
    const family = edgeFamilyFor(edge);
    const edgeStyle = EDGE_FAMILY_STYLES[family];
    const onPath = path.edges.has(edge.id);
    const lit = hovered ? hovered.edges.has(edge.id) : false;
    const faded = hovered ? !lit : false;
    const direct = selectedNeighbors?.edges.has(edge.id) ?? false;
    const bundle = bundles.get(edge.id);
    const bundleHovered = bundle.members.some((member) => member.id === hoverEdge);
    const showLabel = bundle.lead === edge.id && (bundleHovered || (hovered ? lit : direct));
    const classes = [];
    if (onPath) classes.push('dag-edge--selected-path');
    if (faded) classes.push('is-faded');
    if (lit || hoverEdge === edge.id) classes.push('is-lit');
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'research',
      className: classes.join(' '),
      data: {
        color: edgeStyle.color,
        family,
        flowing: !reducedMotion && (lit || (!hovered && direct)),
        labels: bundle.members.map((member) => ({
          color: EDGE_FAMILY_STYLES[edgeFamilyFor(member)].color,
          label: member.forwardLabel ?? readable(member.relation),
        })),
        offset: bundle.offset,
        vertical,
        onPath,
        showLabel,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeStyle.color, width: 14, height: 14 },
      style: {
        stroke: edgeStyle.color,
        strokeDasharray: edgeStyle.dash,
        strokeWidth: onPath || lit ? edgeStyle.width + 0.75 : edgeStyle.width,
      },
    };
  }), [bundles, edges, hoverEdge, hovered, path.edges, reducedMotion, selectedNeighbors, vertical]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const workspace = frameRef.current?.closest('.dag-workspace');
      if (document.fullscreenElement === workspace) await document.exitFullscreen();
      else await workspace?.requestFullscreen();
    } catch {
      // Fullscreen is an enhancement; the graph remains complete in place.
    }
  }, []);

  const focusSelected = useCallback(() => {
    const instance = flowRef.current;
    if (!instance || !selectedNodeKey) return;
    const node = instance.getNode(selectedNodeKey);
    if (node) instance.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { duration: reducedMotion ? 0 : 260, zoom: 1.1 });
  }, [reducedMotion, selectedNodeKey]);

  const resetLayout = useCallback(() => {
    settle();
    setFlowNodes(initialFlowNodes);
    setMoved(false);
  }, [initialFlowNodes, setFlowNodes, settle]);

  const initializeFlow = useCallback((instance) => {
    flowRef.current = instance;
    // React Flow's first fit can run before measured node dimensions exist,
    // which offsets a single-node graph on narrow screens. Re-fit after two
    // paint frames so the real bounds drive the viewport transform.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      instance.fitView({ ...FIT_OPTIONS, duration: reducedMotion ? 0 : 260 });
    }));
  }, [reducedMotion]);

  if (nodes.length === 0) {
    return (
      <div aria-label="Research neighborhood graph" className="dag-canvas dag-canvas--empty" role="application">
        <div className="dag-panel dag-panel--inline">{toolbar}</div>
        <p>No research objects match these filters.</p>
      </div>
    );
  }

  return (
    <div className={`dag-canvas${nodes.length <= 2 ? ' dag-canvas--sparse' : ''}`} ref={frameRef}>
      <ReactFlow
        aria-label="Research neighborhood graph"
        className={`dag-flow${settling ? ' is-settling' : ''}${hovered ? ' is-tracing' : ''}`}
        deleteKeyCode={null}
        edgeTypes={EDGE_TYPES}
        edges={flowEdges}
        elementsSelectable
        fitView
        fitViewOptions={{ ...FIT_OPTIONS, duration: reducedMotion ? 0 : 280 }}
        maxZoom={2.5}
        minZoom={0.2}
        nodeTypes={NODE_TYPES}
        nodes={displayNodes}
        nodesConnectable={false}
        nodesDraggable
        onEdgeMouseEnter={(_, edge) => setHoverEdge(edge.id)}
        onEdgeMouseLeave={() => setHoverEdge(null)}
        onInit={initializeFlow}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDragStop={() => setMoved(true)}
        onNodeMouseEnter={(_, node) => setHoverKey(node.id)}
        onNodeMouseLeave={() => setHoverKey(null)}
        onNodesChange={onNodesChange}
        onSelectionChange={({ nodes: selected }) => { if (selected.length === 1) onSelect(selected[0].id); }}
        panOnDrag
        panOnScroll={isFullscreen}
        preventScrolling={isFullscreen}
        proOptions={{ hideAttribution: true }}
        zoomOnDoubleClick
        zoomOnPinch
        zoomOnScroll={isFullscreen}
      >
        <Background color="var(--evimesh-border)" gap={20} size={1.1} variant={BackgroundVariant.Dots} />
        <Panel className="dag-panel dag-panel--toolbar" position="top-left">{toolbar}</Panel>
        <EdgeKey edges={edges} />
        <CanvasControls isFullscreen={isFullscreen} moved={moved} onFocus={focusSelected} onReset={resetLayout} onToggleFullscreen={toggleFullscreen} reducedMotion={reducedMotion} />
        {nodes.length > 8 ? <MiniMap ariaLabel="Research graph overview" bgColor="var(--evimesh-card)" className="dag-minimap" maskColor="color-mix(in srgb, var(--evimesh-background) 70%, transparent)" nodeBorderRadius={2} nodeColor="var(--evimesh-border)" pannable position="top-right" zoomable /> : null}
      </ReactFlow>
    </div>
  );
}

function RelationshipGroup({ heading, items, onSelect, selectedNodeKey }) {
  const grouped = useMemo(() => {
    const byRelation = new Map();
    for (const item of items) {
      const relation = item.relationLabel ?? item.relation;
      const rows = byRelation.get(relation) ?? [];
      rows.push(item);
      byRelation.set(relation, rows);
    }
    return [...byRelation.entries()].sort(([left], [right]) => String(left).localeCompare(String(right)));
  }, [items]);
  return (
    <section className="relationship-group">
      <h3>{heading}<span className="tabular-nums">{items.length}</span></h3>
      {items.length === 0 ? <p className="relationship-empty">None in view.</p> : (
        grouped.map(([relation, rows]) => <div className="relationship-relation" key={relation}>
          <h4>{readable(relation)}</h4>
          <ul>{rows.map((item) => <li key={item.id}>
            <button aria-pressed={selectedNodeKey === item.node.key} data-node-family={item.node.family} onClick={() => onSelect(item.node.key)} type="button">
              <strong>{item.node.label}</strong>
              <span className="relationship-row__meta"><span>{readable(item.node.type)}</span><span>{readable(item.node.state)}</span><code aria-hidden="true">{shortId(item.node.id)}@r{item.node.revision}</code><span className="sr-only">{item.node.id}@r{item.node.revision}</span></span>
            </button>
          </li>)}</ul>
        </div>)
      )}
    </section>
  );
}

function RelationshipIndex({ complete, edges, nodes, onSelect, selectedNode, rootKey }) {
  const isRoot = Boolean(selectedNode && rootKey && selectedNode.key === rootKey);
  const relations = useMemo(() => relationshipsForSelection(nodes, edges, selectedNode?.key), [edges, nodes, selectedNode?.key]);
  const topology = !complete
    ? 'Bounded view'
    : relations.upstream.length === 0
      ? 'Root'
      : relations.downstream.length === 0
        ? 'Leaf'
        : 'Interior';
  return (
    <aside aria-label="Relationship Index" className="relationship-index">
      <header className="relationship-index__selected" key={selectedNode?.key ?? 'none'}>
        {selectedNode ? <p><span>{readable(selectedNode.type)}</span><code>{shortId(selectedNode.id)}@r{selectedNode.revision}</code><span>{topology}</span></p> : null}
        <strong>{isRoot ? `This ${readable(selectedNode.type)}` : (selectedNode?.label ?? 'Nothing selected')}</strong>
        {selectedNode?.canonicalHref && !isRoot ? <Link className="relationship-index__detail" href={selectedNode.canonicalHref}>Open full detail</Link> : null}
      </header>
      {selectedNode ? <><RelationshipGroup heading="Upstream" items={relations.upstream} onSelect={onSelect} selectedNodeKey={selectedNode.key} /><RelationshipGroup heading="Downstream" items={relations.downstream} onSelect={onSelect} selectedNodeKey={selectedNode.key} /></> : null}
      <details className="relationship-all">
        <summary>All visible objects <span className="tabular-nums">{nodes.length}</span></summary>
        <ul>{nodes.map((node) => <li key={node.key}><button aria-pressed={selectedNode?.key === node.key} onClick={() => onSelect(node.key)} type="button"><strong>{node.label}</strong><span>{readable(node.type)} <code>{shortId(node.id)}@r{node.revision}</code></span></button></li>)}</ul>
      </details>
    </aside>
  );
}

function Segmented({ label, onChange, options, value }) {
  return (
    <div aria-label={label} className="dag-seg" role="group">
      {options.map(([optionValue, optionLabel]) => (
        <button aria-pressed={value === optionValue} key={optionValue} onClick={() => onChange(optionValue)} type="button">{optionLabel}</button>
      ))}
    </div>
  );
}

function FilterMenu({ onState, onType, state, states, type, types }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (ref.current?.open && !ref.current.contains(event.target)) ref.current.open = false;
    };
    const escape = (event) => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  const active = Boolean(type || state);
  return (
    <details className="dag-filter" ref={ref}>
      <summary aria-label={active ? 'Filters, active' : 'Filters'}><SlidersHorizontal aria-hidden="true" size={14} />Filter{active ? <i aria-hidden="true"></i> : null}</summary>
      <div className="dag-filter__menu">
        <label><span>Type</span><Select onChange={(event) => onType(event.target.value)} value={type}><option value="">All types</option>{types.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</Select></label>
        <label><span>State</span><Select onChange={(event) => onState(event.target.value)} value={state}><option value="">All states</option>{states.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</Select></label>
        {active ? <button onClick={() => { onType(''); onState(''); }} type="button">Clear filters</button> : null}
      </div>
    </details>
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

  const toolbar = (
    <div className="dag-toolbar">
      <Segmented label="Direction" onChange={updateDirection} options={[['both', 'Both'], ['upstream', 'Upstream'], ['downstream', 'Downstream']]} value={direction} />
      <Segmented label="Depth" onChange={setMaxDepth} options={[1, 2, 3].map((depth) => [depth, `${depth}`])} value={maxDepth} />
      <FilterMenu onState={setStateFilter} onType={setTypeFilter} state={stateFilter} states={states} type={typeFilter} types={types} />
    </div>
  );

  return (
    <figure aria-label="Interactive research neighborhood" className="dag-workspace">
      <figcaption className="sr-only">Graph + Relationship Index</figcaption>
      <div className="dag-split">
        <ReactFlowProvider><GraphCanvas edges={filtered.edges} nodes={filtered.nodes} onSelect={setSelectedKey} reducedMotion={reducedMotion} selectedNodeKey={selectedNode?.key} toolbar={toolbar} /></ReactFlowProvider>
        <RelationshipIndex complete={filtered.complete} edges={filtered.edges} nodes={filtered.nodes} onSelect={setSelectedKey} rootKey={rootKey} selectedNode={selectedNode} />
      </div>
    </figure>
  );
}

/** Backward-compatible export while callers migrate from Claim-only naming. */
export function ClaimDag(props) {
  return <ResearchNeighborhood {...props} />;
}

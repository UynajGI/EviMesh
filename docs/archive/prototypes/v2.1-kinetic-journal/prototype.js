const views = [...document.querySelectorAll('[data-view]')];
const routeLinks = [...document.querySelectorAll('[data-route]')];
const nav = document.querySelector('.primary-nav');
const menuButton = document.querySelector('.menu-button');
const knownRoutes = new Set(views.map((view) => view.dataset.view));

function showRoute(route) {
  const target = knownRoutes.has(route) ? route : 'home';
  views.forEach((view) => { view.hidden = view.dataset.view !== target; });
  routeLinks.forEach((link) => {
    if (link.closest('.primary-nav')) link.setAttribute('aria-current', link.dataset.route === target ? 'page' : 'false');
  });
  nav?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  document.title = `${target[0].toUpperCase()}${target.slice(1)} | EviMesh v2.1`;
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

window.addEventListener('hashchange', () => showRoute(location.hash.slice(1)));
routeLinks.forEach((link) => link.addEventListener('click', () => showRoute(link.dataset.route)));
menuButton?.addEventListener('click', () => {
  const open = !nav.classList.contains('is-open');
  nav.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
});
showRoute(location.hash.slice(1));

const plane = document.querySelector('[data-graph-plane]');
const frame = plane?.closest('.graph-frame');
const nodes = [...document.querySelectorAll('[data-node-id]')];
const rows = [...document.querySelectorAll('[data-related-id]')];
const relationshipRows = rows.filter((row) => row.matches('[data-edge-id]'));
const selectedTitle = document.querySelector('[data-selected-title]');
const selectedId = document.querySelector('[data-selected-id]');
const edgeLayer = document.querySelector('[data-edge-layer]');
const graphSvg = document.querySelector('.graph-lines');
const edgeDefinitions = [
  { id: 'edge_dataset_question', source: 'dat_7RK2', target: 'qst_8W19', relation: 'informs question' },
  { id: 'edge_tool_question', source: 'tol_4GV0', target: 'qst_8W19', relation: 'used to frame' },
  { id: 'edge_question_question', source: 'qst_8W19', target: 'qst_2DD7', relation: 'opens question' },
  { id: 'edge_question_answer', source: 'qst_8W19', target: 'ans_2PX4', relation: 'answered by' },
  { id: 'edge_answer_claim', source: 'ans_2PX4', target: 'clm_6KT3', relation: 'derives claim' },
  { id: 'edge_claim_rebuttal', source: 'clm_6KT3', target: 'reb_4M11', relation: 'evaluated by', kind: 'evaluative' },
  { id: 'edge_claim_run', source: 'clm_6KT3', target: 'run_3NB1', relation: 'executed by' },
  { id: 'edge_run_evidence', source: 'run_3NB1', target: 'evd_3LT9', relation: 'produces evidence' },
  { id: 'edge_evidence_evaluation', source: 'evd_3LT9', target: 'evl_3AY9', relation: 'evaluated by', kind: 'evaluative' },
  { id: 'edge_evaluation_receipt', source: 'evl_3AY9', target: 'vrc_9AS2', relation: 'receipt for', kind: 'receipt' },
];
let scale = 1;
let offset = { x: 0, y: 0 };
let panning = null;

function updatePlane() {
  if (plane) plane.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
}

function svgElement(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function redrawEdges() {
  if (!plane || !graphSvg || !edgeLayer) return;
  graphSvg.setAttribute('viewBox', `0 0 ${plane.clientWidth} ${plane.clientHeight}`);
  edgeLayer.replaceChildren();
  edgeDefinitions.forEach((edge) => {
    const source = nodes.find((node) => node.dataset.nodeId === edge.source);
    const target = nodes.find((node) => node.dataset.nodeId === edge.target);
    if (!source || !target) return;
    const horizontal = target.offsetLeft > source.offsetLeft + source.offsetWidth * .7;
    const sx = horizontal ? source.offsetLeft + source.offsetWidth : source.offsetLeft + source.offsetWidth / 2;
    const sy = horizontal ? source.offsetTop + source.offsetHeight / 2 : source.offsetTop + source.offsetHeight;
    const tx = horizontal ? target.offsetLeft : target.offsetLeft + target.offsetWidth / 2;
    const ty = horizontal ? target.offsetTop + target.offsetHeight / 2 : target.offsetTop;
    const bend = Math.max(28, Math.abs(tx - sx) * .5);
    const verticalBend = Math.max(24, Math.abs(ty - sy) * .45);
    const path = svgElement('path');
    path.setAttribute('d', horizontal
      ? `M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx} ${ty}`
      : `M ${sx} ${sy} C ${sx} ${sy + verticalBend}, ${tx} ${ty - verticalBend}, ${tx} ${ty}`);
    path.dataset.edgeId = edge.id;
    path.dataset.source = edge.source;
    path.dataset.target = edge.target;
    path.classList.toggle('edge-negative', edge.kind === 'evaluative');
    path.classList.toggle('edge-dashed', edge.kind === 'receipt');
    path.setAttribute('marker-end', edge.kind === 'evaluative' ? 'url(#graph-arrow-cobalt)' : 'url(#graph-arrow)');
    path.hidden = source.hidden || target.hidden;
    edgeLayer.append(path);
    const label = svgElement('text');
    label.dataset.edgeLabel = edge.id;
    label.setAttribute('x', String((sx + tx) / 2));
    label.setAttribute('y', String((sy + ty) / 2 - 5));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = edge.relation;
    label.hidden = path.hidden;
    edgeLayer.append(label);
  });
}

function selectNode(id) {
  const node = nodes.find((item) => item.dataset.nodeId === id);
  if (!node || node.hidden) return;
  nodes.forEach((item) => item.classList.toggle('is-selected', item === node));
  rows.forEach((row) => row.classList.toggle('is-selected', row.dataset.relatedId === id));
  if (selectedTitle) selectedTitle.textContent = node.querySelector('strong')?.textContent || id;
  if (selectedId) selectedId.textContent = node.querySelector('code')?.textContent || id;
}

nodes.forEach((node) => {
  node.addEventListener('click', () => selectNode(node.dataset.nodeId));
  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY, left: node.offsetLeft, top: node.offsetTop };
    node.setPointerCapture(event.pointerId);
    const move = (next) => {
      node.style.left = `${start.left + (next.clientX - start.x) / scale}px`;
      node.style.top = `${start.top + (next.clientY - start.y) / scale}px`;
      redrawEdges();
    };
    const stop = () => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', stop); };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', stop);
  });
});
rows.forEach((row) => row.addEventListener('click', () => selectNode(row.dataset.relatedId)));

frame?.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.graph-node')) return;
  panning = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  frame.setPointerCapture(event.pointerId);
});
frame?.addEventListener('pointermove', (event) => {
  if (!panning) return;
  offset = { x: panning.ox + event.clientX - panning.x, y: panning.oy + event.clientY - panning.y };
  updatePlane();
});
frame?.addEventListener('pointerup', () => { panning = null; });
frame?.addEventListener('wheel', (event) => {
  event.preventDefault();
  scale = Math.min(1.7, Math.max(.55, scale + (event.deltaY < 0 ? .08 : -.08)));
  updatePlane();
}, { passive: false });

document.querySelector('[data-zoom-in]')?.addEventListener('click', () => { scale = Math.min(1.7, scale + .15); updatePlane(); });
document.querySelector('[data-zoom-out]')?.addEventListener('click', () => { scale = Math.max(.55, scale - .15); updatePlane(); });
document.querySelector('[data-fit]')?.addEventListener('click', () => { scale = 1; offset = { x: 0, y: 0 }; updatePlane(); });
document.querySelector('[data-fullscreen]')?.addEventListener('click', async () => {
  if (!frame) return;
  if (document.fullscreenElement) await document.exitFullscreen(); else await frame.requestFullscreen();
});

function applyGraphFilters() {
  const type = document.querySelector('[data-graph-type]')?.value ?? 'all';
  const direction = document.querySelector('[data-graph-direction]')?.value ?? 'both';
  const depth = Number(document.querySelector('[data-graph-depth]')?.value ?? 3);
  nodes.forEach((node) => {
    const isFocus = node.dataset.side === 'focus';
    const matchesType = type === 'all' || node.dataset.kind === type;
    const matchesDirection = direction === 'both' || node.dataset.side === direction;
    const matchesDepth = Number(node.dataset.depth ?? 0) <= depth;
    node.hidden = !isFocus && !(matchesType && matchesDirection && matchesDepth);
  });
  document.querySelectorAll('.graph-lines [data-source][data-target]').forEach((edge) => {
    const source = nodes.find((node) => node.dataset.nodeId === edge.dataset.source);
    const target = nodes.find((node) => node.dataset.nodeId === edge.dataset.target);
    edge.hidden = !source || !target || source.hidden || target.hidden;
    const label = document.querySelector(`[data-edge-label="${edge.dataset.edgeId}"]`);
    if (label) label.hidden = edge.hidden;
  });
  relationshipRows.forEach((row) => {
    const node = nodes.find((item) => item.dataset.nodeId === row.dataset.relatedId);
    row.hidden = !node || node.hidden;
    const relationGroup = row.closest('.relation-type');
    if (relationGroup) relationGroup.hidden = row.hidden;
  });
  document.querySelectorAll('.relationship-index > section').forEach((section) => {
    const count = [...section.querySelectorAll('[data-edge-id]')].filter((row) => !row.hidden).length;
    const counter = section.querySelector('h3 span');
    if (counter) counter.textContent = String(count).padStart(2, '0');
  });
  const selected = nodes.find((node) => node.classList.contains('is-selected'));
  if (selected?.hidden) selectNode('ans_2PX4');
}
document.querySelector('[data-graph-type]')?.addEventListener('change', applyGraphFilters);
document.querySelector('[data-graph-direction]')?.addEventListener('change', applyGraphFilters);
document.querySelector('[data-graph-depth]')?.addEventListener('change', applyGraphFilters);
if (plane) new ResizeObserver(redrawEdges).observe(plane);
window.addEventListener('resize', redrawEdges);
requestAnimationFrame(redrawEdges);
document.querySelectorAll('.filter-line button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.filter-line button').forEach((item) => item.classList.remove('is-active'));
  button.classList.add('is-active');
}));
document.querySelector('.connection-sheet button')?.addEventListener('click', async (event) => {
  const command = event.currentTarget.closest('.connection-sheet')?.querySelector('code')?.innerText ?? '';
  try { await navigator.clipboard.writeText(command); event.currentTarget.textContent = 'Copied'; } catch { event.currentTarget.textContent = 'Select commands above'; }
});

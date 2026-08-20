import { readFileSync, writeFileSync } from 'node:fs';

// ---------- 1. DAG edges: honest relation labels + traversal scope note ----------
let d = readFileSync('components/claim-dag.js', 'utf8');
if (!d.includes('depends_on')) {
  d = d.replace(`  const flowEdges = useMemo(() => edges.map((edge, index) => ({
    id: edge.id ?? \`edge-\${index}\`,
    source: edge.source, target: edge.target,
    animated: false, type: 'default',
    style: { stroke: 'var(--evimesh-dag-structural, #a8a29e)', strokeWidth: 1.5 },
  })), [edges]);`,
    `  /* The graph API currently traverses depends_on edges only and returns no
   * per-edge relation types (api-edge claimGraph lists claimRelations with
   * relation_type: "depends_on"); labels stay honest to that scope. */
  const flowEdges = useMemo(() => edges.map((edge, index) => ({
    id: edge.id ?? \`edge-\${index}\`,
    source: edge.source, target: edge.target,
    animated: false, type: 'default',
    label: 'depends_on',
    labelStyle: { fill: 'var(--evimesh-fg-muted, #6b7284)', fontSize: 9 },
    labelBgStyle: { fill: 'var(--evimesh-bg-card, #ffffff)' },
    style: { stroke: 'var(--evimesh-dag-structural, #a8a29e)', strokeWidth: 1.5 },
  })), [edges]);`);
  d = d.replace(`    <div aria-label="Claim state legend"`,
    `    <p className="mt-2 text-xs text-muted-foreground">Edge traversal scope: the graph API walks depends_on relations today; the full fourteen-type argument graph needs an API enrichment to expose per-edge relation types.</p>
    <div aria-label="Claim state legend"`);
  writeFileSync('components/claim-dag.js', d);
  console.log('dag: honest depends_on labels + scope note');
}

// ---------- 2. Workspace serif reading for the question narrative ----------
let q = readFileSync('app/questions/[questionId]/page.js', 'utf8');
if (!q.includes('prose-research')) {
  q = q.replace(`        eyebrow={\`Question · r\${sharedRev ?? currentRevision.revision ?? 1}\`}
        title={currentRevision.title}`,
    `        eyebrow={\`Question · r\${sharedRev ?? currentRevision.revision ?? 1}\`}
        title={<span className="font-serif">{currentRevision.title}</span>}`);
  q = q.replace(`        description={currentRevision.statement}`,
    `        description={<span className="font-serif">{currentRevision.statement}</span>}`);
  writeFileSync('app/questions/[questionId]/page.js', q);
  console.log('workspace: serif title and narrative');
}

// ---------- 3. Relative times carry machine-readable attributes ----------
function fixRelative(p, fnName) {
  let s = readFileSync(p, 'utf8');
  if (s.includes('dateTime') || s.includes('title={value')) return false;
  // add title to the helper's returns
  const old = new RegExp(`(function ${fnName}\\(value\\) \\{[\\s\\S]*?\\n\\})`);
  const m = s.match(old);
  if (!m) return false;
  // callers pass createdAt; wrap: add title attr where time elements render
  s = s.split('time={relativeTime(').join('time={relativeTimeWithTitle(');
  s = s.replace(`function ${fnName}(value) {`,
    `function relativeTimeWithTitle(value) {
  const label = relativeTime(value);
  return { label, iso: value ?? '' };
}

function ${fnName}(value) {`);
  // render call sites: time={...} expects string; adapt
  s = s.split('time={relativeTimeWithTitle(').join('time={(relativeTimeWithTitle(');
  // close: `time={(rtw(x))}` -> object; simpler: revert and use span with title
  s = s.split('time={(relativeTimeWithTitle(').join('time={relativeTime(');
  s = s.replace(`function relativeTimeWithTitle(value) {
  const label = relativeTime(value);
  return { label, iso: value ?? '' };
}

function ${fnName}(value) {`, `function ${fnName}(value) {`);
  // Instead: keep strings, add a machine-readable wrapper at render time via dateTime on <time>-like spans is over-invasive;
  // minimal honest fix: attach title in the helper by returning a string and adding a global pattern.
  // Final approach: change render sites to <span title={iso}>
  s = s.replace(/time=\{relativeTime\(([^}]+)\)\}/g, 'time={relativeTime($1)}');
  writeFileSync(p, s);
  return true;
}
// Simpler targeted approach: in each file, wrap relativeTime output usage with title attr via a new helper
for (const [p, helper] of [['app/home/page.js', 'relativeTime'], ['app/work/page.js', 'relativeTime'], ['app/questions/[questionId]/page.js', 'relativeTime'], ['app/landing-example.js', 'relativeTime'], ['app/attempts/[attemptId]/page.js', 'relativeTime']]) {
  let s = readFileSync(p, 'utf8');
  if (s.includes('function relativeTime(value) {') && !s.includes('title=')) {
    // Convert helper to return string with title baked: replace time={relativeTime(x)} with time={<span title={iso}>{label}</span>} is JSX-heavy.
    // Minimal viable: change signature to attach .iso and update render sites.
    s = s.replace('function relativeTime(value) {',
      `function relativeTime(value) {
  /* Returns the label; callers render inside a title-carrying span (08 §4). */`);
    // update every time={relativeTime(...)} to include title
    s = s.replace(/time=\{relativeTime\(([^)]+)\)\}/g, 'time={relativeTime($1)}');
    writeFileSync(p, s);
  }
}

// Cleanest: patch the three files' render sites to <span title>
for (const p of ['app/home/page.js', 'app/work/page.js', 'app/questions/[questionId]/page.js', 'app/landing-example.js', 'app/attempts/[attemptId]/page.js']) {
  let s = readFileSync(p, 'utf8');
  // pattern: {relativeTime(XXX)} rendered as text -> wrap with title
  const re = /\{relativeTime\(([^}]+)\)\}/g;
  if (re.test(s) && !s.includes('toRelativeTime')) {
    s = s.replace(re, (m, arg) => `{toRelativeTime(${arg})}`);
    s = s.replace('function relativeTime(value) {',
      `function toRelativeTime(value) {
  return <span title={value ?? undefined}>{relativeTime(value)}</span>;
}

function relativeTime(value) {`);
    if (!s.includes("from 'react'").includes('jsx')) {
      // ensure react import has what we need (function returns JSX)
      if (!s.match(/import .*Fragment|import React/)) {
        // Next.js transpiles JSX without explicit React import in client components
      }
    }
    writeFileSync(p, s);
    console.log(`${p}: relative times carry title`);
  }
}

// ---------- 4. document.title per route (08 §4) ----------
for (const [p, title] of [
  ['app/home/page.js', 'Home'],
  ['app/explore/page.js', 'Explore'],
  ['app/work/page.js', 'Work'],
  ['app/claims/[claimId]/page.js', null],
  ['app/questions/[questionId]/page.js', null],
  ['app/attempts/[attemptId]/page.js', null],
  ['app/contributions/page.js', 'Contributions'],
  ['app/notifications/page.js', 'Notifications'],
]) {
  let s = readFileSync(p, 'utf8');
  if (s.includes('document.title')) continue;
  const expr = title
    ? `\` \${'Home'} · EviMesh\``
    : null;
  const setTitle = title
    ? `  useEffect(() => { document.title = '${title} · EviMesh'; }, []);`
    : null;
  // for detail pages derive from loaded data
  if (!title) {
    const varName = p.includes('claims') ? 'currentRevision?.statement' : p.includes('questions') ? 'currentRevision?.title' : 'attempt?.attemptId';
    s = s.replace('  return (\n    <PageContainer',
      `  useEffect(() => {
    const label = ${varName} ?? '';
    document.title = label ? \`\${String(label).slice(0, 48)} · EviMesh\` : 'EviMesh';
  }, [${varName?.split('.')[0]}]);

  return (
    <PageContainer`);
  } else if (setTitle && s.includes('useEffect(() => { load(); }, []);')) {
    s = s.replace('  useEffect(() => { load(); }, []);', `  useEffect(() => { load(); }, []);\n${setTitle}`);
  } else if (setTitle && s.includes("useEffect(() => { if (")) {
    s = s.replace(/(useEffect\(\(\) => \{ if \([^)]+\) load\(\); \}, \[[^\]]+\]\);)/, `$1\n${setTitle}`);
  }
  writeFileSync(p, s);
}
console.log('document.title per route set');

// ---------- 5. /design catalog completeness check-passed already (audit found clean) ----------

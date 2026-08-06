'use client';

import { useState } from 'react';

const INITIAL = { taskId: '', contextBundleId: '', sourceCode: '', container: '', command: '', args: '[]', environment: '{}', hardware: '{}', randomSeed: '', startedAt: '', endedAt: '', networkAccess: false, inputArtifactIds: '[]', outputArtifactIds: '[]', exitCode: '0' };

export default function NewRunReceiptPage() {
  const [form, setForm] = useState(INITIAL);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  function previewReceipt(event) {
    event.preventDefault(); setError(null);
    try {
      const receipt = { ...form, args: JSON.parse(form.args), environment: JSON.parse(form.environment), hardware: JSON.parse(form.hardware), inputArtifactIds: JSON.parse(form.inputArtifactIds), outputArtifactIds: JSON.parse(form.outputArtifactIds), exitCode: Number(form.exitCode) };
      if (!receipt.taskId || !receipt.contextBundleId || !receipt.command || !receipt.sourceCode || !receipt.container || !receipt.startedAt || !receipt.endedAt || receipt.randomSeed === '') throw new Error('Task, Context bundle, source, container, command, seed, and timestamps are required.');
      if (Date.parse(receipt.endedAt) < Date.parse(receipt.startedAt)) throw new Error('End time must be after start time.');
      setPreview(receipt);
    } catch (reason) { setError(reason.message); setPreview(null); }
  }
  const textFields = [['taskId', 'Task ID'], ['contextBundleId', 'Context bundle ID'], ['sourceCode', 'Source code'], ['container', 'Container'], ['command', 'Command'], ['randomSeed', 'Random seed'], ['startedAt', 'Started at'], ['endedAt', 'Ended at']];
  return <main className="mx-auto max-w-5xl px-6 py-16"><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Reproducible execution</p><h1 className="mt-3 text-5xl font-semibold tracking-tight">Run Receipt</h1><p className="mt-4 max-w-2xl text-muted-foreground">Record the environment, command, seed, network policy, and artifact flow for a reproducible run.</p><form onSubmit={previewReceipt} className="mt-10 grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm md:grid-cols-2">{textFields.map(([key, label]) => <label className="grid gap-2 text-sm font-medium" key={key}>{label}<input required={['taskId', 'contextBundleId', 'sourceCode', 'container', 'command', 'randomSeed', 'startedAt', 'endedAt'].includes(key)} className="rounded border border-input bg-background p-3" type={key.endsWith('At') ? 'datetime-local' : 'text'} value={form[key]} onChange={update(key)} /></label>)}{[['args', 'Command args (JSON array)'], ['environment', 'Environment (JSON object)'], ['hardware', 'Hardware (JSON object)'], ['inputArtifactIds', 'Input artifacts (JSON array)'], ['outputArtifactIds', 'Output artifacts (JSON array)']].map(([key, label]) => <label className="grid gap-2 text-sm font-medium" key={key}>{label}<textarea className="min-h-24 rounded border border-input bg-background p-3 font-mono text-sm" value={form[key]} onChange={update(key)} /></label>)}<label className="grid gap-2 text-sm font-medium">Exit code<input type="number" className="rounded border border-input bg-background p-3" value={form.exitCode} onChange={update('exitCode')} /></label><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.networkAccess} onChange={update('networkAccess')} /> Network access enabled</label><button className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground" type="submit">Preview Receipt</button>{error && <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p>}</form>{preview && <section aria-label="Run Receipt preview" className="mt-8 rounded-xl border border-primary/30 bg-primary/5 p-6"><h2 className="text-2xl font-semibold">Receipt preview</h2><pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs">{JSON.stringify(preview, null, 2)}</pre><p className="mt-4 text-sm text-muted-foreground">Submission will be enabled when the Run command endpoint is exposed.</p></section>}</main>;
}

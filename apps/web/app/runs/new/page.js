'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input, Label, Textarea } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Checkbox } from '@/components/ui/selection';

const DRAFT_KEY = 'run:new';
const INITIAL = { taskId: '', contextBundleId: '', sourceCode: '', container: '', command: '', args: '[]', environment: '{}', hardware: '{}', randomSeed: '', startedAt: '', endedAt: '', networkAccess: false, inputArtifactIds: '[]', outputArtifactIds: '[]', exitCode: '0' };

function readDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...INITIAL, ...JSON.parse(raw) } : INITIAL;
  } catch { return INITIAL; }
}

export default function NewRunReceiptPage() {
  const [form, setForm] = useState(INITIAL);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [draftMessage, setDraftMessage] = useState(null);

  useEffect(() => {
    const draft = readDraft();
    setForm(draft);
    setHydrated(true);
    if (JSON.stringify(draft) !== JSON.stringify(INITIAL)) setDraftMessage('Draft restored from this browser.');
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setDraftMessage('Draft saved locally.');
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form, hydrated]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  function previewReceipt(event) {
    event.preventDefault();
    setError(null);
    setPreview(null);
    try {
      const receipt = { ...form, args: JSON.parse(form.args), environment: JSON.parse(form.environment), hardware: JSON.parse(form.hardware), inputArtifactIds: JSON.parse(form.inputArtifactIds), outputArtifactIds: JSON.parse(form.outputArtifactIds), exitCode: Number(form.exitCode) };
      if (!receipt.taskId || !receipt.contextBundleId || !receipt.command || !receipt.sourceCode || !receipt.container || !receipt.startedAt || !receipt.endedAt || receipt.randomSeed === '') throw new Error('Task, Context bundle, source, container, command, seed, and timestamps are required.');
      if (Date.parse(receipt.endedAt) < Date.parse(receipt.startedAt)) throw new Error('End time must be after start time.');
      setPreview(receipt);
    } catch (reason) { setError(reason.message); }
  }

  const textFields = [['taskId', 'Task ID'], ['contextBundleId', 'Context bundle ID'], ['sourceCode', 'Source code'], ['container', 'Container'], ['command', 'Command'], ['randomSeed', 'Random seed'], ['startedAt', 'Started at'], ['endedAt', 'Ended at']];
  const jsonFields = [['args', 'Command args (JSON array)'], ['environment', 'Environment (JSON object)'], ['hardware', 'Hardware (JSON object)'], ['inputArtifactIds', 'Input artifacts (JSON array)'], ['outputArtifactIds', 'Output artifacts (JSON array)']];

  return <PageContainer><PageHeader eyebrow="Reproducible execution" title="Run Receipt" description="Record the environment, command, seed, network policy, and artifact flow for a reproducible run." />
    {draftMessage && <p role="status" className="mt-3 text-sm text-muted-foreground">{draftMessage}</p>}
    <form onSubmit={previewReceipt} className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2">
      {textFields.map(([key, label]) => <div className="grid gap-2" key={key}><Label htmlFor={`run-${key}`}>{label}</Label><Input id={`run-${key}`} required={['taskId', 'contextBundleId', 'sourceCode', 'container', 'command', 'randomSeed', 'startedAt', 'endedAt'].includes(key)} type={key.endsWith('At') ? 'datetime-local' : 'text'} value={form[key]} onChange={update(key)} /></div>)}
      {jsonFields.map(([key, label]) => <div className="grid gap-2" key={key}><Label htmlFor={`run-${key}`}>{label}</Label><Textarea id={`run-${key}`} className="min-h-24 font-mono text-sm" value={form[key]} onChange={update(key)} /></div>)}
      <div className="grid gap-2"><Label htmlFor="run-exit-code">Exit code</Label><Input id="run-exit-code" type="number" value={form.exitCode} onChange={update('exitCode')} /></div>
      <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={form.networkAccess} onChange={update('networkAccess')} /> Network access enabled</label>
      <div className="md:col-span-2"><Button type="submit">Preview Receipt</Button></div>
      {error && <Alert variant="destructive" title="Receipt is invalid" description={error} className="md:col-span-2" />}
    </form>
    {preview && <section aria-label="Run Receipt preview" className="mt-8 rounded-lg border border-primary/30 bg-primary/5 p-6"><h2 className="text-lg font-semibold">Receipt preview</h2><pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(preview, null, 2)}</pre><p className="mt-4 text-sm text-muted-foreground">Submission will be enabled when the Run command endpoint is exposed.</p></section>}
  </PageContainer>;
}

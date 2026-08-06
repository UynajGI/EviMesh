'use client';

import { useState } from 'react';

const OUTCOMES = ['supports', 'refutes', 'qualifies', 'inconclusive'];
const RELATIONS = ['independent', 'partially_independent', 'same_implementation', 'unknown'];

export function VerificationReceiptForm() {
  const [form, setForm] = useState({ receiptId: '', claimId: '', claimRevision: '1', runId: '', contractId: '', contractRevision: '1', outcome: 'supports', implementationRelation: 'independent', dataRelation: 'independent', findings: '[]' });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  function prepare(event) {
    event.preventDefault(); setError(null);
    try {
      if (Object.values(form).some((value) => value === '')) throw new Error('All receipt identity and independence fields are required.');
      const findings = JSON.parse(form.findings);
      if (!Array.isArray(findings)) throw new Error('Findings must be a JSON array.');
      setPreview({ ...form, claimRevision: Number(form.claimRevision), contractRevision: Number(form.contractRevision), findings });
    } catch (reason) { setError(reason.message); setPreview(null); }
  }
  return <form aria-label="Verification Receipt form" onSubmit={prepare} className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-6 md:grid-cols-2"><div className="md:col-span-2"><h2 className="text-2xl font-semibold">Verification Receipt</h2><p className="mt-2 text-sm text-muted-foreground">Record an outcome, independence assessment, and structured findings against pinned immutable revisions.</p></div>{[['receiptId', 'Receipt ID'], ['claimId', 'Claim ID'], ['runId', 'Run ID'], ['contractId', 'Contract ID']].map(([key, label]) => <label className="grid gap-2 text-sm font-medium" key={key}>{label}<input required className="rounded border border-input bg-background p-3" value={form[key]} onChange={update(key)} /></label>)}{[['claimRevision', 'Claim revision'], ['contractRevision', 'Contract revision']].map(([key, label]) => <label className="grid gap-2 text-sm font-medium" key={key}>{label}<input required min="1" type="number" className="rounded border border-input bg-background p-3" value={form[key]} onChange={update(key)} /></label>)}<label className="grid gap-2 text-sm font-medium">Outcome<select className="rounded border border-input bg-background p-3" value={form.outcome} onChange={update('outcome')}>{OUTCOMES.map((outcome) => <option key={outcome}>{outcome}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Implementation independence<select className="rounded border border-input bg-background p-3" value={form.implementationRelation} onChange={update('implementationRelation')}>{RELATIONS.map((relation) => <option key={relation}>{relation}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Data independence<select className="rounded border border-input bg-background p-3" value={form.dataRelation} onChange={update('dataRelation')}>{RELATIONS.map((relation) => <option key={relation}>{relation}</option>)}</select></label><label className="grid gap-2 text-sm font-medium md:col-span-2">Findings (JSON array)<textarea className="min-h-28 rounded border border-input bg-background p-3 font-mono text-sm" value={form.findings} onChange={update('findings')} /></label><button className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground" type="submit">Preview Receipt</button>{error && <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p>}{preview && <section aria-label="Verification Receipt preview" className="md:col-span-2 rounded-xl border border-primary/30 bg-primary/5 p-5"><h3 className="text-xl font-semibold">Receipt preview</h3><pre className="mt-3 overflow-x-auto rounded bg-muted p-4 text-xs">{JSON.stringify(preview, null, 2)}</pre></section>}</form>;
}

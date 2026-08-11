'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/data';
import { Confirm } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { Input, Label, Textarea } from '@/components/ui/form';
import { Select, Switch } from '@/components/ui/selection';

const OUTCOMES = ['supports', 'refutes', 'qualifies', 'inconclusive'];
const CONTEXT_MODES = ['frontier', 'full_trace', 'adversarial', 'blind'];
const BLANK = { receiptId: '', runId: '', claimId: '', claimRevision: '1', contractId: '', contractRevision: '1', outcome: 'supports', verificationTypes: '[]', contextMode: 'blind', sawExpectedOutputs: false, implementationRelation: '', dataRelation: '', modelFamily: '', findings: '[]', signingKeyId: '' };

export function VerificationWorkspace() {
  const [form, setForm] = useState(BLANK);
  const [blindContext, setBlindContext] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [signed, setSigned] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  function prepare(event) {
    event.preventDefault();
    setError(null);
    setPreview(null);
    try {
      const receipt = { ...form, claimRevision: Number(form.claimRevision), contractRevision: Number(form.contractRevision), verificationTypes: JSON.parse(form.verificationTypes), findings: JSON.parse(form.findings) };
      if (!receipt.receiptId || !receipt.runId || !receipt.claimId || !receipt.contractId || !receipt.implementationRelation || !receipt.dataRelation || !receipt.modelFamily) throw new Error('Receipt, Run, Claim, Contract, implementation, data, and model fields are required.');
      if (!Array.isArray(receipt.verificationTypes) || !Array.isArray(receipt.findings)) throw new Error('Verification types and findings must be JSON arrays.');
      setPreview({ ...receipt, blindContext: receipt.contextMode === 'blind' ? blindContext : undefined, expectedOutputs: undefined });
    } catch (reason) { setError(reason.message); }
  }

  const fields = [['receiptId', 'Receipt ID'], ['runId', 'Run ID'], ['claimId', 'Claim ID'], ['contractId', 'Contract ID'], ['implementationRelation', 'Implementation relation'], ['dataRelation', 'Data relation'], ['modelFamily', 'Model family'], ['signingKeyId', 'Signing key ID']];

  return <section aria-label="Verification workspace" className="mx-auto max-w-6xl px-6 pb-20"><div className="flex flex-wrap items-end justify-between gap-4"><h2 className="text-2xl font-semibold tracking-tight">Verification workspace</h2><Badge variant="warning">Expected outputs hidden</Badge></div><p className="mt-3 max-w-2xl text-muted-foreground">Pin the Claim revision, Run, and Verification Contract before recording an auditable outcome.</p>
    <section aria-label="Blind Context" className="mt-6 rounded-lg border border-warning/50 bg-warning/5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Blind Context</h3><span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">Expected outputs hidden</span></div><p className="mt-2 text-sm text-muted-foreground">Only the pinned task context is shown to the verifier. Expected outputs and prior verdicts are intentionally excluded.</p><Textarea aria-label="Blind Context content" className="mt-4 min-h-32 font-mono text-sm" placeholder="Paste or load the blind context bundle here…" value={blindContext} onChange={(event) => setBlindContext(event.target.value)} /></section>
    <form onSubmit={prepare} className="mt-6 grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2">
      {fields.map(([key, label]) => <div className="grid gap-2" key={key}><Label htmlFor={`verify-${key}`}>{label}</Label><Input id={`verify-${key}`} required value={form[key]} onChange={update(key)} /></div>)}
      <div className="grid gap-2"><Label htmlFor="verify-claim-revision">Claim revision</Label><Input id="verify-claim-revision" required min="1" type="number" value={form.claimRevision} onChange={update('claimRevision')} /></div>
      <div className="grid gap-2"><Label htmlFor="verify-contract-revision">Contract revision</Label><Input id="verify-contract-revision" required min="1" type="number" value={form.contractRevision} onChange={update('contractRevision')} /></div>
      <div className="grid gap-2"><Label htmlFor="verify-outcome">Outcome</Label><Select id="verify-outcome" value={form.outcome} onChange={update('outcome')}>{OUTCOMES.map((outcome) => <option key={outcome}>{outcome}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="verify-mode">Context mode</Label><Select id="verify-mode" value={form.contextMode} onChange={update('contextMode')}>{CONTEXT_MODES.map((mode) => <option key={mode}>{mode}</option>)}</Select></div>
      <div className="grid gap-2"><Label htmlFor="verify-types">Verification types (JSON array)</Label><Textarea id="verify-types" required className="min-h-20 font-mono text-sm" value={form.verificationTypes} onChange={update('verificationTypes')} /></div>
      <div className="grid gap-2"><Label htmlFor="verify-findings">Findings (JSON array)</Label><Textarea id="verify-findings" className="min-h-20 font-mono text-sm" value={form.findings} onChange={update('findings')} /></div>
      <label className="flex items-center gap-2 text-sm font-medium"><Switch checked={form.sawExpectedOutputs} onCheckedChange={(checked) => setForm((current) => ({ ...current, sawExpectedOutputs: checked }))} /> Saw expected outputs</label>
      <div className="md:col-span-2"><Button type="submit">Prepare verification</Button></div>
      {error && <Alert variant="destructive" title="Verification is incomplete" description={error} className="md:col-span-2" />}
    </form>
    {preview && <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Verification receipt preview</h3>{signed ? <Badge variant="success">Signed with {form.signingKeyId}</Badge> : <Badge variant="warning">Not yet signed</Badge>}</div><pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">{JSON.stringify(preview, null, 2)}</pre><p className="mt-3 text-sm text-muted-foreground">The receipt is signed client-side with your signing key; the signature envelope is attached on submission.</p><div className="mt-4 flex gap-3">{signed ? <Button type="button" variant="outline" onClick={() => setSigned(false)}>Reset signature</Button> : <Button type="button" variant="outline" onClick={() => setSigned(true)}>I have signed this receipt</Button>}<Button type="button" onClick={() => setConfirming(true)} disabled={!signed}>Submit verification</Button></div></div>}
    <Confirm open={confirming} onOpenChange={(open) => { if (!open) setConfirming(false); }} title="Submit this verification?" description="The signed receipt is final and will be appended to the claim's immutable revision history." confirmLabel="Submit verification" onConfirm={() => { setConfirming(false); setPreview(null); setForm(BLANK); setSigned(false); }} />
  </section>;
}

'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Progress } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { Select } from '@/components/ui/selection';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const LICENSES = ['CC-BY-4.0', 'CC0-1.0', 'MIT'];

async function sha256(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function putWithProgress(url, file, onProgress, controller) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('content-type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${request.status}).`));
    request.onerror = () => reject(new Error('R2 upload failed.'));
    request.onabort = () => reject(new Error('Upload cancelled.'));
    controller.signal.addEventListener('abort', () => request.abort(), { once: true });
    request.send(file);
  });
}

const STATUS_LABELS = {
  hashing: 'Hashing locally…',
  preparing: 'Preparing signed upload…',
  uploading: (progress) => `Uploading to R2… ${progress}%`,
  complete: 'Upload complete and ready for verification.',
  error: 'Upload failed.',
  cancelled: 'Upload cancelled. The partial upload is discarded; no artifact was recorded.',
};

export function ArtifactUploadPanel() {
  const [file, setFile] = useState(null);
  const [artifactId, setArtifactId] = useState('');
  const [revision, setRevision] = useState('1');
  const [license, setLicense] = useState(LICENSES[0]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [hash, setHash] = useState(null);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);
  const active = status === 'hashing' || status === 'preparing' || status === 'uploading';

  async function upload(event) {
    event?.preventDefault();
    setError(null);
    setHash(null);
    if (!file) { setError('Choose a file first.'); return; }
    try {
      setStatus('hashing'); setProgress(0);
      const rawHash = await sha256(file); setHash(rawHash); setProgress(100);
      setStatus('preparing');
      const planResponse = await fetch(`${API}/artifacts/upload-plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artifactId, revision: Number(revision), rawHash, sizeBytes: file.size, mediaType: file.type || 'application/octet-stream', fileName: file.name, license }) });
      const plan = await planResponse.json();
      if (!planResponse.ok) throw new Error(plan.message ?? 'Upload plan is unavailable.');
      setStatus('uploading'); setProgress(0);
      const controller = new AbortController();
      controllerRef.current = controller;
      await putWithProgress(plan.url, file, setProgress, controller);
      setStatus('complete');
    } catch (reason) {
      setStatus(reason.message === 'Upload cancelled.' ? 'cancelled' : 'error');
      setError(reason.message);
    } finally {
      controllerRef.current = null;
    }
  }

  function cancel() { controllerRef.current?.abort(); }

  return <form aria-label="Evidence artifact upload" onSubmit={upload} className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-6"><div><h2 className="text-lg font-semibold">Upload evidence artifact</h2><p className="mt-1 text-sm text-muted-foreground">Hash the file locally, then upload it directly to R2 through a short-lived signed URL. Choose a license before uploading.</p></div>
    <div className="grid gap-2"><Label htmlFor="artifact-id">Artifact ID</Label><Input id="artifact-id" required placeholder="artifact-id" value={artifactId} onChange={(event) => setArtifactId(event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="artifact-revision">Revision</Label><Input id="artifact-revision" required min="1" type="number" value={revision} onChange={(event) => setRevision(event.target.value)} /></div>
    <div className="grid gap-2"><Label htmlFor="artifact-license">License</Label><Select id="artifact-license" value={license} onChange={(event) => setLicense(event.target.value)}>{LICENSES.map((value) => <option key={value} value={value}>{value}</option>)}</Select><p className="text-xs text-muted-foreground">The license you choose governs how others may reuse this artifact.</p></div>
    <div className="grid gap-2"><Label htmlFor="artifact-file">File</Label><Input id="artifact-file" required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
    <div className="flex flex-wrap items-center gap-3">{active ? <Button type="button" variant="outline" onClick={cancel}>Cancel upload</Button> : status === 'error' || status === 'cancelled' ? <Button type="button" onClick={upload}>Retry upload</Button> : <Button type="submit">Upload to R2</Button>}</div>
    {active && status !== 'hashing' && <Progress value={progress} aria-label="Upload progress" />}
    {status !== 'idle' && <p role="status" className="text-sm text-muted-foreground">{typeof STATUS_LABELS[status] === 'function' ? STATUS_LABELS[status](progress) : STATUS_LABELS[status]}</p>}
    {hash && <p className="break-all font-mono text-xs tabular-nums">SHA-256: {hash}</p>}
    {error && status === 'error' && <Alert variant="destructive" title="Upload failed" description={error} />}
    {error && status === 'cancelled' && <Alert variant="warning" title="Upload cancelled" description={error} />}
  </form>;
}

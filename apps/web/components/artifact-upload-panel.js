'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;

async function sha256(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function putWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('content-type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${request.status}).`));
    request.onerror = () => reject(new Error('R2 upload failed.'));
    request.send(file);
  });
}

export function ArtifactUploadPanel() {
  const [file, setFile] = useState(null);
  const [artifactId, setArtifactId] = useState('');
  const [revision, setRevision] = useState('1');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [hash, setHash] = useState(null);
  const [error, setError] = useState(null);

  async function upload(event) {
    event.preventDefault(); setError(null); setHash(null);
    if (!file) { setError('Choose a file first.'); return; }
    try {
      setStatus('hashing'); setProgress(0);
      const rawHash = await sha256(file); setHash(rawHash); setProgress(100);
      setStatus('preparing');
      const planResponse = await fetch(`${API}/artifacts/upload-plan`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artifactId, revision: Number(revision), rawHash, sizeBytes: file.size, mediaType: file.type || 'application/octet-stream' }) });
      const plan = await planResponse.json();
      if (!planResponse.ok) throw new Error(plan.message ?? 'Upload plan is unavailable.');
      setStatus('uploading'); setProgress(0);
      await putWithProgress(plan.url, file, setProgress);
      setStatus('complete');
    } catch (reason) { setStatus('error'); setError(reason.message); }
  }

  return <form aria-label="Evidence artifact upload" onSubmit={upload} className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"><div><h2 className="text-2xl font-semibold">Upload evidence artifact</h2><p className="mt-2 text-sm text-muted-foreground">Hash the file locally, then upload it directly to R2 through a short-lived signed URL.</p></div><label className="grid gap-2 text-sm font-medium">Artifact ID<input required className="rounded border border-input bg-background p-3" value={artifactId} onChange={(event) => setArtifactId(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">Revision<input required min="1" type="number" className="rounded border border-input bg-background p-3" value={revision} onChange={(event) => setRevision(event.target.value)} /></label><label className="grid gap-2 text-sm font-medium">File<input required type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button disabled={status === 'hashing' || status === 'preparing' || status === 'uploading'} className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" type="submit">Upload to R2</button>{status !== 'idle' && <p role="status" className="text-sm">{status === 'hashing' ? 'Hashing locally…' : status === 'preparing' ? 'Preparing signed upload…' : status === 'uploading' ? `Uploading to R2… ${progress}%` : status === 'complete' ? 'Upload complete and ready for verification.' : 'Upload failed.'}</p>}{hash && <p className="break-all font-mono text-xs">SHA-256: {hash}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form>;
}

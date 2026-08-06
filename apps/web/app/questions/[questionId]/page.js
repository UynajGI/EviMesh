'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

async function request(path) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_EVIMESH_API_URL}${path}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? 'Question data is unavailable.');
  return body;
}

export default function QuestionDetailPage({ params }) {
  const [questionId, setQuestionId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { Promise.resolve(params).then(({ questionId: value }) => setQuestionId(value)); }, [params]);
  useEffect(() => {
    if (!questionId) return;
    request(`/questions/${questionId}`).then(async (question) => {
      const tasks = await request(`/tasks?projectId=${question.question.projectId}&limit=6`);
      return { ...question, tasks: tasks.items ?? [] };
    }).then(setData).catch((reason) => setError(reason.message));
  }, [questionId]);
  if (error) return <main className="mx-auto max-w-4xl px-6 py-16"><p role="alert" className="text-sm text-destructive">{error}</p></main>;
  if (!data) return <main className="mx-auto max-w-4xl px-6 py-16" aria-busy="true">Loading question…</main>;
  return <main className="mx-auto max-w-4xl px-6 py-16"><Link className="text-sm font-medium text-primary" href="/">← Back home</Link><p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-primary">Question · {data.question.state}</p><h1 className="mt-3 text-5xl font-semibold tracking-tight">{data.currentRevision.title}</h1><p className="mt-5 text-lg leading-8 text-muted-foreground">{data.currentRevision.statement}</p><section className="mt-12 rounded-xl border border-border bg-card p-6"><h2 className="text-2xl font-semibold">Research Contract</h2><p className="mt-3 text-sm text-muted-foreground">{data.contract.title ?? data.contract.contractId} · revision {data.contract.revision}</p></section><section className="mt-8 rounded-xl border border-border bg-card p-6"><h2 className="text-2xl font-semibold">Tasks</h2>{data.tasks.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No tasks are attached to this project yet.</p> : <ul className="mt-4 space-y-3">{data.tasks.map((task) => <li className="rounded border border-border p-4" key={task.taskId}>{task.taskId}<span className="ml-3 text-sm text-muted-foreground">{task.status}</span></li>)}</ul>}</section></main>;
}

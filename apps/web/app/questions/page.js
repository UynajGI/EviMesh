'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/data';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const QUESTION_STATES = ['draft', 'proposed', 'under_review', 'admissible', 'active', 'resolved', 'archived', 'rejected'];

function stateVariant(state) {
  switch (state) {
    case 'active':
    case 'admissible': return 'success';
    case 'under_review': return 'warning';
    case 'resolved': return 'info';
    case 'rejected':
    case 'archived': return 'destructive';
    default: return 'default';
  }
}

function nextStep(state) {
  switch (state) {
    case 'draft': return 'Review the draft and propose it';
    case 'proposed': return 'Awaiting review';
    case 'under_review': return 'Under review';
    case 'admissible': return 'Open for research';
    case 'active': return 'Active research';
    case 'resolved': return 'Resolved';
    case 'archived': return 'Archived';
    case 'rejected': return 'Rejected';
    default: return 'Open question details';
  }
}

function relativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Activity time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ state: '', search: '' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ limit: '100' });
      if (filters.state) query.set('state', filters.state);
      const response = await fetch(`${API}/questions?${query.toString()}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? 'Questions are unavailable.');
      setQuestions(body.items ?? []);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filters.state]);

  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const query = filters.search.trim().toLowerCase();
  const visible = query ? questions.filter((question) => (question.questionId ?? '').toLowerCase().includes(query)) : questions;

  if (error) {
    return <PageContainer><PageHeader eyebrow="Research questions" title="Questions" description="Browse research questions by protocol status before opening their full context." /><ErrorState className="mt-8" message={error} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader eyebrow="Research questions" title="Questions" description="Browse research questions by protocol status before opening their full context." />
      <div className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="question-state">Status</Label><Select id="question-state" value={filters.state} onChange={updateFilter('state')}><option value="">All statuses</option>{QUESTION_STATES.map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}</Select></div>
        <div className="grid gap-2"><Label htmlFor="question-search">Search</Label><Input id="question-search" value={filters.search} onChange={updateFilter('search')} placeholder="Filter by question ID" /></div>
      </div>
      {loading ? <Skeleton className="mt-10 h-96 w-full" /> : visible.length === 0 ? <Empty className="mt-10" title={query ? 'No questions match your search' : 'No questions yet'} description="Questions will appear here once research questions are opened." /> : <div className="mt-10 grid gap-4 md:grid-cols-2">{visible.map((question) => <Link className="rounded-lg border border-border bg-card p-5 transition hover:border-primary" href={`/questions/${question.questionId}`} key={question.questionId}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-medium tabular-nums">{question.questionId}</h2><Badge variant={stateVariant(question.state)}>{question.state.replaceAll('_', ' ')}</Badge></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground"><span className="tabular-nums">{question.projectId}</span> · {nextStep(question.state)}</p><time className="text-xs tabular-nums text-muted-foreground" dateTime={question.createdAt}>{relativeTime(question.createdAt)}</time></div></Link>)}</div>}
    </PageContainer>
  );
}

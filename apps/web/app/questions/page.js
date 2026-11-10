'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/data';
import { Identifier, shortId } from '@/components/ui/doc';
import { Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Input, Label } from '@/components/ui/form';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Select } from '@/components/ui/selection';
import { withWords } from '@/lib/list-words.mjs';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const QUESTION_STATES = ['draft', 'proposed', 'under_review', 'admissible', 'active', 'resolved', 'archived', 'rejected'];

/* The title comes from the row, or from the bounded detail read in withWords. */
function questionTitle(question) {
  const value = question.title ?? question.currentRevision?.title ?? question.words ?? null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
  if (Number.isNaN(timestamp)) return null;
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
      setQuestions(await withWords(API, body.items ?? [], { idKey: 'questionId', path: '/questions', record: 'question', fields: ['title'] }));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filters.state]);

  const updateFilter = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const query = filters.search.trim().toLowerCase();
  const visible = query ? questions.filter((question) => `${question.questionId ?? ''} ${questionTitle(question) ?? ''}`.toLowerCase().includes(query)) : questions;

  if (error) {
    return <PageContainer><PageHeader title="Questions" /><ErrorState className="mt-8" message={error} onRetry={load} /></PageContainer>;
  }

  return (
    <PageContainer wide>
      <PageHeader title="Questions" />
      <div className="mt-4 grid gap-4 border-b border-border pb-4 sm:grid-cols-2">
        <div className="grid gap-2"><Label htmlFor="question-state">Status</Label><Select id="question-state" value={filters.state} onChange={updateFilter('state')}><option value="">All statuses</option>{QUESTION_STATES.map((state) => <option key={state} value={state}>{state.replaceAll('_', ' ')}</option>)}</Select></div>
        <div className="grid gap-2"><Label htmlFor="question-search">Search</Label><Input id="question-search" value={filters.search} onChange={updateFilter('search')} placeholder="Title or question ID" /></div>
      </div>
      {loading ? <Skeleton className="mt-8 h-96 w-full" /> : visible.length === 0 ? <Empty className="mt-8" title={query ? 'No matching questions' : 'No questions yet'} /> : (
        <section aria-labelledby="questions-heading" className="mt-8">
          <SectionHeader action={<span className="tabular-nums text-muted-foreground">{visible.length}</span>} id="questions-heading" title="Research questions" />
          <ul>
            {visible.map((question) => {
              const title = questionTitle(question);
              return (
                <li className="ref-row" key={question.questionId}>
                  <div><StatusBadge label={question.state.replaceAll('_', ' ')} state={question.state} /></div>
                  <div className="min-w-0">
                    {title ? (
                      <Link className="ref-row__title [overflow-wrap:anywhere] hover:underline" href={`/questions/${question.questionId}`}>{title}</Link>
                    ) : (
                      <Link className="block font-mono text-sm tabular-nums hover:underline" href={`/questions/${question.questionId}`} title={question.questionId}>{shortId(question.questionId)}</Link>
                    )}
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {title ? <Identifier value={question.questionId} /> : null}
                      {question.projectId ? <Link className="hover:text-foreground hover:underline" href={`/projects/${question.projectId}`} title={question.projectId}><span className="font-mono">{shortId(question.projectId)}</span></Link> : null}
                      <span>{nextStep(question.state)}</span>
                    </p>
                  </div>
                  <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={question.createdAt} title={question.createdAt}>{relativeTime(question.createdAt)}</time>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}

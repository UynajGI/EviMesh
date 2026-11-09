'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buttonLinkVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/data';
import { ActorName, Identifier, MarginSection, shortId } from '@/components/ui/doc';
import { Alert, DeniedState, Empty, ErrorState, Skeleton } from '@/components/ui/feedback';
import { PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { fetchMyInteractions } from '@/lib/interactions';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { readVisitHistory } from '@/lib/visit-history';

const API = process.env.NEXT_PUBLIC_EVIMESH_API_URL;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WATCHED_OBJECTS = 24;
const EVENTS_PER_OBJECT = 100;
const DETAIL_HYDRATION_BATCH_SIZE = 8;
const MAX_CLASSIFICATION_DETAILS = 48;
const EMPTY_PARTIAL = { omittedObjects: 0, failedObjects: 0, truncatedObjects: 0, invalidEvents: 0, failedDetails: 0, omittedDetails: 0 };

const GROUPS = [
  { level: 'critical', title: 'Needs prompt review' },
  { level: 'attention', title: 'Worth attention' },
  { level: 'update', title: 'Routine updates' },
];

function createObservationWindow() {
  const asOf = new Date();
  const windowStart = new Date(asOf.getTime() - (7 * DAY_MS));
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const offsetMinutes = -asOf.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
  return {
    asOf: asOf.toISOString(),
    windowStart: windowStart.toISOString(),
    timeZone,
    offset: `UTC${sign}${hours}:${minutes}`,
  };
}

function formatDateTime(value, timeZone) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Timestamp unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(timestamp));
}

function toRelativeTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Time unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes || 1}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function getJson(path, options) {
  const response = await fetch(`${API}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(payload.message ?? `${path} is unavailable.`);
    failure.requestId = payload.request_id ?? payload.requestId ?? null;
    failure.status = response.status;
    throw failure;
  }
  return payload;
}

function apiGrantIsActive(grant, now = new Date()) {
  if (!grant || grant.revokedAt) return false;
  if (grant.expiresAt === null || grant.expiresAt === undefined) return true;
  const expiresAt = new Date(grant.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

async function fetchAgentConnection() {
  try {
    const { data } = await createBrowserSupabaseClient().auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) return { state: 'signed-out' };
    const payload = await getJson('/api-tokens', { headers: { authorization: `Bearer ${token}` } });
    const grants = Array.isArray(payload) ? payload : payload.tokens ?? payload.items ?? [];
    return {
      state: 'available',
      activeGrantCount: grants.filter((grant) => apiGrantIsActive(grant)).length,
    };
  } catch {
    return { state: 'unavailable' };
  }
}

function uniqueWatchScope(interactions) {
  const scopes = new Map();
  for (const interaction of Array.isArray(interactions) ? interactions : []) {
    if (interaction?.kind !== 'watch' || !interaction.objectType || !interaction.objectId) continue;
    const key = `${interaction.objectType}:${interaction.objectId}`;
    if (!scopes.has(key)) scopes.set(key, { objectType: interaction.objectType, objectId: interaction.objectId });
  }
  return [...scopes.values()];
}

function eventsPath(scope, window, cursor = null) {
  const query = new URLSearchParams({
    objectType: scope.objectType,
    objectId: scope.objectId,
    createdAfter: window.windowStart,
    createdBefore: window.asOf,
    order: 'desc',
    limit: String(EVENTS_PER_OBJECT),
  });
  if (cursor) query.set('cursor', cursor);
  return `/events?${query.toString()}`;
}

function sortNewestProtocolOrder(left, right) {
  const timeDifference = Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0);
  if (timeDifference !== 0 && !Number.isNaN(timeDifference)) return timeDifference;
  return String(right.eventId).localeCompare(String(left.eventId));
}

function mergeEventPages(successfulPages) {
  const eventsById = new Map();
  let invalidEvents = 0;
  for (const { scope, payload } of successfulPages) {
    for (const event of Array.isArray(payload.items) ? payload.items : []) {
      if (!event?.eventId || !event?.eventType) {
        invalidEvents += 1;
        continue;
      }
      const existing = eventsById.get(event.eventId);
      if (existing) {
        if (!existing.watchedScopes.some((item) => item.objectType === scope.objectType && item.objectId === scope.objectId)) {
          existing.watchedScopes.push(scope);
        }
      } else {
        eventsById.set(event.eventId, { ...event, watchedScopes: [scope] });
      }
    }
  }
  return {
    events: [...eventsById.values()].sort(sortNewestProtocolOrder),
    invalidEvents,
  };
}

function payloadValue(payload, ...keys) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return value;
  }
  return null;
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function hasExplicitImpact(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const keys = [
    'impact', 'impact_scope', 'impactScope', 'affected_object_id', 'affectedObjectId',
    'affected_claim_revision_id', 'affectedClaimRevisionId', 'downstream_claim_revision_ids',
    'downstreamClaimRevisionIds', 'blocked', 'blocking', 'tainted',
  ];
  return keys.some((key) => {
    const value = payload[key];
    if (value === true) return true;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    return !['', '0', 'false', 'none', 'no', 'unaffected'].includes(normalized(value));
  });
}

function classificationDetailTarget(event) {
  const type = normalized(event.eventType);
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  if (type === 'verification.submitted') {
    const receiptId = payloadValue(payload, 'receipt_id', 'receiptId');
    const findingCount = payloadValue(payload, 'finding_count', 'findingCount');
    if (receiptId && (findingCount === null || Number(findingCount) > 0)) {
      return { key: `verification:${receiptId}`, kind: 'verification', id: String(receiptId) };
    }
  }
  if (type === 'challenge.upheld' && !hasExplicitImpact(payload)) {
    const challengeId = payloadValue(payload, 'challenge_id', 'challengeId');
    if (challengeId) return { key: `challenge:${challengeId}`, kind: 'challenge', id: String(challengeId) };
  }
  return null;
}

function highestFindingSeverity(findings) {
  const severities = new Set((Array.isArray(findings) ? findings : []).map((finding) => normalized(finding?.severity)));
  return ['critical', 'major', 'warning', 'note'].find((severity) => severities.has(severity)) ?? null;
}

async function classificationContextFor(target) {
  if (target.kind === 'verification') {
    const detail = await getJson(`/verifications/${encodeURIComponent(target.id)}`);
    return { findingSeverity: highestFindingSeverity(detail.findings) };
  }
  const detail = await getJson(`/challenges/${encodeURIComponent(target.id)}`);
  return {
    challengeHasImpact: hasExplicitImpact(detail.currentRevision)
      || (Array.isArray(detail.impacts) && detail.impacts.length > 0),
  };
}

async function hydrateClassificationContexts(events) {
  const targets = new Map();
  for (const event of events) {
    const target = classificationDetailTarget(event);
    if (target) targets.set(target.key, target);
  }
  const contexts = new Map();
  let failedDetails = 0;
  const allValues = [...targets.values()];
  const values = allValues.slice(0, MAX_CLASSIFICATION_DETAILS);
  const omittedDetails = Math.max(0, allValues.length - values.length);
  for (let index = 0; index < values.length; index += DETAIL_HYDRATION_BATCH_SIZE) {
    const chunk = values.slice(index, index + DETAIL_HYDRATION_BATCH_SIZE);
    const settled = await Promise.allSettled(chunk.map(async (target) => ({
      key: target.key,
      context: await classificationContextFor(target),
    })));
    for (const result of settled) {
      if (result.status === 'fulfilled') contexts.set(result.value.key, result.value.context);
      else failedDetails += 1;
    }
  }
  return {
    events: events.map((event) => {
      const target = classificationDetailTarget(event);
      const classificationContext = target ? contexts.get(target.key) : null;
      return classificationContext ? { ...event, classificationContext } : event;
    }),
    failedDetails,
    omittedDetails,
  };
}

function classifyEvent(event) {
  const type = normalized(event.eventType);
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const classificationContext = event.classificationContext && typeof event.classificationContext === 'object' ? event.classificationContext : {};
  const claimState = normalized(payloadValue(payload, 'claim_state', 'claimState', 'to_state', 'toState', 'state', 'status', 'outcome'));
  const findingSeverity = normalized(classificationContext.findingSeverity ?? payloadValue(payload, 'severity', 'finding_severity', 'findingSeverity'));
  const challengeState = normalized(payloadValue(payload, 'challenge_state', 'challengeState', 'to_state', 'toState', 'state', 'status', 'outcome'));
  const relationType = normalized(payloadValue(payload, 'relation_type', 'relationType', 'evidence_relation', 'evidenceRelation'));
  const frontierAction = normalized(payloadValue(payload, 'action', 'change_type', 'changeType', 'membership_change', 'membershipChange', 'state', 'status'));

  const explicitRefutedOrRetracted = type.startsWith('claim.')
    && (/(^|\.)(refuted|retracted)$/.test(type) || ['refuted', 'retracted'].includes(claimState));
  const criticalFinding = (type.includes('finding') || type.startsWith('verification.')) && findingSeverity === 'critical';
  const upheldChallengeWithImpact = type.includes('challenge') && challengeState === 'upheld'
    && (classificationContext.challengeHasImpact === true || hasExplicitImpact(payload));
  const frontierTaintOrRemovalImpact = type.includes('frontier')
    && (/taint|remove|replace/.test(type) || /taint|remove|replace/.test(frontierAction))
    && hasExplicitImpact(payload);
  if (explicitRefutedOrRetracted || criticalFinding || upheldChallengeWithImpact || frontierTaintOrRemovalImpact) return 'critical';

  const explicitlyContested = type.startsWith('claim.')
    && (/(^|\.)contested$/.test(type) || claimState === 'contested');
  const refutingEvidence = type.includes('evidence') && relationType === 'refutes';
  const majorFinding = (type.includes('finding') || type.startsWith('verification.')) && findingSeverity === 'major';
  const createdChallenge = type === 'challenge.created';
  const investigatingChallenge = type.includes('challenge') && challengeState === 'investigating';
  const verificationContextChanged = type.startsWith('verification.')
    && (payloadValue(payload, 'outcome', 'verification_outcome', 'verificationOutcome') !== null || /submitted|completed|revised|evaluated|invalidated/.test(type));
  const policyContextChanged = /(policy|contract)/.test(type)
    && (/revised|published|updated|evaluated/.test(type)
      || payloadValue(payload, 'policy_revision_id', 'policyRevisionId', 'policy_revision', 'policyRevision', 'contract_revision_id', 'contractRevisionId', 'contract_revision', 'contractRevision') !== null);
  const frontierContextChanged = type.includes('frontier')
    && hasExplicitImpact(payload)
    && (/member|snapshot|publish|replace|remove|add/.test(type)
      || /member|snapshot|publish|replace|remove|add|taint/.test(frontierAction)
      || payloadValue(payload, 'frontier_snapshot_id', 'frontierSnapshotId', 'snapshot_id', 'snapshotId') !== null);
  if (explicitlyContested || refutingEvidence || majorFinding || createdChallenge || investigatingChallenge || verificationContextChanged || policyContextChanged || frontierContextChanged) return 'attention';

  return 'update';
}

function eventFacts(event) {
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const classificationContext = event.classificationContext && typeof event.classificationContext === 'object' ? event.classificationContext : {};
  return {
    type: String(event.eventType),
    claimState: normalized(payloadValue(payload, 'claim_state', 'claimState', 'to_state', 'toState', 'state', 'status', 'outcome')),
    findingSeverity: normalized(classificationContext.findingSeverity ?? payloadValue(payload, 'severity', 'finding_severity', 'findingSeverity')),
    challengeState: normalized(payloadValue(payload, 'challenge_state', 'challengeState', 'to_state', 'toState', 'state', 'status', 'outcome')),
    relationType: normalized(payloadValue(payload, 'relation_type', 'relationType', 'evidence_relation', 'evidenceRelation')),
    claimRevision: payloadValue(payload, 'claim_revision_id', 'claimRevisionId', 'claim_revision', 'claimRevision'),
    evidenceId: payloadValue(payload, 'evidence_id', 'evidenceId'),
    findingId: payloadValue(payload, 'finding_id', 'findingId'),
    receiptId: payloadValue(payload, 'receipt_id', 'receiptId'),
    challengeId: payloadValue(payload, 'challenge_id', 'challengeId'),
    snapshotId: payloadValue(payload, 'frontier_snapshot_id', 'frontierSnapshotId', 'snapshot_id', 'snapshotId'),
  };
}

function whatHappened(event) {
  const facts = eventFacts(event);
  const scope = event.watchedScopes[0];
  if (event.eventType.startsWith('claim.') && ['refuted', 'retracted'].includes(facts.claimState)) {
    return `Claim revision ${shortId(String(facts.claimRevision ?? scope.objectId))} entered ${facts.claimState}.`;
  }
  if (facts.findingSeverity && (event.eventType.includes('finding') || event.eventType.startsWith('verification.'))) {
    const receipt = facts.receiptId ? ` on receipt ${shortId(String(facts.receiptId))}` : '';
    return `Verification${receipt} recorded a ${facts.findingSeverity} finding.`;
  }
  if (facts.relationType === 'refutes' && event.eventType.includes('evidence')) {
    const target = facts.claimRevision ? ` on claim revision ${shortId(String(facts.claimRevision))}` : '';
    return `Evidence ${shortId(String(facts.evidenceId ?? event.eventId))} refutes${target}.`;
  }
  if (facts.challengeState && event.eventType.includes('challenge')) {
    return `Challenge ${shortId(String(facts.challengeId ?? event.eventId))} entered ${facts.challengeState}.`;
  }
  if (facts.snapshotId && event.eventType.includes('frontier')) {
    return `${facts.type} on frontier snapshot ${shortId(String(facts.snapshotId))}`;
  }
  return `${facts.type} on ${scope.objectType} ${shortId(scope.objectId)}`;
}

function eventActor(event) {
  const actorId = event.actorId ?? payloadValue(event.payload, 'actor_id', 'actorId');
  return typeof actorId === 'string' && actorId ? actorId : null;
}

function payloadIdentifiers(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const found = [];
  const seen = new Set();
  function visit(value, path = '', depth = 0) {
    if (!value || typeof value !== 'object' || depth > 2) return;
    for (const [key, entry] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      const identifierKey = /(^|_)(id|revision)$|Id$|Revision$|_ids$|Ids$/.test(key);
      if (identifierKey && (typeof entry === 'string' || typeof entry === 'number')) {
        const fingerprint = `${nextPath}:${entry}`;
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          found.push({ label: nextPath, value: String(entry) });
        }
      } else if (identifierKey && Array.isArray(entry)) {
        entry.forEach((item) => {
          if (typeof item !== 'string' && typeof item !== 'number') return;
          const fingerprint = `${nextPath}:${item}`;
          if (!seen.has(fingerprint)) {
            seen.add(fingerprint);
            found.push({ label: nextPath, value: String(item) });
          }
        });
      } else if (Array.isArray(entry)) {
        entry.forEach((item, index) => {
          if (item && typeof item === 'object') visit(item, `${nextPath}.${index}`, depth + 1);
        });
      } else if (entry && typeof entry === 'object') {
        visit(entry, nextPath, depth + 1);
      }
    }
  }
  visit(payload);
  return found;
}

function eventAuditHref(event, observationWindow) {
  const scope = event.watchedScopes[0];
  const query = new URLSearchParams({
    objectType: scope.objectType,
    objectId: scope.objectId,
    createdAfter: observationWindow.windowStart,
    createdBefore: observationWindow.asOf,
    order: 'desc',
  });
  return `/events?${query.toString()}#event-${encodeURIComponent(event.eventId)}`;
}

function ChangeEvent({ event, level, observationWindow }) {
  const href = eventAuditHref(event, observationWindow);
  const exactTime = formatDateTime(event.createdAt, observationWindow.timeZone);
  const identifiers = payloadIdentifiers(event.payload);
  return (
    <li className="ref-row" id={`change-${event.eventId}`}>
      <div>
        <StatusBadge label={level} state={level} />
      </div>
      <div className="min-w-0">
        <p className="text-[0.9375rem] font-medium leading-snug">
          <Link className="hover:underline" href={href}>{whatHappened(event)}</Link>
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{event.eventType}</span>
          {event.watchedScopes.map((scope) => (
            <span className="inline-flex items-baseline gap-1" key={`${scope.objectType}:${scope.objectId}`}>
              <span>on {scope.objectType}</span>
              <Identifier value={scope.objectId} />
            </span>
          ))}
          {eventActor(event) ? <span className="inline-flex items-baseline gap-1">recorded by <ActorName actorId={eventActor(event)} /></span> : null}
        </p>
        {identifiers.length > 0 ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Identifiers in this event</summary>
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
              {identifiers.map((identifier) => (
                <div className="contents" key={`${identifier.label}:${identifier.value}`}>
                  <dt className="font-mono text-muted-foreground">{identifier.label}</dt>
                  <dd><Identifier value={identifier.value} /></dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-baseline gap-1">Event <Identifier value={event.eventId} /></span>
        </p>
      </div>
      <time className="text-xs tabular-nums text-muted-foreground md:text-right" dateTime={event.createdAt} title={exactTime}>
        {toRelativeTime(event.createdAt)}
      </time>
    </li>
  );
}

function partialDescription(partial) {
  const notes = [];
  if (partial.omittedObjects) notes.push('Some watched objects were omitted from this bounded view');
  if (partial.failedObjects) notes.push('Some object event queries were unavailable');
  if (partial.truncatedObjects) notes.push('Some object event queries have another page');
  if (partial.invalidEvents) notes.push('Some event records lacked required provenance fields');
  if (partial.failedDetails) notes.push('Some verification or Challenge details needed for change classification were unavailable');
  if (partial.omittedDetails) notes.push('Some classification details were omitted from this bounded view');
  return `${notes.join('. ')}. Events are shown newest first; some changes may be missing from this view.`;
}

export default function HomePage() {
  const [status, setStatus] = useState('loading');
  const [events, setEvents] = useState([]);
  const [watchCount, setWatchCount] = useState(0);
  const [partial, setPartial] = useState(EMPTY_PARTIAL);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [observationWindow, setObservationWindow] = useState(null);
  const [agentConnection, setAgentConnection] = useState({ state: 'checking' });
  const [visits, setVisits] = useState([]);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const nextWindow = createObservationWindow();
    setObservationWindow(nextWindow);
    setStatus('loading');
    setError(null);
    setRequestId(null);
    setPartial(EMPTY_PARTIAL);
    setAgentConnection({ state: 'checking' });

    let interactions;
    try {
      interactions = await fetchMyInteractions(['watch']);
    } catch (reason) {
      if (generation !== loadGeneration.current) return;
      if (reason.status === 401 || reason.code === 'INTERACTION_AUTH_REQUIRED') {
        setStatus('signed-out');
        setAgentConnection({ state: 'signed-out' });
        return;
      }
      setStatus('error');
      setError(reason.message ?? 'Your private watch scope is unavailable.');
      setRequestId(reason.requestId ?? null);
      const connection = await fetchAgentConnection();
      if (generation === loadGeneration.current) setAgentConnection(connection);
      return;
    }

    const allScopes = uniqueWatchScope(interactions);
    const scopes = allScopes.slice(0, MAX_WATCHED_OBJECTS);
    const agentPromise = fetchAgentConnection();
    const settled = await Promise.allSettled(scopes.map(async (scope) => ({
      scope,
      payload: await getJson(eventsPath(scope, nextWindow)),
    })));
    if (generation !== loadGeneration.current) return;

    const successfulPages = settled.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failures = settled.filter((result) => result.status === 'rejected');
    const firstFailure = failures[0]?.reason;
    const merged = mergeEventPages(successfulPages);
    if (generation !== loadGeneration.current) return;
    const basePartial = {
      omittedObjects: Math.max(0, allScopes.length - scopes.length),
      failedObjects: failures.length,
      truncatedObjects: successfulPages.filter(({ payload }) => Boolean(payload.nextCursor)).length,
      invalidEvents: merged.invalidEvents,
      failedDetails: 0,
      omittedDetails: 0,
    };

    setWatchCount(allScopes.length);
    setAgentConnection(await agentPromise);
    if (generation !== loadGeneration.current) return;
    if (scopes.length > 0 && successfulPages.length === 0) {
      setStatus('error');
      setError(firstFailure?.message ?? 'Formal event queries are unavailable for the watched objects.');
      setRequestId(firstFailure?.requestId ?? null);
      return;
    }
    /* Critical/attention classification mostly reads event payloads already in
     * hand; per-detail hydration (up to MAX_CLASSIFICATION_DETAILS bounded
     * fetches) only refines finding severities and challenge impacts. Render
     * immediately, then refine in the background so hydration never holds the
     * first paint hostage. */
    setEvents(merged.events);
    setPartial(basePartial);
    setStatus('ready');
    try {
      const classified = await hydrateClassificationContexts(merged.events);
      if (generation !== loadGeneration.current) return;
      setEvents(classified.events);
      setPartial({ ...basePartial, failedDetails: classified.failedDetails, omittedDetails: classified.omittedDetails });
    } catch {
      /* Keep the hydrated-so-far view; the change levels stay honest from
       * event payloads alone. */
    }
  }, []);

  useEffect(() => {
    load();
    return () => { loadGeneration.current += 1; };
  }, [load]);

  useEffect(() => {
    setVisits(readVisitHistory());
    const onFocus = () => setVisits(readVisitHistory());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => { document.title = 'Home · EviMesh'; }, []);

  const grouped = useMemo(() => {
    const result = { critical: [], attention: [], update: [] };
    for (const event of events) result[classifyEvent(event)].push(event);
    return result;
  }, [events]);
  const isPartial = Object.values(partial).some(Boolean);

  return (
    <PageContainer>
      <PageHeader
        action={(
          <Link className={buttonLinkVariants({ variant: 'outline', size: 'sm' })} href="/events">Event audit</Link>
        )}
        title="Home"
      />

      <div className="doc-grid mt-8">
        <div className="doc-main">
          {status === 'loading' ? (
            <div aria-label="Loading watched research changes" className="grid gap-4">
              {[0, 1, 2].map((key) => <Skeleton className="h-24 w-full" key={key} />)}
            </div>
          ) : status === 'signed-out' ? (
            <DeniedState
              action={<Link className={buttonLinkVariants({ size: 'sm' })} href="/login">Sign in</Link>}
              actionLabel="Sign in"
              description="Watches are private to your account."
              scope="signed-in watch interactions"
              title="Sign in to load watched research"
            />
          ) : status === 'error' ? (
            <ErrorState message={error} requestId={requestId ?? undefined} onRetry={load} />
          ) : (
            <>
              {isPartial ? (
                <Alert
                  className="mb-8"
                  description={partialDescription(partial)}
                  title="Partial watch coverage"
                  variant="warning"
                />
              ) : null}

              {watchCount === 0 ? (
                <Empty
                  action={<Link className="text-primary hover:underline" href="/explore">Explore</Link>}
                  title="No watched research yet"
                />
              ) : events.length === 0 ? (
                <Empty
                  title="No changes in the last seven days"
                />
              ) : (
                <div className="grid gap-8">
                  {GROUPS.map((group) => grouped[group.level].length > 0 ? (
                    <section aria-labelledby={`changes-${group.level}-heading`} key={group.level}>
                      <SectionHeader
                        action={<span className="tabular-nums text-muted-foreground">{grouped[group.level].length}</span>}
                        id={`changes-${group.level}-heading`}
                        title={group.title}
                      />
                      <ul>
                        {grouped[group.level].map((event) => (
                          <ChangeEvent event={event} key={event.eventId} level={group.level} observationWindow={observationWindow} />
                        ))}
                      </ul>
                    </section>
                  ) : null)}
                </div>
              )}
            </>
          )}
        </div>

        <aside aria-label="Home context" className="doc-margin">
          <MarginSection title="Work">
            <Link className="text-sm text-primary hover:underline" href="/work">My work</Link>
          </MarginSection>

          <MarginSection title="Agent">
            {agentConnection.state === 'checking' ? (
              <Skeleton className="h-5 w-full" />
            ) : agentConnection.state === 'available' ? (
              <p className="text-sm">{agentConnection.activeGrantCount > 0 ? 'Connected' : 'Not connected'}</p>
            ) : agentConnection.state === 'unavailable' ? (
              <p className="text-sm text-muted-foreground">Status unavailable</p>
            ) : null}
            <Link className="mt-1 inline-block text-sm text-primary hover:underline" href="/agent">Connection center</Link>
          </MarginSection>

          <MarginSection title="Recently visited">
            {visits.length > 0 ? (
              <ul>
                {visits.map((visit) => (
                  <li key={visit.href}>
                    <Link className="flex min-w-0 items-baseline gap-2 py-1 text-sm hover:text-primary" href={visit.href}>
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">{visit.kind}</span>
                      <span className="min-w-0 truncate">{visit.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent visits</p>
            )}
          </MarginSection>
        </aside>
      </div>
    </PageContainer>
  );
}

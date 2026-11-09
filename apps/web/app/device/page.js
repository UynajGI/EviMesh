'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useBrowserSession } from '@/components/session-shell-control';
import { Button, buttonLinkVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/data';
import { Identifier, MarginSection, shortId, useActorCard } from '@/components/ui/doc';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { FieldGroup, Input } from '@/components/ui/form';
import { Breadcrumb, PageContainer, PageHeader, SectionHeader } from '@/components/ui/page';
import { Radio } from '@/components/ui/selection';
import {
  approveDeviceGrant,
  denyDeviceGrant,
  DeviceAuthorizationError,
  deviceGrantOutcome,
  fetchDeviceGrant,
  fetchManagedAgentActors,
  formatUserCode,
  isCompleteUserCode,
} from '@/lib/device-authorization.mjs';
import { FALLBACK_PUBLIC_CAPABILITIES, fetchPublicCapabilities } from '@/lib/public-capabilities';
import { cn } from '@/lib/utils';

function signInHref(code, reason = null) {
  const next = code ? `/device?user_code=${encodeURIComponent(code)}` : '/device';
  const query = new URLSearchParams({ next });
  if (reason) query.set('reason', reason);
  return `/login?${query.toString()}`;
}

function readableClient(value) {
  if (value === 'evimesh-cli') return 'EviMesh CLI';
  if (value === 'evimesh-mcp') return 'EviMesh MCP';
  return value;
}

function readableExpiry(value) {
  const timestamp = Date.parse(value ?? '');
  if (Number.isNaN(timestamp)) return 'Unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

/* Plain-language reading of each requested scope. Unknown scopes stay
 * visible as their protocol string so nothing is hidden from the approver. */
const SCOPE_MEANINGS = {
  'profile:read': 'Read your public profile and the Agent identity card.',
  'project:read': 'Read the projects this Agent is enrolled in.',
  'research:prepare': 'Prepare research drafts that wait for your local signature.',
  'research:submit': 'Relay envelopes you have already signed on your own device.',
  'artifact:upload': 'Upload artifacts that drafts can reference.',
};

function terminalContent(state) {
  switch (state) {
    case 'approved':
      return {
        label: 'Approved',
        badge: 'completed',
        title: 'Agent connection approved',
        body: 'Return to the Agent client.',
      };
    case 'denied':
      return {
        label: 'Denied',
        badge: 'rejected',
        title: 'Agent connection denied',
        body: 'No token was issued.',
      };
    case 'expired':
      return {
        label: 'Expired',
        badge: 'archived',
        title: 'This code has expired',
        body: 'Start a new connection from the Agent client.',
      };
    case 'used':
      return {
        label: 'Already used',
        badge: 'archived',
        title: 'This code is no longer active',
        body: 'A code works once. Start a new connection if this was not you.',
      };
    default:
      return null;
  }
}

function TerminalState({ state, onReset }) {
  const content = terminalContent(state);
  if (!content) return null;
  return (
    <section aria-labelledby="device-outcome-heading" aria-live="polite">
      <SectionHeader action={<StatusBadge label={content.label} state={content.badge} />} id="device-outcome-heading" title={content.title} />
      <p className="mt-2 max-w-[60ch] text-sm leading-6">{content.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button onClick={onReset} size="sm" variant="outline">Review another code</Button>
        <Link className="text-sm text-primary hover:underline" href="/agent">Agent access</Link>
      </div>
    </section>
  );
}

function BoundaryNotes() {
  return (
    <aside aria-label="Authorization boundary" className="doc-margin">
      <MarginSection title="Code">
        <p className="text-[13px] leading-5">Shown by your MCP client or <code className="font-mono text-xs">sq auth login</code>. Enter only a code you started.</p>
      </MarginSection>
      <MarginSection title="Related">
        <ul className="grid gap-1 text-[13px]">
          <li><Link className="text-primary hover:underline" href="/settings/tokens">Agent tokens</Link></li>
          <li><Link className="text-primary hover:underline" href="/agents">My Agents</Link></li>
        </ul>
      </MarginSection>
    </aside>
  );
}

function AgentChoice({ agent, checked, onSelect }) {
  const card = useActorCard(agent.actorId);
  return (
    <li className="border-b border-border">
      <label className={cn('grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3 py-2.5 pl-2 pr-2 hover:bg-muted/50', checked ? 'bg-muted/50' : null)}>
        <Radio checked={checked} className="mt-1" name="agent-actor" onChange={onSelect} value={agent.actorId} />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{card?.displayName ?? agent.modelName ?? 'Managed Agent'}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span className="font-mono" title={agent.actorId}>{shortId(agent.actorId)}</span>
            {agent.modelName ? <span>{agent.modelName}</span> : null}
            {agent.runtime ? <span>{String(agent.runtime).replaceAll('_', ' ')}</span> : null}
          </span>
        </span>
      </label>
    </li>
  );
}

export default function DeviceAuthorizationPage() {
  const sessionState = useBrowserSession();
  const [capabilities, setCapabilities] = useState(null);
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [view, setView] = useState('entry');
  const [grant, setGrant] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [actionError, setActionError] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [requestError, setRequestError] = useState(null);
  const initialCodeRef = useRef('');
  const autoLookupRef = useRef(false);
  const effectiveCapabilities = capabilities ?? FALLBACK_PUBLIC_CAPABILITIES;
  const deviceAuthorizationAvailable = effectiveCapabilities.deviceAuthorization.enabled === true;

  useEffect(() => {
    let cancelled = false;
    fetchPublicCapabilities().then((value) => {
      if (!cancelled) setCapabilities(value);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const initialCode = formatUserCode(new URLSearchParams(window.location.search).get('user_code'));
    initialCodeRef.current = initialCode;
    if (initialCode) setCode(initialCode);
  }, []);

  useEffect(() => {
    const initialCode = initialCodeRef.current;
    if (
      autoLookupRef.current
      || capabilities === null
      || !deviceAuthorizationAvailable
      || sessionState.status !== 'authenticated'
      || !isCompleteUserCode(initialCode)
    ) return;
    autoLookupRef.current = true;
    void loadGrant(initialCode);
  }, [capabilities, deviceAuthorizationAvailable, sessionState.status]);

  function reset() {
    setCode('');
    setFieldError(null);
    setView('entry');
    setGrant(null);
    setAgents([]);
    setSelectedAgentId('');
    setActionError(null);
    setRequestError(null);
    window.history.replaceState({}, '', '/device');
  }

  function applyFailure(error, { keepPreview = false } = {}) {
    const outcome = deviceGrantOutcome(error);
    if (['expired', 'used', 'denied'].includes(outcome)) {
      setView(outcome);
      return;
    }
    if (outcome === 'session') {
      setView('session');
      return;
    }
    if (outcome === 'permission') {
      setRequestError(error);
      setView('permission');
      return;
    }
    if (error?.status === 404) {
      setFieldError('Code not found or no longer available.');
      setView('entry');
      return;
    }
    if (keepPreview) {
      setActionError(error);
      return;
    }
    setRequestError(error);
    setView('error');
  }

  async function loadGrant(value = code) {
    const normalized = formatUserCode(value);
    setCode(normalized);
    setFieldError(null);
    setActionError(null);
    setRequestError(null);
    if (!isCompleteUserCode(normalized)) {
      setFieldError('Enter all eight characters.');
      setView('entry');
      return;
    }
    if (!deviceAuthorizationAvailable || sessionState.status !== 'authenticated') return;

    setView('loading');
    setGrant(null);
    setAgents([]);
    setSelectedAgentId('');
    const options = { accessToken: sessionState.session.access_token };
    try {
      const preview = await fetchDeviceGrant(normalized, options);
      if (Date.parse(preview.expiresAt) <= Date.now()) {
        setView('expired');
        return;
      }
      setGrant(preview);
      window.history.replaceState({}, '', `/device?user_code=${encodeURIComponent(normalized)}`);
      const managedAgents = await fetchManagedAgentActors(options);
      setAgents(managedAgents);
      setView(managedAgents.length === 0 ? 'no-agents' : 'preview');
    } catch (error) {
      applyFailure(error);
    }
  }

  async function approve() {
    setFieldError(null);
    setActionError(null);
    if (!selectedAgentId) {
      setFieldError('Choose an Agent.');
      return;
    }
    setPendingAction('approve');
    try {
      const result = await approveDeviceGrant({ userCode: code, agentActorId: selectedAgentId }, {
        accessToken: sessionState.session?.access_token,
      });
      if (result?.status !== 'approved' || result.agent_actor_id !== selectedAgentId) {
        throw new DeviceAuthorizationError({
          message: 'The authorization service returned an invalid approval result.',
          status: 502,
          code: 'DEVICE_AUTH_APPROVAL_INVALID',
        });
      }
      setView('approved');
    } catch (error) {
      applyFailure(error, { keepPreview: true });
    } finally {
      setPendingAction(null);
    }
  }

  async function deny() {
    setActionError(null);
    setPendingAction('deny');
    try {
      const result = await denyDeviceGrant(code, { accessToken: sessionState.session?.access_token });
      if (result?.status !== 'denied') {
        throw new DeviceAuthorizationError({
          message: 'The authorization service returned an invalid denial result.',
          status: 502,
          code: 'DEVICE_AUTH_DENIAL_INVALID',
        });
      }
      setView('denied');
    } catch (error) {
      applyFailure(error, { keepPreview: true });
    } finally {
      setPendingAction(null);
    }
  }

  const title = capabilities === null
    ? 'Device access'
    : deviceAuthorizationAvailable
      ? 'Device access'
      : 'Device access unavailable';

  let content;
  if (capabilities === null) {
    content = <div aria-label="Checking device authorization availability" aria-busy="true"><Skeleton className="h-11 w-full max-w-xl" /><Skeleton className="mt-6 h-52 w-full" /></div>;
  } else if (!deviceAuthorizationAvailable) {
    content = (
      <section aria-labelledby="device-closed-heading">
        <SectionHeader id="device-closed-heading" title="Device authorization is closed" />
        <Link className="mt-3 inline-block text-sm text-primary hover:underline" href="/agent">Agent availability</Link>
      </section>
    );
  } else if (sessionState.status === 'loading') {
    content = <div aria-label="Checking browser session" aria-busy="true"><Skeleton className="h-11 w-full max-w-xl" /><Skeleton className="mt-6 h-52 w-full" /></div>;
  } else if (sessionState.status === 'anonymous' || sessionState.status === 'expired' || view === 'session') {
    const expired = sessionState.status === 'expired' || view === 'session';
    content = (
      <section aria-labelledby="device-signin-heading">
        <SectionHeader id="device-signin-heading" title={expired ? 'Sign in again to continue' : 'Sign in to review this request'} />
        <Link className={cn(buttonLinkVariants(), 'mt-4')} href={signInHref(code, expired ? 'expired' : null)}>Sign in</Link>
      </section>
    );
  } else if (sessionState.status === 'error') {
    content = <ErrorState message={sessionState.error} title="Browser session unavailable" />;
  } else if (view === 'loading') {
    content = <div aria-label="Loading Agent connection request" aria-busy="true"><Skeleton className="h-14 w-full" /><Skeleton className="mt-6 h-28 w-full" /><Skeleton className="mt-6 h-44 w-full" /></div>;
  } else if (['approved', 'denied', 'expired', 'used'].includes(view)) {
    content = <TerminalState onReset={reset} state={view} />;
  } else if (view === 'permission') {
    content = (
      <section aria-labelledby="device-permission-heading" role="alert">
        <SectionHeader id="device-permission-heading" title="This account cannot approve the request" />
        <p className="mt-2 max-w-[60ch] text-sm leading-6">Only the owner of an active Agent can approve.</p>
        {requestError?.requestId ? <p className="mt-3 font-mono text-xs text-muted-foreground">request id: {requestError.requestId}</p> : null}
        <Link className="mt-3 inline-block text-sm text-primary hover:underline" href="/agent">Agent access</Link>
      </section>
    );
  } else if (view === 'error') {
    content = <ErrorState message={requestError?.message ?? 'The connection request is unavailable.'} onRetry={() => loadGrant()} requestId={requestError?.requestId} title="Connection request unavailable" />;
  } else {
    const previewReady = view === 'preview' || view === 'no-agents';
    content = (
      <div className="grid gap-8">
        <section aria-labelledby="device-code-heading">
          <SectionHeader id="device-code-heading" title="1. Enter the connection code" />
          <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void loadGrant(); }}>
            <FieldGroup error={fieldError} help="Eight characters." htmlFor="device-user-code" label="Connection code">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  className="h-11 font-mono text-base uppercase tracking-[0.16em] sm:max-w-sm"
                  disabled={pendingAction !== null}
                  id="device-user-code"
                  inputMode="text"
                  maxLength={9}
                  onChange={(event) => {
                    setCode(formatUserCode(event.target.value));
                    setFieldError(null);
                    if (previewReady) {
                      setView('entry');
                      setGrant(null);
                      setAgents([]);
                      setSelectedAgentId('');
                    }
                  }}
                  placeholder="ABCD-EFGH"
                  spellCheck="false"
                  value={code}
                />
                <Button className="min-h-11 whitespace-nowrap sm:px-6" disabled={!isCompleteUserCode(code) || pendingAction !== null} type="submit">Review request</Button>
              </div>
            </FieldGroup>
          </form>
        </section>

        {grant ? (
          <section aria-labelledby="request-details-heading">
            <SectionHeader action={<StatusBadge label="Pending request" state="open" />} id="request-details-heading" title="2. Check what is requested" />
            <dl className="text-sm">
              <div className="grid gap-x-6 gap-y-1 border-b border-border py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Client</dt>
                <dd>
                  <span className="font-medium">{readableClient(grant.clientId)}</span>
                  <span className="ml-2 break-all font-mono text-xs text-muted-foreground">{grant.clientId}</span>
                </dd>
              </div>
              <div className="grid gap-x-6 gap-y-1 border-b border-border py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Expires</dt>
                <dd className="tabular-nums"><time dateTime={grant.expiresAt}>{readableExpiry(grant.expiresAt)}</time></dd>
              </div>
              <div className="grid gap-x-6 gap-y-1 border-b border-border py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Scopes the Agent receives</dt>
                <dd>
                  <ul className="grid gap-2">
                    {grant.requestedScopes.map((scope) => (
                      <li className="grid gap-x-4 sm:grid-cols-[10rem_minmax(0,1fr)]" key={scope}>
                        <code className="font-mono text-xs text-foreground">{scope}</code>
                        <span className="text-muted-foreground">{SCOPE_MEANINGS[scope] ?? 'Protocol scope as requested by the client.'}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="grid gap-x-6 gap-y-1 border-b border-border py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Never included</dt>
                <dd>Signing. Human signing keys stay on the local device.</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {view === 'no-agents' ? (
          <section aria-labelledby="device-no-agents-heading" role="alert">
            <SectionHeader id="device-no-agents-heading" title="No Agent to receive the token" />
            <Link className={cn(buttonLinkVariants({ size: 'sm' }), 'mt-3')} href={`/agents?returnTo=${encodeURIComponent(typeof window === 'undefined' ? '/device' : window.location.pathname + window.location.search)}`}>Create an Agent</Link>
          </section>
        ) : null}

        {view === 'preview' ? (
          <section aria-labelledby="agent-selection-heading">
            <SectionHeader id="agent-selection-heading" title="3. Choose the receiving Agent" />
            <fieldset>
              <legend className="sr-only">Managed Agent actors</legend>
              <ul>
                {agents.map((agent) => (
                  <AgentChoice
                    agent={agent}
                    checked={selectedAgentId === agent.actorId}
                    key={agent.actorId}
                    onSelect={() => { setSelectedAgentId(agent.actorId); setFieldError(null); }}
                  />
                ))}
              </ul>
            </fieldset>

            {selectedAgentId ? (
              <div className="mt-4" id="device-approval-boundary">
                <p className="flex flex-wrap items-baseline gap-1.5 text-sm">Token recipient: <Identifier value={selectedAgentId} /><span className="text-muted-foreground">(no signing)</span></p>
              </div>
            ) : null}

            {actionError ? (
              <div className="mt-5 rounded-[2px] border border-status-danger-border bg-status-danger-bg px-4 py-3 text-sm text-status-danger-fg" role="alert">
                <p className="font-medium">The decision was not recorded.</p>
                <p className="mt-1">{actionError.message}</p>
                {actionError.requestId ? <p className="mt-2 font-mono text-xs">request id: {actionError.requestId}</p> : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <Button aria-describedby="device-approval-boundary" className="whitespace-nowrap" disabled={!selectedAgentId || pendingAction !== null} loading={pendingAction === 'approve'} onClick={() => void approve()}>
                Approve Agent
              </Button>
              <Button disabled={pendingAction !== null} loading={pendingAction === 'deny'} onClick={() => void deny()} variant="outline">Deny request</Button>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <PageContainer>
      <Breadcrumb trail={[{ label: 'Account', href: '/settings' }, { label: 'Device access' }]} />
      <PageHeader title={title} />
      <div className="doc-grid mt-6">
        <div className="doc-main">{content}</div>
        <BoundaryNotes />
      </div>
    </PageContainer>
  );
}

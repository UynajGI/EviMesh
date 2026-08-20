'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Empty } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';

/*
 * Notification center (M13.8 07-emerging-ui-spec.md §3). The backend watch /
 * digest system does not exist yet, so this route ships its honest empty
 * state now: subscription-driven, no algorithmic feed, no unread anxiety.
 */
export default function NotificationsPage() {
  const [tab, setTab] = useState('inbox');
  return (
    <PageContainer>
      <PageHeader
        description="Notifications will explain why you received them: what you follow, what changed. Levels express attention priority, never a verdict."
        eyebrow="Notifications"
        title="Inbox"
      />
      <div className="mt-4 flex gap-1 border-b border-border" role="tablist" aria-label="Notification views">
        {[['inbox', 'Inbox'], ['done', 'Processed']].map(([id, label]) => (
          <button
            aria-selected={tab === id}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'inbox' ? (
        <Empty
          action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/explore">Discover research to follow</Link>}
          className="mt-8"
          description="Watchlists and per-object subscriptions arrive with the notification system. Quiet objects will never ping; critical changes will always surface here and by email."
          title="No notifications yet"
        />
      ) : (
        <Empty
          className="mt-8"
          description="Processed notifications stay here for 30 days; the underlying events remain reachable from each object's activity view."
          title="Processed notifications appear here"
        />
      )}
      <p className="mt-4 text-sm text-muted-foreground">
        Until then, the Home page shows live activity across open research, and every object page links its signed event history.
      </p>
    </PageContainer>
  );
}

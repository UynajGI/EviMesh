'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Empty } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';

const TABS = [['inbox', 'Inbox'], ['done', 'Processed']];

/*
 * Notification center (M13.8 07-emerging-ui-spec.md §3). The backend watch /
 * digest system does not exist yet, so this route ships its honest empty
 * state now: subscription-driven, no algorithmic feed, no unread anxiety.
 */
export default function NotificationsPage() {
  const [tab, setTab] = useState('inbox');
  return (
    <PageContainer>
      <PageHeader title="Inbox" />
      <div className="mt-4 flex gap-1 border-b border-border" role="tablist" aria-label="Notification views">
        {TABS.map(([id, label]) => (
          <button
            aria-controls={`notifications-panel-${id}`}
            aria-selected={tab === id}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            id={`notifications-tab-${id}`}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <section
        aria-labelledby={`notifications-tab-${tab}`}
        className="mt-6"
        id={`notifications-panel-${tab}`}
        role="tabpanel"
        tabIndex={0}
      >
        {tab === 'inbox' ? (
          <Empty
            action={<Link className="text-primary hover:underline" href="/explore">Explore</Link>}
            title="No notifications yet"
          />
        ) : (
          <Empty title="Nothing processed" />
        )}
      </section>
    </PageContainer>
  );
}

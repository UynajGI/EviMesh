import Link from 'next/link';
import { Empty } from '@/components/ui/feedback';
import { PageContainer, PageHeader } from '@/components/ui/page';

/*
 * Notification center (M13.8 07-emerging-ui-spec.md §3). The backend watch /
 * digest system does not exist yet, so this route ships its honest empty
 * state now: subscription-driven, no algorithmic feed, no unread anxiety.
 */
export default function NotificationsPage() {
  return (
    <PageContainer>
      <PageHeader
        description="Notifications will explain why you received them: what you follow, what changed. Levels express attention priority, never a verdict."
        eyebrow="Notifications"
        title="Inbox"
      />
      <Empty
        action={<Link className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground" href="/explore">Discover research to follow</Link>}
        className="mt-8"
        description="Watchlists and per-object subscriptions arrive with the notification system. Quiet objects will never ping; critical changes will always surface here and by email."
        title="No notifications yet"
      />
      <p className="mt-4 text-sm text-muted-foreground">
        Until then, the Home page shows live activity across open research, and every object page links its signed event history.
      </p>
    </PageContainer>
  );
}

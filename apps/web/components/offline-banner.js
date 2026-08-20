'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/*
 * Offline banner (design book 08 §1.1): a top warning strip when the browser
 * goes offline, stating that the page shows the last successfully loaded
 * data. Disappears automatically when connectivity returns.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    function goOffline() { setOffline(true); }
    function goOnline() { setOffline(false); }
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="border-b border-status-warning-border bg-status-warning-bg px-6 py-2 text-status-warning-fg" role="status">
      <p className="mx-auto flex max-w-6xl items-center gap-2 text-sm">
        <WifiOff aria-hidden="true" size={14} />
        You are offline. This page shows the most recently loaded data; writes will ask you to retry once connectivity returns.
      </p>
    </div>
  );
}

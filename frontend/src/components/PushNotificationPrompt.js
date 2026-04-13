/**
 * PushNotificationPrompt — Inline banner to enable push notifications.
 *
 * Shows when:
 * - Push is supported (browser + service worker + PushManager)
 * - User hasn't subscribed yet
 * - User hasn't dismissed the prompt
 *
 * Place this in Layout.js or on the Dashboard page.
 */
import { useState, useEffect } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import { Button } from './ui/button';
import { usePushNotifications } from '../hooks/usePushNotifications';

const DISMISS_KEY = 'redops_push_prompt_dismissed';

export default function PushNotificationPrompt() {
  const { isSupported, permission, isSubscribed, loading, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISS_KEY);
    if (wasDismissed) setDismissed(true);
  }, []);

  // Don't render if: not supported, already subscribed, denied, or dismissed
  if (!isSupported || isSubscribed || permission === 'denied' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    const result = await subscribe();
    if (result) {
      setSuccess(true);
      setTimeout(() => setDismissed(true), 2000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  if (success) {
    return (
      <div className="mx-4 mb-4 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
        <BellRing className="h-4 w-4 shrink-0" />
        <span>Push notifications enabled. You'll get alerts on this device.</span>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-4 py-3">
      <div className="flex items-center gap-3 text-sm">
        <Bell className="h-4 w-4 shrink-0 text-red-400" />
        <span className="text-zinc-300">
          Get notified when something needs your attention — even when RED OPS is closed.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={handleEnable}
          disabled={loading}
          className="text-xs"
        >
          {loading ? 'Enabling...' : 'Enable'}
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

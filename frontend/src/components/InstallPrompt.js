/**
 * InstallPrompt — branded "Add to Home Screen" banner.
 *
 * Android/Chrome: listens for `beforeinstallprompt`, stashes it, shows a banner
 * with Install + Not now. Install triggers the browser's native sheet via
 * `promptEvent.prompt()`. Not now hides the banner for 30 days.
 *
 * iOS: `beforeinstallprompt` never fires. If we detect iOS Safari in a non-
 * standalone window, show a different banner with the "Share → Add to Home
 * Screen" instructions since there's no programmatic install API.
 */
import { useEffect, useState } from 'react';
import { Share as ShareIcon, X, Download } from 'lucide-react';

const DISMISS_KEY = 'pwa_install_dismissed_until';
const DISMISS_DAYS = 30;

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isDismissed() {
  const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return until > Date.now();
}

function snoozeDismissal() {
  const ms = DISMISS_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(DISMISS_KEY, String(Date.now() + ms));
}

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState(null); // 'chromium' | 'ios'

  useEffect(() => {
    if (isStandalone()) return; // already installed — nothing to do
    if (isDismissed()) return;

    // Chromium path
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setPromptEvent(e);
      setMode('chromium');
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS path — no event to wait for, just show after a short delay
    let iosTimer = null;
    if (isIos()) {
      iosTimer = setTimeout(() => {
        setMode('ios');
        setVisible(true);
      }, 1500);
    }

    // Hide ourselves once the app is actually installed
    const onInstalled = () => {
      setVisible(false);
      setPromptEvent(null);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } catch { /* ignore */ }
    setVisible(false);
    setPromptEvent(null);
  };

  const handleDismiss = () => {
    snoozeDismissal();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install RED-OPS"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: `calc(12px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 9000,
        maxWidth: 440,
        margin: '0 auto',
        padding: '14px 14px 12px',
        background: 'var(--surface, #12141a)',
        border: '1px solid var(--border, rgba(255,255,255,0.1))',
        borderRadius: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        color: 'var(--tx-1, #f1f3f5)',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--tx-3, #6b7280)', padding: 4, display: 'flex',
        }}
      >
        <X size={14} />
      </button>

      {mode === 'chromium' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent, #8B1538)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 15, flexShrink: 0,
            }}>R</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>Install RED-OPS</div>
              <div style={{ fontSize: 12, color: 'var(--tx-2, #a0a0a0)' }}>
                Faster launches, full-screen, no browser bar.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 10,
                background: 'var(--accent, #8B1538)', color: '#fff',
                border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Download size={14} /> Install
            </button>
            <button
              onClick={handleDismiss}
              style={{
                padding: '9px 12px', borderRadius: 10,
                background: 'var(--surface-2, #1a1c24)', color: 'var(--tx-2, #a0a0a0)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              Not now
            </button>
          </div>
        </>
      )}

      {mode === 'ios' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent, #8B1538)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 15, flexShrink: 0,
            }}>R</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>Install RED-OPS</div>
              <div style={{ fontSize: 12, color: 'var(--tx-2, #a0a0a0)' }}>
                Add to your Home Screen for the full app experience.
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8,
            background: 'var(--surface-2, #1a1c24)',
            fontSize: 12, color: 'var(--tx-2, #a0a0a0)',
          }}>
            Tap
            <ShareIcon size={14} style={{ color: '#3b82f6' }} />
            then <strong style={{ color: 'var(--tx-1, #f1f3f5)' }}>Add to Home Screen</strong>
          </div>
        </>
      )}
    </div>
  );
}

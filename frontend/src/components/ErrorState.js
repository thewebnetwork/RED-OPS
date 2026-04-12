/**
 * ErrorState — shared error UI with retry button for failed fetches.
 *
 * Usage:
 *   {error ? <ErrorState message={error} onRetry={refetch} /> : <Content />}
 *
 * Pass optional `compact` for inline/small contexts.
 */
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function ErrorState({ message = 'Something went wrong', onRetry, compact = false }) {
  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'var(--color-red-soft)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 8, fontSize: 12, color: 'var(--tx-2)',
      }}>
        <AlertCircle size={14} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{message}</span>
        {onRetry && (
          <button onClick={onRetry} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
            background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--tx-1)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            <RefreshCw size={11} /> Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="anim-fade-up" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--color-red-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        <AlertCircle size={26} style={{ color: 'var(--color-red)' }} />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)', margin: '0 0 6px' }}>
        Something went wrong
      </h3>
      <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 16px', maxWidth: 320 }}>
        {message}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary btn-sm" style={{ gap: 6 }}>
          <RefreshCw size={13} /> Try Again
        </button>
      )}
    </div>
  );
}

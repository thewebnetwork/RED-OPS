/**
 * EmptyState — polished empty/zero state with abstract SVG illustration.
 *
 * Usage:
 *   <EmptyState
 *     icon="inbox"          — inbox | tasks | projects | files | chat | search
 *     title="No requests yet"
 *     description="Submit your first request to get started."
 *     action={{ label: 'New Request', onClick: () => navigate('/services') }}
 *   />
 */

const ILLUSTRATIONS = {
  inbox: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="12" y="24" width="56" height="40" rx="6" stroke="var(--border-hi)" strokeWidth="1.5" fill="var(--bg-elevated)" />
      <path d="M12 40h20l4 8h8l4-8h20" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <circle cx="40" cy="48" r="4" fill="var(--accent)" opacity="0.3" />
    </svg>
  ),
  tasks: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="18" y="18" width="44" height="44" rx="8" stroke="var(--border-hi)" strokeWidth="1.5" fill="var(--bg-elevated)" />
      <path d="M30 38l6 6 14-14" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <line x1="30" y1="52" x2="50" y2="52" stroke="var(--border-hi)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  projects: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="14" y="20" width="52" height="42" rx="6" stroke="var(--border-hi)" strokeWidth="1.5" fill="var(--bg-elevated)" />
      <rect x="14" y="20" width="52" height="10" rx="6" fill="var(--accent)" opacity="0.12" />
      <circle cx="22" cy="25" r="2" fill="var(--accent)" opacity="0.5" />
      <circle cx="28" cy="25" r="2" fill="var(--accent)" opacity="0.3" />
      <circle cx="34" cy="25" r="2" fill="var(--accent)" opacity="0.15" />
      <line x1="22" y1="38" x2="58" y2="38" stroke="var(--border-hi)" strokeWidth="1" opacity="0.3" />
      <line x1="22" y1="45" x2="48" y2="45" stroke="var(--border-hi)" strokeWidth="1" opacity="0.3" />
      <line x1="22" y1="52" x2="40" y2="52" stroke="var(--border-hi)" strokeWidth="1" opacity="0.3" />
    </svg>
  ),
  files: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path d="M24 18h20l4 4h12a4 4 0 014 4v32a4 4 0 01-4 4H24a4 4 0 01-4-4V22a4 4 0 014-4z" stroke="var(--border-hi)" strokeWidth="1.5" fill="var(--bg-elevated)" />
      <path d="M20 30h40" stroke="var(--border-hi)" strokeWidth="1" opacity="0.3" />
      <circle cx="40" cy="44" r="8" stroke="var(--accent)" strokeWidth="1.5" opacity="0.4" fill="none" />
      <path d="M40 40v8M36 44h8" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  chat: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="14" y="16" width="40" height="30" rx="8" stroke="var(--border-hi)" strokeWidth="1.5" fill="var(--bg-elevated)" />
      <path d="M22 50l-4 10 10-6" stroke="var(--border-hi)" strokeWidth="1.5" strokeLinejoin="round" fill="var(--bg-elevated)" />
      <rect x="30" y="30" width="36" height="24" rx="8" stroke="var(--accent)" strokeWidth="1.5" fill="var(--bg-elevated)" opacity="0.5" />
      <line x1="22" y1="28" x2="46" y2="28" stroke="var(--border-hi)" strokeWidth="1" opacity="0.3" />
      <line x1="22" y1="34" x2="38" y2="34" stroke="var(--border-hi)" strokeWidth="1" opacity="0.3" />
    </svg>
  ),
  search: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="36" cy="36" r="16" stroke="var(--border-hi)" strokeWidth="1.5" fill="var(--bg-elevated)" />
      <line x1="48" y1="48" x2="60" y2="60" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="28" y1="36" x2="44" y2="36" stroke="var(--border-hi)" strokeWidth="1" opacity="0.3" />
      <line x1="32" y1="30" x2="40" y2="30" stroke="var(--border-hi)" strokeWidth="1" opacity="0.2" />
    </svg>
  ),
};

export default function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="anim-fade-up" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: 16, opacity: 0.7 }}>
        {ILLUSTRATIONS[icon] || ILLUSTRATIONS.inbox}
      </div>
      {title && (
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)', margin: '0 0 6px' }}>
          {title}
        </h3>
      )}
      {description && (
        <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 16px', maxWidth: 280 }}>
          {description}
        </p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary btn-sm" style={{ gap: 6 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

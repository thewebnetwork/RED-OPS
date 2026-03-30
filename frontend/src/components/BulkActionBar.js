/**
 * BulkActionBar — floating action bar shown when items are selected
 */
export default function BulkActionBar({ count, actions, onClear }) {
  if (count === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 500,
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
      borderRadius: 16, background: 'var(--tx-1)', color: 'var(--surface)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{count} selected</span>
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
      {actions.map((action, i) => (
        <button key={i} onClick={action.onClick}
          style={{
            fontSize: 13, fontWeight: 500, padding: '4px 10px', borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: action.danger ? '#ef4444' : '#fff',
            transition: 'background .1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = action.danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          {action.label}
        </button>
      ))}
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
      <button onClick={onClear} style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>
        ✕
      </button>
    </div>
  );
}

/**
 * Skeleton loading components — shimmer placeholders for content loading states.
 * Use instead of spinners for a smoother perceived loading experience.
 */

export function SkeletonLine({ width = '100%', height = 12, style = {} }) {
  return (
    <div className="skeleton-pulse" style={{ width, height, borderRadius: 4, ...style }} />
  );
}

export function SkeletonCircle({ size = 32, style = {} }) {
  return (
    <div className="skeleton-pulse" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style }} />
  );
}

export function SkeletonCard({ style = {} }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, ...style }}>
      <SkeletonLine width="60%" height={14} style={{ marginBottom: 12 }} />
      <SkeletonLine width="40%" height={10} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        <SkeletonLine width={60} height={28} style={{ borderRadius: 6 }} />
        <SkeletonLine width={60} height={28} style={{ borderRadius: 6 }} />
        <SkeletonLine width={60} height={28} style={{ borderRadius: 6 }} />
      </div>
    </div>
  );
}

export function SkeletonRow({ columns = 5, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--border)', ...style }}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonLine key={i} width={i === 0 ? '30%' : `${15 + Math.random() * 10}%`} height={12} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonLine key={i} width={`${12 + Math.random() * 8}%`} height={10} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} />
      ))}
    </div>
  );
}

export function SkeletonKPI({ count = 4 }) {
  return (
    <div className="metrics-grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`stagger-${i + 1}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <SkeletonLine width={32} height={32} style={{ borderRadius: 8, marginBottom: 12 }} />
          <SkeletonLine width="40%" height={24} style={{ marginBottom: 6 }} />
          <SkeletonLine width="60%" height={10} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCardList({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`stagger-${Math.min(i + 1, 6)}`} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
        }}>
          <SkeletonCircle size={28} />
          <div style={{ flex: 1 }}>
            <SkeletonLine width="55%" height={12} style={{ marginBottom: 6 }} />
            <SkeletonLine width="35%" height={8} />
          </div>
          <SkeletonLine width={60} height={20} style={{ borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="page-content" style={{ animation: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <SkeletonLine width={200} height={22} style={{ marginBottom: 8 }} />
          <SkeletonLine width={140} height={12} />
        </div>
        <SkeletonLine width={100} height={34} style={{ borderRadius: 8 }} />
      </div>
      <SkeletonKPI />
      <div style={{ marginTop: 20 }}>
        <SkeletonTable />
      </div>
    </div>
  );
}

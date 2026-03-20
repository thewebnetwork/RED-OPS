import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Plus, TrendingUp, AlertTriangle, CheckCircle2, Loader2, ChevronRight, DollarSign, Clock, Star, X, RefreshCw } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const get = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok ? r.json() : null);

// ── Health Score engine ──
function computeHealth(client, orders = []) {
  let score = 100;
  const now = new Date();

  // Days since last delivery
  if (client.last_delivery_date) {
    const days = Math.floor((now - new Date(client.last_delivery_date)) / 86400000);
    if (days > 30) score -= 20;
    else if (days > 14) score -= 10;
  } else {
    score -= 15;
  }

  // Open requests vs plan capacity
  const clientOrders = orders.filter(o => o.requester_id === client.id && !['closed', 'delivered'].includes(o.status));
  if (clientOrders.length > 5) score -= 15;

  // Satisfaction rating
  if (client.satisfaction_avg) {
    if (client.satisfaction_avg < 3) score -= 20;
    else if (client.satisfaction_avg < 4) score -= 10;
  }

  // Renewal proximity
  if (client.renewal_date) {
    const daysToRenew = Math.ceil((new Date(client.renewal_date) - now) / 86400000);
    if (daysToRenew < 0) score -= 25;
    else if (daysToRenew < 14) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function HealthScore({ score }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'Watch' : 'At Risk';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: color + '18', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>
        {score}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function ClientCard({ client, orders, onClick }) {
  const health = computeHealth(client, orders);
  const color = health >= 70 ? '#10b981' : health >= 40 ? '#f59e0b' : '#ef4444';
  const clientOrders = orders.filter(o => o.requester_id === client.id);
  const openOrders = clientOrders.filter(o => !['closed', 'delivered'].includes(o.status)).length;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
        borderRadius: 12, padding: '16px', cursor: 'pointer',
        transition: 'all .15s', position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Health bar accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '12px 12px 0 0', opacity: .6 }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>
          {(client.name || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
          <div style={{ fontSize: 11.5, color: 'hsl(var(--text-3))', marginTop: 1 }}>{client.email}</div>
        </div>
        <HealthScore score={health} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'MRR', value: client.mrr ? `$${client.mrr}` : '—' },
          { label: 'Open', value: openOrders },
          { label: 'Plan', value: client.plan || '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '7px 8px', background: 'hsl(var(--surface-2))', borderRadius: 7, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-1))' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-3))', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {client.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {client.tags.map(tag => {
            const tagColors = { 'At Risk': '#ef4444', 'VIP': '#f59e0b', 'New': '#3b82f6', 'Paused': '#6b7280' };
            const tc = tagColors[tag] || '#6b7280';
            return <span key={tag} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: tc + '20', color: tc }}>{tag}</span>;
          })}
        </div>
      )}

      {client.renewal_date && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'hsl(var(--text-3))', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} />
          Renews {new Date(client.renewal_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
        </div>
      )}
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | at_risk | healthy | watch
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, ordersRes] = await Promise.all([
        get('/users?account_type=Media+Client&limit=100'),
        get('/orders?limit=200'),
      ]);
      const cl = usersRes?.users || (Array.isArray(usersRes) ? usersRes : []);
      setClients(cl);
      const ord = ordersRes?.orders || (Array.isArray(ordersRes) ? ordersRes : []);
      setOrders(ord);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter(c => {
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase()) && !c.email?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter !== 'all') {
      const h = computeHealth(c, orders);
      if (filter === 'healthy' && h < 70) return false;
      if (filter === 'watch' && (h < 40 || h >= 70)) return false;
      if (filter === 'at_risk' && h >= 40) return false;
    }
    return true;
  });

  // Summary stats
  const withHealth = clients.map(c => ({ ...c, _h: computeHealth(c, orders) }));
  const healthy = withHealth.filter(c => c._h >= 70).length;
  const watch = withHealth.filter(c => c._h >= 40 && c._h < 70).length;
  const atRisk = withHealth.filter(c => c._h < 40).length;

  return (
    <div className="page-content" style={{ animation: 'fadeInUp .3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-1))', letterSpacing: '-.02em' }}>Clients</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'hsl(var(--text-3))' }}>{clients.length} accounts · health-scored</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-3))', pointerEvents: 'none' }} />
          <input className="input-field" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28, width: 200, height: 34, fontSize: 12 }} />
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 7, cursor: 'pointer', color: 'hsl(var(--text-3))', fontSize: 12 }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      {/* Health summary */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: `All ${clients.length}`, color: '#6b7280' },
          { key: 'healthy', label: `🟢 Healthy ${healthy}`, color: '#10b981' },
          { key: 'watch', label: `🟡 Watch ${watch}`, color: '#f59e0b' },
          { key: 'at_risk', label: `🔴 At Risk ${atRisk}`, color: '#ef4444' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '6px 14px', borderRadius: 7, border: `1px solid ${filter === key ? color : 'hsl(var(--border))'}`,
              background: filter === key ? color + '15' : 'transparent',
              cursor: 'pointer', fontSize: 12, fontWeight: filter === key ? 700 : 500,
              color: filter === key ? color : 'hsl(var(--text-3))', transition: 'all .15s',
            }}
          >{label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={24} style={{ color: 'hsl(var(--primary))', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-3))' }}>
          <Users size={40} style={{ opacity: .2, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--text-2))' }}>
            {clients.length === 0 ? 'No clients yet' : 'No clients match this filter'}
          </div>
          {clients.length === 0 && (
            <div style={{ fontSize: 13, marginTop: 4 }}>Add client accounts in Settings → Users with account type "Media Client"</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(client => (
            <ClientCard key={client.id} client={client} orders={orders} onClick={() => setSelected(client)} />
          ))}
        </div>
      )}

      {/* Client Detail Panel */}
      {selected && (
        <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 380, background: 'hsl(var(--card))', borderLeft: '1px solid hsl(var(--border))', zIndex: 200, display: 'flex', flexDirection: 'column', animation: 'slideInRight .2s ease' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white' }}>
              {(selected.name || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-1))' }}>{selected.name}</div>
              <div style={{ fontSize: 11.5, color: 'hsl(var(--text-3))' }}>{selected.email}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-3))' }}><X size={16} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <HealthScore score={computeHealth(selected, orders)} />
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Plan', value: selected.plan || 'N/A' },
                { label: 'MRR', value: selected.mrr ? `$${selected.mrr}/mo` : 'N/A' },
                { label: 'Role', value: selected.role },
                { label: 'Joined', value: selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' }) : 'N/A' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '10px', background: 'hsl(var(--surface-2))', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'hsl(var(--text-3))', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-1))' }}>{value}</div>
                </div>
              ))}
            </div>
            {/* Recent orders */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>Recent Requests</div>
              {orders.filter(o => o.requester_id === selected.id).slice(0, 5).map(o => (
                <div key={o.id} style={{ padding: '8px 10px', background: 'hsl(var(--surface-2))', borderRadius: 7, marginBottom: 5, fontSize: 12 }}>
                  <div style={{ fontWeight: 500, color: 'hsl(var(--text-1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title || o.request_type || 'Request'}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-3))', marginTop: 2 }}>{o.status} · {o.order_code}</div>
                </div>
              ))}
              {orders.filter(o => o.requester_id === selected.id).length === 0 && (
                <div style={{ fontSize: 12, color: 'hsl(var(--text-3))', padding: '10px', textAlign: 'center' }}>No requests yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Users, ArrowUpRight,
  AlertTriangle, RefreshCw, Calendar, ChevronRight, Loader2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const get = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok ? r.json() : null);

function MetricTile({ icon: Icon, label, value, sub, delta, color = '#10b981' }) {
  return (
    <div className="metric-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} style={{ color }} />
        </div>
        {delta !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 600, color: delta >= 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 2 }}>
            {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="metric-value">{value || '—'}</div>
      <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 3, opacity: .7 }}>{sub}</div>}
    </div>
  );
}

function RenewalRow({ client, idx }) {
  const daysLeft = Math.ceil((new Date(client.renewal_date) - new Date()) / 86400000);
  const urgency = daysLeft < 7 ? '#ef4444' : daysLeft < 21 ? '#f59e0b' : '#10b981';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
      borderBottom: '1px solid var(--border)',
      background: idx % 2 === 0 ? 'transparent' : 'rgba(30,30,30,.3)',
    }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
        {(client.name || '?').charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{client.name}</div>
        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{client.plan || 'Growth'}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>${(client.mrr || 0).toLocaleString()}<span style={{ fontSize: 10, fontWeight: 400 }}>/mo</span></div>
        <div style={{ fontSize: 11, color: urgency, fontWeight: 600, marginTop: 1 }}>
          {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Today' : `${daysLeft}d`}
        </div>
      </div>
    </div>
  );
}

function MiniBar({ data, color = '#a855f7' }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: '100%', background: color, borderRadius: '3px 3px 0 0', height: `${Math.max(4, (d.value / max) * 44)}px`, transition: 'height .4s ease', opacity: i === data.length - 1 ? 1 : .5 }} />
        </div>
      ))}
    </div>
  );
}

export default function Finance() {
  const [metrics, setMetrics] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, clientsRes, planRes] = await Promise.all([
        get('/dashboard/v2'),
        get('/users?account_type=Media+Client&limit=50'),
        get('/subscription-plans?limit=20'),
      ]);
      if (dashRes) setMetrics(dashRes);
      const cl = clientsRes?.users || (Array.isArray(clientsRes) ? clientsRes : []);
      setClients(cl);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute financials from clients
  const totalMRR = clients.reduce((sum, c) => sum + (c.mrr || c.subscription_amount || 0), 0);
  const totalARR = totalMRR * 12;
  const activeClients = clients.filter(c => c.status !== 'churned').length;
  const avgMRR = activeClients ? Math.round(totalMRR / activeClients) : 0;

  // Clients with renewal dates
  const withRenewals = clients.filter(c => c.renewal_date).sort((a, b) => new Date(a.renewal_date) - new Date(b.renewal_date));
  const upcomingRenewals = withRenewals.filter(c => {
    const days = Math.ceil((new Date(c.renewal_date) - new Date()) / 86400000);
    return days >= -7 && days <= 90;
  });

  // Fake trend data if no real data
  const mrrTrend = clients.length === 0 ? [
    { month: 'Aug', value: 0 }, { month: 'Sep', value: 0 }, { month: 'Oct', value: 0 },
    { month: 'Nov', value: 0 }, { month: 'Dec', value: 0 }, { month: 'Jan', value: 0 },
    { month: 'Feb', value: 0 }, { month: 'Mar', value: totalMRR },
  ] : [{ month: 'MTD', value: totalMRR }];

  return (
    <div className="page-content" style={{ animation: 'fadeInUp .3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-.02em' }}>Finance</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--tx-3)' }}>Revenue & client billing overview</p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--tx-3)', fontSize: 12 }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={24} style={{ color: 'var(--red)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <>
          {/* Metric tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
            <MetricTile icon={DollarSign} label="Monthly Recurring Revenue" value={`$${totalMRR.toLocaleString()}`} sub="active subscriptions" color="#10b981" />
            <MetricTile icon={TrendingUp}  label="Annual Recurring Revenue"  value={`$${totalARR.toLocaleString()}`} sub="ARR projection" color="#3b82f6" />
            <MetricTile icon={Users}        label="Active Clients"             value={activeClients} sub="on retainer" color="#a855f7" />
            <MetricTile icon={ArrowUpRight} label="Avg MRR per Client"         value={`$${avgMRR.toLocaleString()}`} sub="blended average" color="#f59e0b" />
          </div>

          {/* Two-col layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

            {/* Client Revenue Table */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Client Revenue Breakdown
              </div>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px', padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-overlay)' }}>
                  {['Client', 'Plan', 'MRR', 'Status'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '.07em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {clients.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                    No client billing data yet. Add MRR values to client profiles to see this table.
                  </div>
                ) : (
                  clients.map((client, i) => (
                    <div key={client.id || i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px', padding: '10px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{client.plan || '—'}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{client.mrr ? `$${client.mrr.toLocaleString()}` : '—'}</div>
                      <div>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: client.status === 'churned' ? '#ef444420' : '#10b98120', color: client.status === 'churned' ? '#ef4444' : '#10b981' }}>
                          {client.status === 'churned' ? 'Churned' : 'Active'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Upcoming Renewals */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Upcoming Renewals
              </div>
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {upcomingRenewals.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 12.5 }}>
                    {clients.length === 0 ? 'Add clients with renewal dates to track here' : 'No renewals in the next 90 days'}
                  </div>
                ) : (
                  upcomingRenewals.slice(0, 8).map((c, i) => <RenewalRow key={c.id || i} client={c} idx={i} />)
                )}
              </div>

              {/* MRR Trend */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  MRR Trend
                </div>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px' }}>
                  <MiniBar data={mrrTrend} color="var(--red)" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    {mrrTrend.slice(-4).map((d, i) => (
                      <span key={i} style={{ fontSize: 10, color: 'var(--tx-3)' }}>{d.month}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

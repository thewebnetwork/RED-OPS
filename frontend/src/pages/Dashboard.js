import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, RefreshCw, Search, Users, FolderOpen, Inbox, Truck,
  AlertTriangle, ShieldAlert, Clock, TrendingUp, ChevronRight,
  ExternalLink, Eye, MoreHorizontal, Activity, Calendar,
  CheckCircle2, Circle, Target, Zap, AlertCircle, Filter,
  ArrowUpDown, LayoutGrid, List
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const get = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
  .then(r => r.ok ? r.json() : null).catch(() => null);

const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const timeAgo = (date) => {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

// ── Config ────────────────────────────────────────────────────
const HEALTH_CONFIG = {
  healthy:  { label: 'Healthy',  color: '#22c55e', bg: '#22c55e18', icon: CheckCircle2 },
  at_risk:  { label: 'At Risk',  color: '#f59e0b', bg: '#f59e0b18', icon: AlertTriangle },
  critical: { label: 'Critical', color: '#ef4444', bg: '#ef444418', icon: ShieldAlert },
  new:      { label: 'New',      color: '#8b5cf6', bg: '#8b5cf618', icon: Zap },
};

const STATUS_COLOR = {
  open: '#3b82f6', assigned: '#8b5cf6', in_progress: '#f59e0b',
  pending_review: '#a855f7', delivered: '#22c55e', closed: '#606060', revisions: '#ef4444',
};
const PRI_COLOR = { urgent: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#606060' };

// ── Sub-components ────────────────────────────────────────────

function AggregatePill({ icon: Icon, label, value, color = 'var(--accent)', loading }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--tx-1)' }}>
        {loading ? <span style={{ color: 'var(--tx-3)' }}>—</span> : (value ?? '—')}
      </div>
    </div>
  );
}

function HealthBadge({ health }) {
  const cfg = HEALTH_CONFIG[health] || HEALTH_CONFIG.healthy;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

function ClientAvatar({ name, size = 38 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  // Generate consistent color from name
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#c92a3e', '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#f97316'];
  const bg = colors[Math.abs(hash) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0,
      letterSpacing: '-0.02em',
    }}>
      {initials}
    </div>
  );
}

function StatChip({ label, value, color = 'var(--tx-3)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: value > 0 ? color : 'var(--tx-3)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 9.5, color: 'var(--tx-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
    </div>
  );
}

function ClientCard({ client, onViewProfile, onViewAsClient, onOpenRequests }) {
  const s = client.stats || {};

  return (
    <div
      className="client-card"
      style={{ padding: 0 }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: (HEALTH_CONFIG[client.health] || HEALTH_CONFIG.healthy).color }} />

      {/* Header */}
      <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <ClientAvatar name={client.name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {client.name}
            </span>
            <HealthBadge health={client.health} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> Active {timeAgo(client.last_activity_at)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        padding: '10px 16px', display: 'flex', justifyContent: 'space-around',
        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.015)',
      }}>
        <StatChip label="Requests" value={s.open_requests || 0} color={s.open_requests > 0 ? '#3b82f6' : undefined} />
        <StatChip label="Projects" value={s.active_projects || 0} color={s.active_projects > 0 ? '#8b5cf6' : undefined} />
        <StatChip label="Tasks" value={s.total_tasks || 0} color={s.total_tasks > 0 ? '#f59e0b' : undefined} />
        <StatChip label="SLA" value={s.sla_breached || 0} color={s.sla_breached > 0 ? '#ef4444' : undefined} />
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onViewProfile(client); }}
          className="btn-ghost btn-sm"
          style={{ flex: 1, fontSize: 11, gap: 4, padding: '6px 8px', borderRadius: 7 }}
        >
          <Eye size={12} /> Profile
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpenRequests(client); }}
          className="btn-ghost btn-sm"
          style={{ flex: 1, fontSize: 11, gap: 4, padding: '6px 8px', borderRadius: 7 }}
        >
          <Inbox size={12} /> Requests
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onViewAsClient(client); }}
          className="btn-primary btn-sm"
          style={{ flex: 1, fontSize: 11, gap: 4, padding: '6px 8px', borderRadius: 7 }}
        >
          <ExternalLink size={12} /> Switch
        </button>
      </div>
    </div>
  );
}

function EventRow({ event, idx, total }) {
  const typeMap = {
    new_request:          { icon: Plus,          color: '#3b82f6' },
    order_status_change:  { icon: Activity,      color: '#f59e0b' },
    notification:         { icon: AlertCircle,    color: '#8b5cf6' },
    delivery:             { icon: Truck,          color: '#22c55e' },
    sla_breach:           { icon: ShieldAlert,    color: '#ef4444' },
  };
  const cfg = typeMap[event.type] || typeMap.notification;
  const Icon = cfg.icon;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      borderBottom: idx < total - 1 ? '1px solid var(--border)' : 'none',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: cfg.color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={12} style={{ color: cfg.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.message || 'Activity'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          {event.client_name && <span style={{ fontWeight: 600 }}>{event.client_name}</span>}
          {event.client_name && <span>·</span>}
          <span>{timeAgo(event.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Fallback: Operator/Client Dashboard ──────────────────────
function OperatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activity, setActivity] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, tasksRes, ordersRes, notifRes] = await Promise.all([
        get('/dashboard/v2/metrics'), get('/tasks?limit=8'), get('/orders?limit=8'), get('/notifications?limit=6'),
      ]);
      if (dashRes) setMetrics(dashRes);
      setTasks(tasksRes?.items || tasksRes?.tasks || (Array.isArray(tasksRes) ? tasksRes : []));
      setRequests(ordersRes?.orders || (Array.isArray(ordersRes) ? ordersRes : []));
      setActivity(notifRes?.notifications || (Array.isArray(notifRes) ? notifRes : []));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const insights = [];
  if (!loading && metrics) {
    const unassigned = metrics?.kpi?.open || 0;
    const breached = metrics?.sla?.breached || 0;
    const atRisk = metrics?.sla?.at_risk || 0;
    const delivered = metrics?.kpi?.delivered || 0;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
    if (breached > 0) insights.push({ type: 'danger', text: `${breached} request${breached > 1 ? 's' : ''} have breached SLA`, nav: '/requests' });
    if (overdue > 0) insights.push({ type: 'danger', text: `${overdue} task${overdue > 1 ? 's' : ''} past due date`, nav: '/tasks' });
    if (atRisk > 0) insights.push({ type: 'warning', text: `${atRisk} request${atRisk > 1 ? 's' : ''} approaching SLA deadline`, nav: '/requests' });
    if (unassigned > 3) insights.push({ type: 'warning', text: `${unassigned} requests unassigned`, nav: '/requests' });
    if (delivered > 0) insights.push({ type: 'success', text: `${delivered} deliveries completed this month` });
    if (insights.length === 0) insights.push({ type: 'success', text: 'Everything is on track' });
  }

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  const insightMap = {
    warning: { icon: AlertTriangle, color: '#f59e0b' },
    danger: { icon: AlertCircle, color: '#ef4444' },
    success: { icon: CheckCircle2, color: '#22c55e' },
    info: { icon: Zap, color: '#3b82f6' },
  };

  return (
    <div className="page-scroll">
      <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx-1)', margin: 0 }}>
              {greet()}, {user?.name?.split(' ')[0] || 'there'}
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> {today}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} className="btn-ghost btn-sm" style={{ gap: 5 }}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        <div className="metrics-grid-4">
          <AggregatePill icon={Inbox} label="Open Requests" color="#3b82f6" value={loading ? null : (metrics?.kpi?.open || 0) + (metrics?.kpi?.in_progress || 0)} loading={loading} />
          <AggregatePill icon={CheckCircle2} label="Deliveries MTD" color="#22c55e" value={loading ? null : metrics?.kpi?.delivered || 0} loading={loading} />
          <AggregatePill icon={Target} label="Open Tasks" color="#f59e0b" value={loading ? null : tasks.filter(t => t.status !== 'done').length} loading={loading} />
          <AggregatePill icon={AlertTriangle} label="SLA Risks" color="#ef4444" value={loading ? null : (metrics?.sla?.at_risk || 0) + (metrics?.sla?.breached || 0)} loading={loading} />
        </div>

        {/* Insights */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Insights</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {!loading && insights.map((ins, i) => {
              const cfg = insightMap[ins.type] || insightMap.info;
              const Icon = cfg.icon;
              return (
                <div key={i} onClick={ins.nav ? () => navigate(ins.nav) : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', cursor: ins.nav ? 'pointer' : 'default' }}>
                  <Icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5, color: 'var(--tx-2)' }}>{ins.text}</span>
                  {ins.nav && <ChevronRight size={12} style={{ color: 'var(--tx-3)' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Two-col: Requests + Tasks */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Open Requests</span>
              <Link to="/requests" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>View all <ChevronRight size={11} /></Link>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {loading ? [0,1,2].map(i => <div key={i} className="skeleton-pulse" style={{ height: 50, margin: 8, borderRadius: 7 }} />)
                : requests.length === 0
                  ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>No open requests</div>
                  : <div style={{ padding: 6 }}>{requests.slice(0,6).map(r => (
                    <Link key={r.id} to={`/requests/${r.id}`} style={{ textDecoration: 'none' }}>
                      <div className="list-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRI_COLOR[r.priority] || '#606060', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || r.request_type || 'Request'}</div>
                          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{r.order_code} · {r.requester_name || 'Client'}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: (STATUS_COLOR[r.status] || '#606060') + '20', color: STATUS_COLOR[r.status] || '#606060', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{(r.status || 'open').replace(/_/g, ' ')}</span>
                      </div>
                    </Link>
                  ))}</div>
              }
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>My Tasks</span>
              <Link to="/tasks" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>View all <ChevronRight size={11} /></Link>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {loading ? [0,1,2].map(i => <div key={i} className="skeleton-pulse" style={{ height: 50, margin: 8, borderRadius: 7 }} />)
                : tasks.length === 0
                  ? <div style={{ padding: 28, textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>No tasks right now</div>
                  : <div style={{ padding: 6 }}>{tasks.slice(0,6).map(t => (
                    <Link key={t.id} to="/tasks" style={{ textDecoration: 'none' }}>
                      <div className="list-row-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8 }}>
                        <Circle size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                          {t.due_date && <div style={{ fontSize: 11, color: new Date(t.due_date) < new Date() && t.status !== 'done' ? '#ef4444' : 'var(--tx-3)', marginTop: 1 }}>Due {new Date(t.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</div>}
                        </div>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRI_COLOR[t.priority] || '#606060', flexShrink: 0 }} />
                      </div>
                    </Link>
                  ))}</div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main: Admin Agency View ──────────────────────────────────
function AgencyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity'); // activity, name, requests, health

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/dashboard/agency');
      if (res) setData(res);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const agg = data?.aggregate || {};
  const clients = data?.clients || [];
  const events = data?.recent_events || [];

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...clients];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q));
    }
    if (healthFilter !== 'all') list = list.filter(c => c.health === healthFilter);
    list.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'requests') return (b.stats?.open_requests || 0) - (a.stats?.open_requests || 0);
      if (sortBy === 'health') {
        const order = { critical: 0, at_risk: 1, new: 2, healthy: 3 };
        return (order[a.health] ?? 3) - (order[b.health] ?? 3);
      }
      return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
    });
    return list;
  }, [clients, search, healthFilter, sortBy]);

  // Health counts
  const healthCounts = useMemo(() => {
    const c = { all: clients.length, healthy: 0, at_risk: 0, critical: 0, new: 0 };
    clients.forEach(cl => { if (c[cl.health] !== undefined) c[cl.health]++; });
    return c;
  }, [clients]);

  const handleViewProfile = (client) => navigate(`/clients/${client.id}`);
  const handleOpenRequests = (client) => navigate(`/requests?client=${client.id}`);
  const handleViewAsClient = (client) => {
    localStorage.setItem('preview_as_client', 'true');
    localStorage.setItem('preview_client_id', client.id);
    localStorage.setItem('preview_client_name', client.name);
    window.location.href = '/';
  };

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page-scroll">
      <div style={{ padding: '24px 28px', maxWidth: 1400 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--tx-1)', margin: 0, letterSpacing: '-0.03em' }}>
              Agency Command Center
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> {today} · {greet()}, {user?.name?.split(' ')[0] || 'there'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={load} className="btn-ghost btn-sm" style={{ gap: 5 }}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
            </button>
            <button onClick={() => navigate('/requests?new=1')} className="btn-primary btn-sm" style={{ gap: 5 }}>
              <Plus size={13} /> New Request
            </button>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="metrics-grid-6">
          <AggregatePill icon={Users} label="Clients" color="#8b5cf6" value={agg.total_clients} loading={loading} />
          <AggregatePill icon={Inbox} label="Open Requests" color="#3b82f6" value={agg.total_open_requests} loading={loading} />
          <AggregatePill icon={FolderOpen} label="Active Projects" color="#f59e0b" value={agg.total_active_projects} loading={loading} />
          <AggregatePill icon={Truck} label="Delivered MTD" color="#22c55e" value={agg.deliveries_mtd} loading={loading} />
          <AggregatePill icon={Clock} label="Avg Response" color="#06b6d4" value={agg.avg_response_hours ? `${agg.avg_response_hours}h` : '—'} loading={loading} />
          <AggregatePill icon={TrendingUp} label="Team Util." color={agg.team_utilization_pct > 80 ? '#ef4444' : '#22c55e'} value={agg.team_utilization_pct ? `${agg.team_utilization_pct}%` : '—'} loading={loading} />
        </div>

        {/* SLA Alert Banner (only if breaches) */}
        {!loading && agg.sla_breached > 0 && (
          <div
            onClick={() => navigate('/requests')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginBottom: 20,
              background: '#ef444412', border: '1px solid #ef444430', borderRadius: 10, cursor: 'pointer',
            }}
          >
            <ShieldAlert size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
              {agg.sla_breached} SLA breach{agg.sla_breached > 1 ? 'es' : ''} across client accounts — click to review
            </span>
            <ChevronRight size={14} style={{ color: '#ef4444' }} />
          </div>
        )}

        {/* Two-column: Client Grid + Activity Feed */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* Left: Client Cards */}
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {/* Search */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card)',
                border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', flex: '1 1 200px', maxWidth: 280,
              }}>
                <Search size={13} style={{ color: 'var(--tx-3)' }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--tx-1)', fontSize: 12.5, width: '100%' }}
                />
              </div>

              {/* Health filter pills */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { key: 'all', label: 'All', count: healthCounts.all },
                  { key: 'critical', label: 'Critical', count: healthCounts.critical, color: '#ef4444' },
                  { key: 'at_risk', label: 'At Risk', count: healthCounts.at_risk, color: '#f59e0b' },
                  { key: 'healthy', label: 'Healthy', count: healthCounts.healthy, color: '#22c55e' },
                  { key: 'new', label: 'New', count: healthCounts.new, color: '#8b5cf6' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setHealthFilter(f.key)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: '1px solid',
                      borderColor: healthFilter === f.key ? (f.color || 'var(--accent)') : 'var(--border)',
                      background: healthFilter === f.key ? (f.color || 'var(--accent)') + '18' : 'transparent',
                      color: healthFilter === f.key ? (f.color || 'var(--accent)') : 'var(--tx-3)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'all .1s',
                    }}
                  >
                    {f.label}
                    {f.count > 0 && <span style={{ fontSize: 10, opacity: 0.8 }}>{f.count}</span>}
                  </button>
                ))}
              </div>

              {/* Sort */}
              <select
                value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{
                  padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--tx-2)', fontSize: 11, cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="activity">Sort: Recent Activity</option>
                <option value="name">Sort: Name A→Z</option>
                <option value="requests">Sort: Most Requests</option>
                <option value="health">Sort: Health Priority</option>
              </select>
            </div>

            {/* Cards Grid */}
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className="skeleton-pulse" style={{ height: 200, borderRadius: 12 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: 'var(--tx-3)',
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
              }}>
                <Users size={32} style={{ color: 'var(--tx-3)', opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {search || healthFilter !== 'all' ? 'No clients match your filters' : 'No client accounts yet'}
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.7 }}>
                  {search || healthFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Add Media Client accounts from the Team page to see them here.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {filtered.map(c => (
                  <ClientCard
                    key={c.id}
                    client={c}
                    onViewProfile={handleViewProfile}
                    onOpenRequests={handleOpenRequests}
                    onViewAsClient={handleViewAsClient}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Activity Feed */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Recent Activity</span>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {loading ? (
                [0,1,2,3].map(i => <div key={i} className="skeleton-pulse" style={{ height: 50, margin: 8, borderRadius: 7 }} />)
              ) : events.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--tx-3)', fontSize: 12.5 }}>
                  No recent activity
                </div>
              ) : (
                events.map((ev, i) => <EventRow key={i} event={ev} idx={i} total={events.length} />)
              )}
            </div>

            {/* Quick Stats Summary */}
            {!loading && data && (
              <div style={{
                marginTop: 14, background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
                  Quick Stats
                </div>
                {[
                  { label: 'Total Active Clients', value: agg.active_clients, color: '#22c55e' },
                  { label: 'New Clients (30d)', value: healthCounts.new, color: '#8b5cf6' },
                  { label: 'SLA Breaches', value: agg.sla_breached, color: '#ef4444' },
                  { label: 'Delivered This Month', value: agg.deliveries_mtd, color: '#22c55e' },
                ].map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: s.value > 0 ? s.color : 'var(--tx-3)' }}>{s.value || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export: Route to correct dashboard ────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';
  const isClient = user?.role === 'Media Client' || user?.account_type === 'Media Client';

  // Preview-as-client mode: show operator dashboard
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';

  if (isPreview || isClient || !isAdmin) {
    return <OperatorDashboard />;
  }

  return <AgencyDashboard />;
}

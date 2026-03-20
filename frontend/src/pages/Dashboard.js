import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, RefreshCw, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, Inbox, Zap,
  ChevronRight, Circle, Calendar, Target, AlertCircle
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

const STATUS_COLOR = {
  open: '#3b82f6', assigned: '#8b5cf6', in_progress: '#f59e0b',
  pending_review: '#a855f7', delivered: '#22c55e', closed: '#606060', revisions: '#ef4444',
};

const PRI_COLOR = { urgent: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#606060' };

// ── Sub-components ──────────────────────────────────────────

function Dot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

function StatusPill({ s }) {
  const color = STATUS_COLOR[s] || '#606060';
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: color + '20', color, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {(s || 'open').replace(/_/g, ' ')}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color = '#a855f7', loading }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--tx-1)' }}>
          {loading ? <span style={{ color: 'var(--tx-3)' }}>—</span> : (value ?? '—')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--tx-3)', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2, opacity: 0.7 }}>{sub}</div>}
      </div>
    </div>
  );
}

function InsightRow({ type, text, action, onAction }) {
  const map = {
    warning: { cls: 'warn',   icon: AlertTriangle, color: '#f59e0b' },
    danger:  { cls: 'danger', icon: AlertCircle,   color: '#ef4444' },
    success: { cls: 'good',   icon: CheckCircle2,  color: '#22c55e' },
    info:    { cls: 'info',   icon: Zap,           color: '#3b82f6' },
  };
  const { cls, icon: Icon, color } = map[type] || map.info;
  return (
    <div className={`insight ${cls}`} onClick={onAction} style={{ cursor: onAction ? 'pointer' : 'default' }}>
      <Icon size={13} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--tx-2)' }}>{text}</span>
      {action && <span style={{ fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>{action} →</span>}
    </div>
  );
}

function SectionLabel({ children, to }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{children}</span>
      {to && (
        <Link to={to} style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
          View all <ChevronRight size={11} />
        </Link>
      )}
    </div>
  );
}

function RequestRow({ req }) {
  return (
    <Link to={`/requests/${req.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px',
        borderRadius: 8, transition: 'background .1s', cursor: 'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Dot color={PRI_COLOR[req.priority] || '#606060'} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {req.title || req.request_type || 'Request'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>
            {req.order_code} · {req.requester_name || 'Client'}
          </div>
        </div>
        <StatusPill s={req.status} />
      </div>
    </Link>
  );
}

function TaskRow({ task }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
  return (
    <Link to="/tasks" style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 8, transition: 'background .1s', cursor: 'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Circle size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </div>
          {task.due_date && (
            <div style={{ fontSize: 11, color: isOverdue ? '#ef4444' : 'var(--tx-3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Calendar size={9} />
              Due {new Date(task.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
        <Dot color={PRI_COLOR[task.priority] || '#606060'} />
      </div>
    </Link>
  );
}

// ── Main ────────────────────────────────────────────────────
export default function Dashboard() {
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
        get('/dashboard/v2'),
        get('/tasks?limit=8'),
        get('/orders?limit=8'),
        get('/notifications?limit=6'),
      ]);
      if (dashRes) setMetrics(dashRes);
      setTasks(tasksRes?.items || tasksRes?.tasks || (Array.isArray(tasksRes) ? tasksRes : []));
      setRequests(ordersRes?.orders || (Array.isArray(ordersRes) ? ordersRes : []));
      setActivity(notifRes?.notifications || (Array.isArray(notifRes) ? notifRes : []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute insights
  const insights = [];
  if (!loading) {
    const unassigned = metrics?.kpi?.open || 0;
    const breached   = metrics?.sla?.breached || 0;
    const atRisk     = metrics?.sla?.at_risk || 0;
    const delivered  = metrics?.kpi?.delivered || 0;
    const overdue    = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;

    if (breached > 0) insights.push({ type: 'danger',  text: `${breached} request${breached > 1 ? 's' : ''} have breached SLA`, action: 'View', nav: '/requests' });
    if (overdue  > 0) insights.push({ type: 'danger',  text: `${overdue} task${overdue > 1 ? 's' : ''} past due date`, action: 'View', nav: '/tasks' });
    if (atRisk   > 0) insights.push({ type: 'warning', text: `${atRisk} request${atRisk > 1 ? 's' : ''} approaching SLA deadline`, action: 'View', nav: '/requests' });
    if (unassigned > 3) insights.push({ type: 'warning', text: `${unassigned} requests unassigned and waiting`, action: 'Assign', nav: '/requests' });
    if (delivered > 0)  insights.push({ type: 'success', text: `${delivered} deliveries completed this month` });
    if (insights.length === 0) insights.push({ type: 'success', text: 'Everything is on track — no critical alerts' });
  }

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page-scroll">
      <div style={{ padding: '24px 28px', maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx-1)', margin: 0, letterSpacing: '-0.03em' }}>
              {greet()}, {user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={11} /> {today}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={load} className="btn-ghost btn-sm" style={{ gap: 5 }}>
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
            </button>
            <button onClick={() => navigate('/command-center')} className="btn-primary btn-sm" style={{ gap: 5 }}>
              <Plus size={13} /> New Request
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <MetricCard icon={Inbox} label="Open Requests" color="#3b82f6"
            value={loading ? null : (metrics?.kpi?.open || 0) + (metrics?.kpi?.in_progress || 0)}
            sub={`${metrics?.kpi?.open || 0} unassigned`} loading={loading} />
          <MetricCard icon={CheckCircle2} label="Deliveries MTD" color="#22c55e"
            value={loading ? null : metrics?.kpi?.delivered || 0}
            sub="this month" loading={loading} />
          <MetricCard icon={Target} label="Open Tasks" color="#f59e0b"
            value={loading ? null : tasks.filter(t => t.status !== 'done').length}
            sub="in progress" loading={loading} />
          <MetricCard icon={AlertTriangle} label="SLA Risks" color={((metrics?.sla?.breached || 0) > 0) ? '#ef4444' : '#a855f7'}
            value={loading ? null : (metrics?.sla?.at_risk || 0) + (metrics?.sla?.breached || 0)}
            sub={`${metrics?.sla?.breached || 0} breached`} loading={loading} />
        </div>

        {/* Insights */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>AI Insights</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {loading ? (
              <div style={{ height: 38, background: 'var(--bg-elevated)', borderRadius: 8, opacity: 0.5 }} />
            ) : (
              insights.map((ins, i) => (
                <InsightRow key={i} {...ins} onAction={ins.nav ? () => navigate(ins.nav) : undefined} />
              ))
            )}
          </div>
        </div>

        {/* Two-col */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Open Requests */}
          <div>
            <SectionLabel to="/requests">Open Requests</SectionLabel>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {loading ? (
                [0, 1, 2].map(i => (
                  <div key={i} style={{ height: 52, margin: 8, background: 'var(--bg-elevated)', borderRadius: 7, opacity: 0.4 }} />
                ))
              ) : requests.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                  No open requests 🎉
                </div>
              ) : (
                <div style={{ padding: '6px' }}>
                  {requests.slice(0, 6).map(req => <RequestRow key={req.id} req={req} />)}
                </div>
              )}
            </div>
          </div>

          {/* My Tasks */}
          <div>
            <SectionLabel to="/tasks">My Tasks</SectionLabel>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {loading ? (
                [0, 1, 2].map(i => (
                  <div key={i} style={{ height: 52, margin: 8, background: 'var(--bg-elevated)', borderRadius: 7, opacity: 0.4 }} />
                ))
              ) : tasks.length === 0 ? (
                <div style={{ padding: '28px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                  No tasks right now ✓
                </div>
              ) : (
                <div style={{ padding: '6px' }}>
                  {tasks.slice(0, 6).map(task => <TaskRow key={task.id} task={task} />)}
                </div>
              )}
              <div style={{ padding: '6px 6px 8px' }}>
                <button
                  onClick={() => navigate('/tasks?new=1')}
                  style={{ width: '100%', padding: '7px', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--tx-3)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--tx-3)'; }}
                >
                  <Plus size={11} /> Add task
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Activity */}
        {activity.length > 0 && (
          <div>
            <SectionLabel>Recent Activity</SectionLabel>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {activity.slice(0, 5).map((n, i) => (
                <div key={n.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {(n.actor_name || n.title || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.message || n.title || 'Activity'}
                    </div>
                    {n.created_at && (
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>
                        {new Date(n.created_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                  {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

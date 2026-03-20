import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, RefreshCw, TrendingUp, TrendingDown,
  Clock, CheckCircle2, AlertTriangle, Activity,
  Users, DollarSign, Inbox, Zap, ChevronRight,
  Circle, ArrowUpRight, MoreHorizontal, Calendar,
  Target, Star, AlertCircle
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const token = () => localStorage.getItem('token');
const get = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok ? r.json() : null);

// ── Helpers ──
const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const STATUS_COLORS = {
  open: '#3b82f6',
  assigned: '#8b5cf6',
  in_progress: '#f59e0b',
  pending_review: '#a855f7',
  delivered: '#10b981',
  closed: '#6b7280',
  revisions: '#ef4444',
};

const PRIORITY_DOT = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
};

function PriorityDot({ p }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_DOT[p] || '#6b7280', display: 'inline-block', flexShrink: 0 }} />;
}

function StatusPill({ s }) {
  const label = s?.replace(/_/g, ' ') || 'open';
  const color = STATUS_COLORS[s] || '#6b7280';
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: color + '22', color, letterSpacing: '.03em', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, sub, trend, color = '#a855f7', loading }) {
  return (
    <div className="metric-card" style={{ cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: trend >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="metric-value" style={{ color: 'hsl(var(--text-1))' }}>
        {loading ? <span style={{ opacity: .3 }}>—</span> : value ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: 'hsl(var(--text-3))', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'hsl(var(--text-3))', marginTop: 4, opacity: .7 }}>{sub}</div>}
    </div>
  );
}

function InsightCard({ type, text, action, onAction }) {
  const configs = {
    warning: { icon: AlertTriangle, color: '#f59e0b', bg: '#f59e0b12' },
    danger: { icon: AlertCircle, color: '#ef4444', bg: '#ef444412' },
    success: { icon: CheckCircle2, color: '#10b981', bg: '#10b98112' },
    info: { icon: Zap, color: '#3b82f6', bg: '#3b82f612' },
  };
  const { icon: Icon, color, bg } = configs[type] || configs.info;
  return (
    <div className="insight" style={{ background: bg, borderColor: color + '30', cursor: action ? 'pointer' : 'default' }} onClick={onAction}>
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12.5, color: 'hsl(var(--text-2))' }}>{text}</span>
      {action && <span style={{ fontSize: 11, color, fontWeight: 600, flexShrink: 0 }}>{action} →</span>}
    </div>
  );
}

// ────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activity, setActivity] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, tasksRes, ordersRes, notifRes] = await Promise.all([
        get('/dashboard/v2'),
        get('/tasks?limit=8&status=todo,doing,review'),
        get('/orders?limit=8&status=open,assigned,in_progress,pending_review'),
        get('/notifications?limit=8'),
      ]);
      if (dashRes) setMetrics(dashRes);
      if (tasksRes?.items || tasksRes?.tasks || Array.isArray(tasksRes)) {
        setTasks(tasksRes?.items || tasksRes?.tasks || tasksRes || []);
      }
      if (ordersRes?.orders || Array.isArray(ordersRes)) {
        setRequests(ordersRes?.orders || ordersRes || []);
      }
      if (notifRes?.notifications || Array.isArray(notifRes)) {
        setActivity(notifRes?.notifications || notifRes || []);
      }
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Compute insights from data ──
  const insights = [];
  if (metrics) {
    const unassigned = metrics?.kpi?.open || 0;
    if (unassigned > 3) insights.push({ type: 'warning', text: `${unassigned} requests are unassigned and waiting`, action: 'Review', nav: '/requests' });
    if (metrics?.sla?.breached > 0) insights.push({ type: 'danger', text: `${metrics.sla.breached} request${metrics.sla.breached > 1 ? 's' : ''} have breached SLA`, action: 'View', nav: '/requests' });
    if (metrics?.sla?.at_risk > 0) insights.push({ type: 'warning', text: `${metrics.sla.at_risk} request${metrics.sla.at_risk > 1 ? 's' : ''} approaching SLA deadline`, action: 'View', nav: '/requests' });
    if (metrics?.kpi?.delivered > 0) insights.push({ type: 'success', text: `${metrics.kpi.delivered} deliveries completed this month — great output`, action: null });
  }
  if (tasks.length > 0) {
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;
    if (overdue > 0) insights.push({ type: 'danger', text: `${overdue} task${overdue > 1 ? 's' : ''} past due date`, action: 'View Tasks', nav: '/tasks' });
  }
  if (insights.length === 0 && !loading) {
    insights.push({ type: 'success', text: 'Everything looks on track — no critical alerts', action: null });
  }

  const today = new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page-content" style={{ animation: 'fadeInUp .3s ease' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-1))', letterSpacing: '-.02em', margin: 0, lineHeight: 1.2 }}>
            {greet()}, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-3))', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={12} /> {today}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 7, cursor: 'pointer', color: 'hsl(var(--text-3))', fontSize: 12 }}>
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button onClick={() => navigate('/command-center')} className="btn-primary-dark btn-sm" style={{ gap: 6 }}>
            <Plus size={13} /> New Request
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <MetricCard
          icon={Inbox}
          label="Open Requests"
          value={(metrics?.kpi?.open || 0) + (metrics?.kpi?.in_progress || 0) + (metrics?.kpi?.pending_review || 0)}
          sub={`${metrics?.kpi?.open || 0} unassigned`}
          color="#3b82f6"
          loading={loading}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Deliveries MTD"
          value={metrics?.kpi?.delivered || 0}
          sub="this month"
          color="#10b981"
          loading={loading}
        />
        <MetricCard
          icon={Target}
          label="My Open Tasks"
          value={tasks.length}
          sub="in progress"
          color="#f59e0b"
          loading={loading}
        />
        <MetricCard
          icon={AlertTriangle}
          label="SLA Risks"
          value={(metrics?.sla?.at_risk || 0) + (metrics?.sla?.breached || 0)}
          sub={`${metrics?.sla?.breached || 0} breached`}
          color={((metrics?.sla?.breached || 0) > 0) ? '#ef4444' : '#a855f7'}
          loading={loading}
        />
      </div>

      {/* ── Insights ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          AI Insights
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? (
            <div style={{ height: 36, background: 'hsl(var(--surface-2))', borderRadius: 8, opacity: .4 }} />
          ) : (
            insights.map((ins, i) => (
              <InsightCard key={i} {...ins} onAction={ins.nav ? () => navigate(ins.nav) : undefined} />
            ))
          )}
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Open Requests */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Open Requests
            </div>
            <Link to="/requests" style={{ fontSize: 11, color: 'hsl(var(--primary))', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              View all <ChevronRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ height: 52, background: 'hsl(var(--surface-2))', borderRadius: 8, opacity: .3 }} />
              ))
            ) : requests.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--text-3))', fontSize: 13, background: 'hsl(var(--surface-2))', borderRadius: 8 }}>
                No open requests 🎉
              </div>
            ) : (
              requests.map(req => (
                <Link key={req.id} to={`/requests/${req.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '10px 12px',
                    background: 'hsl(var(--surface-2))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'border-color .15s',
                    cursor: 'pointer',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(var(--primary))'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border))'}
                  >
                    <PriorityDot p={req.priority} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--text-1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.title || req.request_type || 'Request'}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-3))', marginTop: 1 }}>
                        {req.order_code} · {req.requester_name || 'Client'}
                      </div>
                    </div>
                    <StatusPill s={req.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* My Tasks */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.08em', textTransform: 'uppercase' }}>
              My Tasks
            </div>
            <Link to="/tasks" style={{ fontSize: 11, color: 'hsl(var(--primary))', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              View all <ChevronRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ height: 52, background: 'hsl(var(--surface-2))', borderRadius: 8, opacity: .3 }} />
              ))
            ) : tasks.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--text-3))', fontSize: 13, background: 'hsl(var(--surface-2))', borderRadius: 8 }}>
                No tasks right now — clean slate ✓
              </div>
            ) : (
              tasks.map(task => (
                <Link key={task.id} to="/tasks" style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '10px 12px',
                    background: 'hsl(var(--surface-2))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'border-color .15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(var(--primary))'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border))'}
                  >
                    <Circle size={13} style={{ color: 'hsl(var(--text-3))', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--text-1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-3))', marginTop: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {task.due_date && (
                          <span style={{ color: new Date(task.due_date) < new Date() ? '#ef4444' : 'hsl(var(--text-3))' }}>
                            Due {new Date(task.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {task.assignee_name && <span>{task.assignee_name}</span>}
                      </div>
                    </div>
                    <PriorityDot p={task.priority} />
                  </div>
                </Link>
              ))
            )}
          </div>
          <button
            onClick={() => navigate('/tasks?new=1')}
            style={{ marginTop: 8, width: '100%', padding: '8px', background: 'transparent', border: '1px dashed hsl(var(--border))', borderRadius: 8, cursor: 'pointer', color: 'hsl(var(--text-3))', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'hsl(var(--primary))'; e.currentTarget.style.color = 'hsl(var(--primary))'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.color = 'hsl(var(--text-3))'; }}
          >
            <Plus size={12} /> Add task
          </button>
        </div>
      </div>

      {/* ── Activity Feed ── */}
      {activity.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Recent Activity
          </div>
          <div style={{ background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 10, overflow: 'hidden' }}>
            {activity.slice(0, 5).map((n, i) => (
              <div key={n.id || i} style={{
                padding: '10px 14px',
                borderBottom: i < Math.min(activity.length, 5) - 1 ? '1px solid hsl(var(--border))' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {(n.actor_name || n.title || 'S').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'hsl(var(--text-1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.message || n.title || 'Activity'}
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-3))', marginTop: 1 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
                {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(var(--primary))', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

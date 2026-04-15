/**
 * OperatorDashboard — task-first execution view.
 *
 * Built for freelancers/contractors who need to move fast. No agency-wide
 * KPIs, no revenue numbers, no other operators' work. Just: what's due,
 * what's coming, what's overdue, and which clients need attention.
 *
 * All data is already role-scoped by the Wave 1 backend RBAC pass —
 * tasks here are only tasks assigned to / created by / in a project of
 * the current operator.
 */
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertCircle, CheckSquare, Clock, ArrowRight, Plus,
  Calendar as CalendarIcon, Flame, Users,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const PRIORITY = {
  urgent: { label: 'Urgent', color: 'var(--red-status)' },
  high:   { label: 'High',   color: 'var(--yellow)' },
  medium: { label: 'Medium', color: 'var(--yellow)' },
  low:    { label: 'Low',    color: 'var(--tx-3)' },
};

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function OperatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [tRes, pRes] = await Promise.allSettled([
          ax().get(`${API}/tasks`),
          ax().get(`${API}/projects`),
        ]);
        if (cancel) return;
        const tData = tRes.status === 'fulfilled' ? (Array.isArray(tRes.value.data) ? tRes.value.data : tRes.value.data?.items || []) : [];
        const pData = pRes.status === 'fulfilled' ? (Array.isArray(pRes.value.data) ? pRes.value.data : []) : [];
        setTasks(tData);
        setProjects(pData);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const now = new Date();
  const todayKey = dayKey(now);
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);

  const sliced = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done');
    const overdue = [];
    const dueToday = [];
    const thisWeek = [];

    for (const t of open) {
      // Overdue: due_at before today
      if (t.due_at) {
        const d = new Date(t.due_at);
        if (d < new Date(todayKey + 'T00:00:00')) { overdue.push(t); continue; }
        if (isSameDay(d, now)) { dueToday.push(t); continue; }
        if (d <= weekEnd) { thisWeek.push(t); continue; }
      }
      // Calendar-scheduled for today counts as due today even if no due_at
      if (t.calendar_date === todayKey && !dueToday.includes(t)) {
        dueToday.push(t);
      }
    }

    // Clients needing attention: projects containing >=1 overdue or urgent task
    const urgent = open.filter(t => t.priority === 'urgent');
    const attentionProjectIds = new Set([
      ...overdue.map(t => t.project_id).filter(Boolean),
      ...urgent.map(t => t.project_id).filter(Boolean),
    ]);
    const attentionProjects = projects.filter(p => attentionProjectIds.has(p.id));

    return { overdue, dueToday, thisWeek, attentionProjects, totalOpen: open.length };
  }, [tasks, projects, todayKey, now, weekEnd]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page-content" style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '4px 0 20px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{greeting}, {firstName}</h1>
        <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>
          {loading ? 'Loading your day…' :
            sliced.totalOpen === 0 ? 'Your plate is clear. Nice work.' :
            `${sliced.totalOpen} open task${sliced.totalOpen === 1 ? '' : 's'} · ${sliced.dueToday.length} due today · ${sliced.overdue.length} overdue`}
        </p>
      </div>

      {/* Quick stats row */}
      <div className="metrics-grid-4" style={{ gap: 12, marginBottom: 18 }}>
        <Stat icon={Flame}        color="var(--red-status)" label="Overdue"      value={sliced.overdue.length} onClick={() => navigate('/task-board')} />
        <Stat icon={CheckSquare}  color="var(--accent)"     label="Due today"    value={sliced.dueToday.length} onClick={() => navigate('/calendar?view=week')} />
        <Stat icon={CalendarIcon} color="var(--blue)"       label="This week"    value={sliced.thisWeek.length} onClick={() => navigate('/calendar')} />
        <Stat icon={Users}        color="var(--purple)"     label="Needs attention" value={sliced.attentionProjects.length} onClick={() => navigate('/projects')} />
      </div>

      {/* Main grid */}
      <div className="two-col">
        <div className="col-main" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TaskSection
            title="Due today"
            empty="Nothing due today."
            icon={CheckSquare}
            tasks={sliced.dueToday}
            onOpen={(t) => navigate('/task-board')}
          />
          <TaskSection
            title="Overdue"
            empty="No overdue items — ship."
            icon={AlertCircle}
            accent="var(--red-status)"
            tasks={sliced.overdue}
            onOpen={(t) => navigate('/task-board')}
          />
          <TaskSection
            title="This week"
            empty="Quiet week ahead."
            icon={Clock}
            tasks={sliced.thisWeek}
            onOpen={(t) => navigate('/task-board')}
          />
        </div>

        <div className="col-side" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Clients needing attention */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Needs attention</div>
              <Link to="/projects" style={{ fontSize: 11, color: 'var(--tx-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                All <ArrowRight size={10} />
              </Link>
            </div>
            {sliced.attentionProjects.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>All clear. No overdue or urgent work flagged.</div>
            ) : (
              sliced.attentionProjects.slice(0, 5).map(p => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red-status)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    {p.client_name && <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 1 }}>{p.client_name}</div>}
                  </div>
                  <ArrowRight size={12} style={{ color: 'var(--tx-3)' }} />
                </Link>
              ))
            )}
          </div>

          {/* Quick actions */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 10 }}>Quick actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <QuickLink icon={Plus}          label="New task"         to="/task-board" />
              <QuickLink icon={CalendarIcon}  label="Open calendar"    to="/calendar" />
              <QuickLink icon={CheckSquare}   label="Task board"       to="/task-board" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, color, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card hover-card"
      style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'var(--bg-elevated)', color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kpi-value" style={{ color: 'var(--tx-1)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4 }}>{label}</div>
      </div>
    </button>
  );
}

function TaskSection({ title, empty, icon: Icon, accent, tasks, onOpen }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={15} style={{ color: accent || 'var(--tx-2)' }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{title}</div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: 'var(--bg-elevated)', color: 'var(--tx-3)' }}>{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {tasks.slice(0, 6).map(t => {
            const pri = PRIORITY[t.priority] || PRIORITY.medium;
            const due = t.due_at ? new Date(t.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: pri.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--tx-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                {due && (
                  <span style={{ fontSize: 11, color: 'var(--tx-3)', flexShrink: 0 }}>{due}</span>
                )}
              </button>
            );
          })}
          {tasks.length > 6 && (
            <div style={{ fontSize: 11, color: 'var(--tx-3)', paddingTop: 8 }}>
              + {tasks.length - 6} more in the task board
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuickLink({ icon: Icon, label, to }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        borderRadius: 8, color: 'var(--tx-1)', textDecoration: 'none',
        background: 'var(--bg-elevated)',
        fontSize: 12.5, fontWeight: 500,
      }}
    >
      <Icon size={14} style={{ color: 'var(--tx-3)' }} />
      <span style={{ flex: 1 }}>{label}</span>
      <ArrowRight size={12} style={{ color: 'var(--tx-3)' }} />
    </Link>
  );
}

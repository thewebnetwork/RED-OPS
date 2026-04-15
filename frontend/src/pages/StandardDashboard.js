/**
 * StandardDashboard — calm, minimal workspace for Standard Users.
 *
 * No agency KPIs, no team performance, no admin controls. Just their
 * own active projects, upcoming tasks, and recent messages. The point
 * is that a Standard User should feel oriented in 2 seconds without
 * being overwhelmed.
 */
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  FolderKanban, CheckSquare, MessageSquare, ArrowRight, Clock,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StandardDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [pRes, tRes, mRes] = await Promise.allSettled([
          ax().get(`${API}/projects`),
          ax().get(`${API}/tasks`),
          ax().get(`${API}/messages/threads`),
        ]);
        if (cancel) return;
        setProjects(pRes.status === 'fulfilled' ? (Array.isArray(pRes.value.data) ? pRes.value.data : []) : []);
        const tData = tRes.status === 'fulfilled' ? (Array.isArray(tRes.value.data) ? tRes.value.data : tRes.value.data?.items || []) : [];
        setTasks(tData);
        setThreads(mRes.status === 'fulfilled' ? (Array.isArray(mRes.value.data) ? mRes.value.data : mRes.value.data?.items || []) : []);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const upcomingTasks = useMemo(() => {
    const open = tasks.filter(t => t.status !== 'done');
    // Sort by due_at ascending (null goes last), then by calendar_date
    return open
      .slice()
      .sort((a, b) => {
        const av = a.due_at || a.calendar_date || '9999';
        const bv = b.due_at || b.calendar_date || '9999';
        return av.localeCompare(bv);
      })
      .slice(0, 6);
  }, [tasks]);

  const activeProjects = useMemo(() => {
    return projects
      .filter(p => p.status !== 'completed' && p.status !== 'archived')
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 4);
  }, [projects]);

  const recentThreads = useMemo(() => {
    return threads
      .slice()
      .sort((a, b) => (b.last_message_at || b.created_at || '').localeCompare(a.last_message_at || a.created_at || ''))
      .slice(0, 5);
  }, [threads]);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page-content" style={{ maxWidth: 880, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '4px 0 24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{greeting}, {firstName}</h1>
        <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>
          {loading
            ? 'Loading…'
            : activeProjects.length === 0 && upcomingTasks.length === 0
              ? 'All quiet. Nothing on your plate right now.'
              : `${activeProjects.length} active project${activeProjects.length === 1 ? '' : 's'} · ${upcomingTasks.length} upcoming task${upcomingTasks.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Active projects */}
      <section style={{ marginBottom: 24 }}>
        <SectionHeader icon={FolderKanban} title="Active projects" linkLabel="All projects" to="/projects" />
        {loading ? null : activeProjects.length === 0 ? (
          <EmptyCard text="No active projects yet." />
        ) : (
          <div className="responsive-grid-2" style={{ gap: 12 }}>
            {activeProjects.map(p => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="card hover-card"
                style={{
                  padding: 16, textDecoration: 'none', color: 'inherit',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                {p.client_name && (
                  <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>{p.client_name}</div>
                )}
                <div>
                  <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${p.progress || 0}%`,
                      background: (p.progress || 0) >= 100 ? 'var(--green)' : 'var(--accent)',
                      borderRadius: 2,
                      transition: 'width .3s',
                    }} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--tx-3)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.completed_task_count || 0}/{p.task_count || 0} tasks</span>
                    <span>{p.progress || 0}%</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming tasks */}
      <section style={{ marginBottom: 24 }}>
        <SectionHeader icon={CheckSquare} title="Upcoming tasks" linkLabel="Task board" to="/task-board" />
        {loading ? null : upcomingTasks.length === 0 ? (
          <EmptyCard text="Nothing scheduled. Enjoy." />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {upcomingTasks.map((t, i) => {
              const due = t.due_at
                ? new Date(t.due_at)
                : t.calendar_date
                  ? new Date(t.calendar_date + 'T00:00:00')
                  : null;
              const dueStr = due ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              const isLast = i === upcomingTasks.length - 1;
              return (
                <button
                  key={t.id}
                  onClick={() => navigate('/task-board')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <Clock size={13} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--tx-1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  {dueStr && (
                    <span style={{ fontSize: 11.5, color: 'var(--tx-3)', flexShrink: 0 }}>{dueStr}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent messages */}
      <section style={{ marginBottom: 32 }}>
        <SectionHeader icon={MessageSquare} title="Recent messages" linkLabel="All messages" to="/conversations" />
        {loading ? null : recentThreads.length === 0 ? (
          <EmptyCard text="No messages yet." />
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {recentThreads.map((t, i) => {
              const title = t.title || t.other_name || 'Conversation';
              const preview = t.last_message_preview || '—';
              const time = relativeTime(t.last_message_at || t.created_at);
              const isLast = i === recentThreads.length - 1;
              return (
                <Link
                  key={t.id}
                  to="/conversations"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {initials(title)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                      <span style={{ fontSize: 11, color: 'var(--tx-3)', flexShrink: 0 }}>{time}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preview}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, linkLabel, to }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={14} style={{ color: 'var(--tx-3)' }} />
        <span className="section-title">{title}</span>
      </div>
      <Link
        to={to}
        style={{ fontSize: 11.5, color: 'var(--tx-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
      >
        {linkLabel} <ArrowRight size={11} />
      </Link>
    </div>
  );
}

function EmptyCard({ text }) {
  return (
    <div className="card" style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--tx-3)' }}>
      {text}
    </div>
  );
}

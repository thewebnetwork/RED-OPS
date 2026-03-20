import { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle2, Clock, Star, Loader2, BarChart3, TrendingUp } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const get = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok ? r.json() : null);

function Avatar({ name, size = 44 }) {
  const ch = (name || '?').charAt(0).toUpperCase();
  const hue = [...(name || 'X')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `hsl(${hue}, 55%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .38, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {ch}
    </div>
  );
}

function WorkloadBar({ value, max, color = 'hsl(var(--primary))' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const barColor = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981';
  return (
    <div style={{ height: 5, background: 'hsl(var(--border))', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width .4s ease' }} />
    </div>
  );
}

export default function Team() {
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, tasksRes] = await Promise.all([
        get('/users?limit=50'),
        get('/tasks?limit=100'),
      ]);
      const allUsers = usersRes?.users || (Array.isArray(usersRes) ? usersRes : []);
      const staff = allUsers.filter(u => u.account_type !== 'Media Client' && u.role !== 'Media Client');
      setMembers(staff);
      const allTasks = tasksRes?.items || tasksRes?.tasks || (Array.isArray(tasksRes) ? tasksRes : []);
      setTasks(allTasks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Augment members with task counts
  const membersWithStats = members.map(m => {
    const myTasks = tasks.filter(t => t.assignee_id === m.id);
    const activeTasks = myTasks.filter(t => !['done', 'backlog'].includes(t.status)).length;
    const doneTasks = myTasks.filter(t => t.status === 'done').length;
    const overdueTasks = myTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
    return { ...m, activeTasks, doneTasks, overdueTasks, totalTasks: myTasks.length };
  });

  const totalActive = tasks.filter(t => t.status === 'doing').length;
  const totalDone = tasks.filter(t => t.status === 'done').length;
  const maxLoad = Math.max(...membersWithStats.map(m => m.activeTasks), 1);

  return (
    <div className="page-content" style={{ animation: 'fadeInUp .3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-1))', letterSpacing: '-.02em' }}>Team Hub</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'hsl(var(--text-3))' }}>Workload and performance by team member</p>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { icon: Users, label: 'Team Members', value: members.length, color: '#3b82f6' },
          { icon: CheckCircle2, label: 'Active Tasks', value: totalActive, color: '#f59e0b' },
          { icon: TrendingUp, label: 'Completed', value: totalDone, color: '#10b981' },
          { icon: BarChart3, label: 'Total Tasks', value: tasks.length, color: '#a855f7' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="metric-card" style={{ cursor: 'default' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="metric-value">{value}</div>
            <div style={{ fontSize: 11.5, color: 'hsl(var(--text-3))', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={24} style={{ color: 'hsl(var(--primary))', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : members.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-3))' }}>
          <Users size={40} style={{ opacity: .2, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'hsl(var(--text-2))' }}>No team members yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Add team members in Settings → Users</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {membersWithStats.map(m => (
            <div
              key={m.id}
              style={{
                background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                borderRadius: 12, padding: '16px', transition: 'border-color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'hsl(var(--primary))'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'hsl(var(--border))'}
            >
              {/* Member info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar name={m.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-1))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  <div style={{ fontSize: 11.5, color: 'hsl(var(--text-3))', marginTop: 1 }}>{m.role}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.activeTasks > 0 ? '#10b981' : '#6b7280', flexShrink: 0 }} title={m.activeTasks > 0 ? 'Active' : 'Idle'} />
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Active', value: m.activeTasks, color: '#f59e0b' },
                  { label: 'Done', value: m.doneTasks, color: '#10b981' },
                  { label: 'Overdue', value: m.overdueTasks, color: m.overdueTasks > 0 ? '#ef4444' : '#6b7280' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: 'hsl(var(--surface-2))', borderRadius: 7 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-3))', marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Workload bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'hsl(var(--text-3))' }}>
                  <span>Workload</span>
                  <span style={{ fontWeight: 600 }}>{m.activeTasks} tasks</span>
                </div>
                <WorkloadBar value={m.activeTasks} max={maxLoad} />
              </div>

              {/* Specialties */}
              {m.specialties?.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {m.specialties.slice(0, 3).map(s => (
                    <span key={s} style={{ fontSize: 10, padding: '2px 6px', background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 4, color: 'hsl(var(--text-3))' }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

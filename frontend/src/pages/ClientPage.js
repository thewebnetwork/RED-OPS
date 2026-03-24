/**
 * ClientPage — Full Client Profile (like ProjectPage)
 *
 * /clients/:id
 *
 * Tabs:
 *   • Overview — client info, health score, plan, contact, portal status
 *   • Tasks — all tasks tagged/assigned to this client
 *   • Projects — all projects with this client_name
 *   • Requests — orders/requests from this client
 *   • Activity & Notes — internal notes + activity log
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ArrowLeft, Users, Mail, Phone, Globe, Building2, CheckCircle2,
  Circle, Send, Clock, Star, Activity, FileText, FolderKanban,
  CheckSquare, MessageSquare, Plus, Search, X, Edit2, ChevronRight,
  Eye, DollarSign, Calendar, Zap, ExternalLink, Tag, Loader2,
  AlertCircle, TrendingUp, ShoppingBag, Layers,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

// ── Helpers ──
const health = s => s >= 70
  ? { color: '#22c55e', label: 'Healthy', bg: '#22c55e18' }
  : s >= 40
  ? { color: '#f59e0b', label: 'Watch', bg: '#f59e0b18' }
  : { color: '#ef4444', label: 'At Risk', bg: '#ef444418' };

const PORTAL_STATUS = {
  active:  { label: 'Portal Active', color: '#22c55e', bg: '#22c55e18', icon: CheckCircle2 },
  invited: { label: 'Invite Sent',   color: '#f59e0b', bg: '#f59e0b18', icon: Send },
  none:    { label: 'No Portal',     color: '#606060', bg: 'var(--bg)',  icon: Circle },
};

const TASK_STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#606060' },
  todo: { label: 'To Do', color: '#3b82f6' },
  doing: { label: 'In Progress', color: '#f59e0b' },
  waiting_on_client: { label: 'Waiting', color: '#a855f7' },
  review: { label: 'Review', color: '#06b6d4' },
  done: { label: 'Done', color: '#22c55e' },
};

const PROJECT_STATUS_CONFIG = {
  planning: { label: 'Planning', color: '#3b82f6' },
  active: { label: 'Active', color: '#22c55e' },
  on_hold: { label: 'On Hold', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#8b5cf6' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high: { label: 'High', color: '#f59e0b' },
  medium: { label: 'Medium', color: '#3b82f6' },
  low: { label: 'Low', color: '#606060' },
};

function timeAgo(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Tabs ──
const TABS = [
  { id: 'overview',  label: 'Overview',  icon: Eye },
  { id: 'tasks',     label: 'Tasks',     icon: CheckSquare },
  { id: 'projects',  label: 'Projects',  icon: FolderKanban },
  { id: 'requests',  label: 'Requests',  icon: ShoppingBag },
  { id: 'notes',     label: 'Notes',     icon: MessageSquare },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function ClientPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  // Data
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Notes (local for now — no backend endpoint)
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`client_notes_${id}`) || '[]'); } catch { return []; }
  });
  const [newNote, setNewNote] = useState('');

  // ── Fetch client ──
  const fetchClient = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await ax().get(`${API}/users/${id}`);
      setClient(data);
    } catch (err) {
      toast.error('Failed to load client');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  // ── Fetch tasks for this client ──
  const fetchTasks = useCallback(async () => {
    if (!client) return;
    setTasksLoading(true);
    try {
      // Fetch all tasks then filter client-related ones
      const { data } = await ax().get(`${API}/tasks`);
      const arr = Array.isArray(data) ? data : data?.items || [];
      // Match tasks that are assigned to this client user or tagged with client name
      const clientTasks = arr.filter(t =>
        t.assigned_to === id ||
        t.assignee_id === id ||
        t.client_id === id ||
        (client.name && t.client_name?.toLowerCase() === client.name?.toLowerCase()) ||
        (client.company_name && t.client_name?.toLowerCase() === client.company_name?.toLowerCase())
      );
      setTasks(clientTasks);
    } catch { setTasks([]); }
    finally { setTasksLoading(false); }
  }, [id, client]);

  // ── Fetch projects for this client ──
  const fetchProjects = useCallback(async () => {
    if (!client) return;
    setProjectsLoading(true);
    try {
      const { data } = await ax().get(`${API}/projects`);
      const arr = Array.isArray(data) ? data : data?.items || [];
      const clientProjects = arr.filter(p =>
        p.client_id === id ||
        (client.name && p.client_name?.toLowerCase() === client.name?.toLowerCase()) ||
        (client.company_name && p.client_name?.toLowerCase() === client.company_name?.toLowerCase())
      );
      setProjects(clientProjects);
    } catch { setProjects([]); }
    finally { setProjectsLoading(false); }
  }, [id, client]);

  // ── Fetch orders/requests ──
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data } = await ax().get(`${API}/orders`);
      const arr = Array.isArray(data) ? data : data?.items || [];
      const clientOrders = arr.filter(o =>
        o.client_id === id || o.created_by === id || o.requested_by === id
      );
      setOrders(clientOrders);
    } catch { setOrders([]); }
    finally { setOrdersLoading(false); }
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);
  useEffect(() => {
    if (client) {
      fetchTasks();
      fetchProjects();
      fetchOrders();
    }
  }, [client, fetchTasks, fetchProjects, fetchOrders]);

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem(`client_notes_${id}`, JSON.stringify(notes));
  }, [notes, id]);

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes(prev => [{ id: `n${Date.now()}`, text: newNote.trim(), author: 'You', ts: new Date().toISOString() }, ...prev]);
    setNewNote('');
    toast.success('Note added');
  };

  const deleteNote = (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  // ── Derived ──
  const clientName = client?.company_name || client?.name || 'Client';
  const portalStatus = client?.active ? 'active' : client?.force_password_change ? 'invited' : 'none';
  const portal = PORTAL_STATUS[portalStatus] || PORTAL_STATUS.none;
  const PortalIcon = portal.icon;
  const scoreVal = 70; // Placeholder until we compute real health score
  const h = health(scoreVal);

  const taskStats = useMemo(() => {
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => ['doing', 'review'].includes(t.status)).length;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
    return { total: tasks.length, done, inProgress, overdue };
  }, [tasks]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 80 }}>
        <Loader2 size={28} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button onClick={() => navigate('/clients')} style={backBtn}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {clientName.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--tx-1)' }}>{clientName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: portal.bg }}>
              <PortalIcon size={12} style={{ color: portal.color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: portal.color }}>{portal.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: h.bg }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: h.color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: h.color }}>{h.label}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {client.email && (
              <span style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={12} /> {client.email}
              </span>
            )}
            {client.phone && (
              <span style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone size={12} /> {client.phone}
              </span>
            )}
            {client.company_name && (
              <span style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building2 size={12} /> {client.company_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Tasks', value: taskStats.total, icon: CheckSquare, color: 'var(--accent)' },
          { label: 'In Progress', value: taskStats.inProgress, icon: Zap, color: 'var(--yellow)' },
          { label: 'Completed', value: taskStats.done, icon: CheckCircle2, color: 'var(--green)' },
          { label: 'Projects', value: projects.length, icon: FolderKanban, color: 'var(--purple)' },
          { label: 'Requests', value: orders.length, icon: ShoppingBag, color: 'var(--blue)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 8, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => {
          const isActive = tab === t.id;
          const count = t.id === 'tasks' ? tasks.length : t.id === 'projects' ? projects.length : t.id === 'requests' ? orders.length : t.id === 'notes' ? notes.length : null;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                background: 'none', border: 'none', borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer', color: isActive ? 'var(--tx-1)' : 'var(--tx-3)',
                fontSize: 13, fontWeight: isActive ? 600 : 500, transition: 'all .12s',
              }}
            >
              <t.icon size={14} />
              {t.label}
              {count !== null && count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: isActive ? 'var(--accent)' : 'var(--bg)', color: isActive ? '#fff' : 'var(--tx-3)' }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════ */}
      {/* TAB CONTENT */}
      {/* ═══════════════════════════════════ */}

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Client Info */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--tx-1)' }}>Client Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Name', client.name],
                ['Email', client.email],
                ['Phone', client.phone || '—'],
                ['Company', client.company_name || '—'],
                ['Industry', client.industry || '—'],
                ['Website', client.website || '—'],
                ['Role', client.role],
                ['Account Type', client.account_type],
                ['Plan', client.subscription_plan_name || '—'],
                ['Joined', client.created_at ? new Date(client.created_at).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Active Tasks Summary */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--tx-1)' }}>Task Summary</h3>
              {tasks.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>No tasks assigned to this client yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(TASK_STATUS_CONFIG).map(([key, cfg]) => {
                    const count = tasks.filter(t => t.status === key).length;
                    if (count === 0) return null;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: 'var(--tx-2)', flex: 1 }}>{cfg.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Active Projects Summary */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', color: 'var(--tx-1)' }}>Project Summary</h3>
              {projects.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>No projects linked to this client yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {projects.slice(0, 5).map(p => {
                    const st = PROJECT_STATUS_CONFIG[p.status] || { label: p.status, color: 'var(--tx-3)' };
                    return (
                      <div key={p.id || p._id} onClick={() => navigate(`/projects/${p.id || p._id}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background .12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <FolderKanban size={14} style={{ color: st.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${st.color}18`, color: st.color }}>{st.label}</span>
                        <ChevronRight size={12} style={{ color: 'var(--tx-3)' }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tasks Tab ── */}
      {tab === 'tasks' && (
        <div>
          {tasksLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
          ) : tasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No tasks yet" subtitle="Tasks assigned to this client will appear here" />
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {tasks.map((task, i) => {
                const st = TASK_STATUS_CONFIG[task.status] || { label: task.status, color: 'var(--tx-3)' };
                const pri = PRIORITY_CONFIG[task.priority] || { label: task.priority, color: 'var(--tx-3)' };
                return (
                  <div key={task.id || task._id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: i < tasks.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => navigate('/tasks')}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        {task.project_name && <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{task.project_name}</span>}
                        {task.assignee_name && <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>→ {task.assignee_name}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${pri.color}18`, color: pri.color, flexShrink: 0 }}>{pri.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${st.color}18`, color: st.color, flexShrink: 0 }}>{st.label}</span>
                    {task.due_date && (
                      <span style={{ fontSize: 11, color: new Date(task.due_date) < new Date() && task.status !== 'done' ? 'var(--red)' : 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        <Clock size={11} /> {timeAgo(task.due_date)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Projects Tab ── */}
      {tab === 'projects' && (
        <div>
          {projectsLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
          ) : projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No projects yet" subtitle="Projects linked to this client will appear here" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {projects.map(project => {
                const st = PROJECT_STATUS_CONFIG[project.status] || { label: project.status, color: 'var(--tx-3)' };
                const pri = PRIORITY_CONFIG[project.priority] || { label: project.priority, color: 'var(--tx-3)' };
                const progress = project.progress || 0;
                return (
                  <div
                    key={project.id || project._id}
                    onClick={() => navigate(`/projects/${project.id || project._id}`)}
                    style={{
                      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
                      padding: 0, cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = st.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ height: 3, background: st.color }} />
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <FolderKanban size={18} style={{ color: st.color, marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{project.name}</h3>
                          {project.description && (
                            <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description}</p>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${st.color}18`, color: st.color }}>{st.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${pri.color}18`, color: pri.color }}>{pri.label}</span>
                        {project.due_date && (
                          <span style={{ fontSize: 10, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Calendar size={10} /> {new Date(project.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: st.color, borderRadius: 2, transition: 'width .3s' }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4, display: 'block' }}>{progress}% complete</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Requests Tab ── */}
      {tab === 'requests' && (
        <div>
          {ordersLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No requests yet" subtitle="Service requests from this client will appear here" />
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {orders.map((order, i) => (
                <div key={order.id || order._id}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: i < orders.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background .12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ShoppingBag size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', display: 'block' }}>{order.title || order.service_name || 'Request'}</span>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{order.category_name || ''} · {timeAgo(order.created_at)}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--bg)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>{order.status || 'Open'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Notes Tab ── */}
      {tab === 'notes' && (
        <div>
          {/* Add note */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add an internal note about this client..."
              style={{ flex: 1, padding: '10px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--tx-1)', fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 60 }}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote(); }}
            />
            <button onClick={addNote} style={{ ...btnPrimary, alignSelf: 'flex-end', height: 40 }}>
              <Plus size={14} /> Add
            </button>
          </div>

          {notes.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No notes yet" subtitle="Add internal notes about this client" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map(note => (
                <div key={note.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', borderLeft: '3px solid var(--purple)' }}>
                  <div style={{ fontSize: 13, color: 'var(--tx-1)', lineHeight: 1.6, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{note.text}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                      <strong>{note.author}</strong> · {timeAgo(note.ts)}
                    </span>
                    <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2 }} title="Delete note">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty State ──
function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <Icon size={24} style={{ color: 'var(--tx-3)', opacity: 0.5 }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-2)', margin: '0 0 4px' }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>{subtitle}</p>
    </div>
  );
}

// ── Styles ──
const backBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 38, height: 38, borderRadius: 10, background: 'var(--card)',
  border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--tx-2)',
  transition: 'all .12s',
};
const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

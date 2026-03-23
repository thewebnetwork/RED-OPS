import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  FolderKanban, Plus, Calendar, Users, CheckSquare, ChevronRight,
  Circle, Clock, Folder, X, Edit3, Save, Trash2, CheckCircle2,
  ArrowRight, MoreHorizontal, AlertCircle, Target, BarChart3,
  Layers, FileText, Activity, Loader2, CreditCard,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

// ── Config ───────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  campaign_build:     { label: 'Campaign Build',     color: '#a855f7', bg: '#a855f718' },
  client_onboarding:  { label: 'Client Onboarding',  color: '#3b82f6', bg: '#3b82f618' },
  creative_sprint:    { label: 'Creative Sprint',    color: '#22c55e', bg: '#22c55e18' },
  internal:           { label: 'Internal',           color: '#606060', bg: '#60606018' },
  retainer:           { label: 'Retainer',           color: '#f59e0b', bg: '#f59e0b18' },
  one_off:            { label: 'One-Off',            color: '#06b6d4', bg: '#06b6d418' },
  custom:             { label: 'Custom',             color: '#8b5cf6', bg: '#8b5cf618' },
};

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: '#22c55e', icon: Circle },
  planning:  { label: 'Planning',  color: '#f59e0b', icon: Clock },
  completed: { label: 'Completed', color: '#3b82f6', icon: CheckSquare },
  on_hold:   { label: 'On Hold',   color: '#c92a3e', icon: AlertCircle },
  archived:  { label: 'Archived',  color: '#606060', icon: FileText },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high:   { label: 'High',   color: '#f59e0b' },
  medium: { label: 'Medium', color: '#3b82f6' },
  low:    { label: 'Low',    color: '#606060' },
};

const PAYMENT_OPTIONS = [
  { value: 'not_applicable', label: 'N/A' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

const TYPE_OPTIONS = Object.keys(TYPE_CONFIG);
const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

// ── UI Components ────────────────────────────────────────────────────────────
function TypePill({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.custom;
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cfg.label}</span>;
}

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: cfg.color }}>
      <cfg.icon size={11} /> {cfg.label}
    </span>
  );
}

function PaymentPill({ status }) {
  const colors = { paid: '#22c55e', partial: '#f59e0b', unpaid: '#ef4444', not_applicable: 'var(--tx-3)' };
  const labels = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', not_applicable: '—' };
  if (status === 'not_applicable') return null;
  const c = colors[status] || 'var(--tx-3)';
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${c}22`, color: c }}>{labels[status]}</span>;
}

// ── New / Edit Modal ─────────────────────────────────────────────────────────
function ProjectModal({ project, onClose, onSave, loading }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    name:           project?.name || '',
    project_type:   project?.project_type || 'custom',
    client_name:    project?.client_name || '',
    due_date:       project?.due_date ? project.due_date.substring(0, 10) : '',
    status:         project?.status || 'planning',
    priority:       project?.priority || 'medium',
    description:    project?.description || '',
    payment_status: project?.payment_status || 'not_applicable',
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Project name is required.'); return; }
    const payload = {
      ...form,
      due_date: form.due_date ? new Date(form.due_date + 'T00:00:00Z').toISOString() : null,
    };
    onSave(payload);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{isEdit ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Project Name *</label>
            <input className="input-field" autoFocus placeholder="e.g. Thompson RE — April Campaign" value={form.name} onChange={e => f('name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select className="input-field" value={form.project_type} onChange={e => f('project_type', e.target.value)}>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="input-field" value={form.status} onChange={e => f('status', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select className="input-field" value={form.priority} onChange={e => f('priority', e.target.value)}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Payment Status</label>
              <select className="input-field" value={form.payment_status} onChange={e => f('payment_status', e.target.value)}>
                {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Client</label>
            <input className="input-field" placeholder="Client name (optional)" value={form.client_name} onChange={e => f('client_name', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" className="input-field" value={form.due_date} onChange={e => f('due_date', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea className="input-field" rows={3} placeholder="What this project delivers..." value={form.description} onChange={e => f('description', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button className="btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── (Legacy) Milestone Manager — moved to ProjectPage.js ─────────────────────
// eslint-disable-next-line no-unused-vars
function LegacyMilestoneSection({ project, onToggle, onAdd, onDelete }) {
  const [newLabel, setNewLabel] = useState('');
  const completedMilestones = (project.milestones || []).filter(m => m.done).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Milestones ({completedMilestones}/{(project.milestones || []).length})
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input className="input-field" placeholder="Add milestone..." value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newLabel.trim()) { onAdd(newLabel.trim()); setNewLabel(''); } }}
          style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} />
        <button className="btn-primary btn-sm" onClick={() => { if (newLabel.trim()) { onAdd(newLabel.trim()); setNewLabel(''); } }}
          style={{ padding: '6px 12px' }}><Plus size={12} /></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {(project.milestones || []).map((m, i) => (
          <div key={m.id} style={{ display: 'flex', gap: 10, paddingBottom: 12, position: 'relative' }}>
            {i < (project.milestones || []).length - 1 && (
              <div style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 2, background: m.done ? '#22c55e30' : 'var(--border)' }} />
            )}
            <button onClick={() => onToggle(m.id)}
              style={{ width: 24, height: 24, borderRadius: '50%', border: m.done ? 'none' : '2px solid var(--border)', background: m.done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, position: 'relative', zIndex: 1, transition: 'all .15s' }}>
              {m.done && <CheckCircle2 size={14} color="#fff" />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: m.done ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: m.done ? 'line-through' : 'none' }}>
                {m.label}
              </div>
            </div>
            <button onClick={() => onDelete(m.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, opacity: 0.5 }}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {(project.milestones || []).length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 12, color: 'var(--tx-3)' }}>
            No milestones yet
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────
function ProjectDetail({ project, onClose, onDelete, onRefresh }) {
  const [tab, setTab] = useState('overview');
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const completedMilestones = (project.milestones || []).filter(m => m.done).length;

  // Load project tasks
  useEffect(() => {
    if (tab === 'tasks') {
      setLoadingTasks(true);
      ax().get(`${API}/projects/${project.id}/tasks`)
        .then(r => setTasks(r.data))
        .catch(() => toast.error('Failed to load tasks'))
        .finally(() => setLoadingTasks(false));
    }
  }, [tab, project.id]);

  const handleToggleMilestone = async (mId) => {
    try {
      await ax().patch(`${API}/projects/${project.id}/milestones/${mId}`);
      onRefresh();
    } catch { toast.error('Failed to toggle milestone'); }
  };

  const handleAddMilestone = async (label) => {
    try {
      await ax().post(`${API}/projects/${project.id}/milestones`, { label });
      onRefresh();
    } catch { toast.error('Failed to add milestone'); }
  };

  const handleDeleteMilestone = async (mId) => {
    try {
      await ax().delete(`${API}/projects/${project.id}/milestones/${mId}`);
      onRefresh();
    } catch { toast.error('Failed to delete milestone'); }
  };

  const toggleTaskDone = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await ax().patch(`${API}/tasks/${taskId}`, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      onRefresh();
    } catch { toast.error('Failed to update task'); }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'tasks', label: `Tasks (${project.task_count || 0})`, icon: CheckSquare },
    { id: 'milestones', label: `Milestones (${(project.milestones || []).length})`, icon: Target },
  ];

  return (
    <div style={{ width: 480, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', background: 'var(--bg-card)', animation: 'slideRight 0.18s ease both' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <TypePill type={project.project_type} />
              <StatusDot status={project.status} />
              <PaymentPill status={project.payment_status} />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 4px', lineHeight: 1.3 }}>{project.name}</h2>
            {project.client_name && (
              <div style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Folder size={11} /> {project.client_name}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}>
            <X size={15} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{project.completed_task_count || 0}/{project.task_count || 0} tasks</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-1)' }}>{project.progress || 0}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${project.progress || 0}%`, background: project.progress === 100 ? '#22c55e' : 'var(--red)', borderRadius: 3, transition: 'width .3s' }} />
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--tx-3)' }}>
          <span><Calendar size={10} style={{ marginRight: 3 }} /> Due {project.due_date ? new Date(project.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '—'}</span>
          <span><Users size={10} style={{ marginRight: 3 }} /> {(project.team_members || []).length} members</span>
          <span><Target size={10} style={{ marginRight: 3 }} /> {completedMilestones}/{(project.milestones || []).length} milestones</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 12, marginBottom: -1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '6px 4px 8px', background: 'transparent', border: 'none', borderBottom: tab === t.id ? '2px solid var(--red)' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .12s' }}>
              <t.icon size={11} color={tab === t.id ? 'var(--red)' : 'var(--tx-3)'} />
              <span style={{ fontSize: 11, fontWeight: 600, color: tab === t.id ? 'var(--tx-1)' : 'var(--tx-3)' }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {project.description && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Description</div>
                <div style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.6, background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 8 }}>
                  {project.description}
                </div>
              </div>
            )}

            {/* Team */}
            {(project.team_members || []).length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Team</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(project.team_members || []).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 7 }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>
                        {(m.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--tx-1)', fontWeight: 500 }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Progress', value: `${project.progress || 0}%`, color: project.progress === 100 ? '#22c55e' : 'var(--red)' },
                { label: 'Tasks Done', value: `${project.completed_task_count || 0}/${project.task_count || 0}`, color: '#22c55e' },
                { label: 'Milestones', value: `${completedMilestones}/${(project.milestones || []).length}`, color: '#a855f7' },
                { label: 'Due Date', value: project.due_date ? new Date(project.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—', color: '#06b6d4' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Delete */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', gap: 4, color: '#ef4444', borderColor: '#ef444430' }}
                onClick={() => { if (window.confirm('Delete this project and all its tasks?')) onDelete(project.id); }}>
                <Trash2 size={11} /> Delete Project
              </button>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingTasks && (
              <div style={{ padding: 32, textAlign: 'center' }}><Loader2 size={20} className="spin" color="var(--tx-3)" /></div>
            )}
            {!loadingTasks && tasks.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 10 }}>
                <CheckSquare size={24} color="var(--tx-3)" style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>No tasks yet. Create tasks from the Tasks page and link them to this project.</p>
              </div>
            )}
            {tasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <button onClick={() => toggleTaskDone(t.id, t.status)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.status === 'done' ? '#22c55e' : 'var(--tx-3)', padding: 0, flexShrink: 0, display: 'flex' }}>
                  {t.status === 'done' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: t.status === 'done' ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: t.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 2, display: 'flex', gap: 8 }}>
                    {t.assignee_name && <span>{t.assignee_name}</span>}
                    {t.due_at && <span>Due: {new Date(t.due_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: t.status === 'done' ? '#22c55e22' : '#3b82f622', color: t.status === 'done' ? '#22c55e' : '#3b82f6' }}>{t.status}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'milestones' && (
          <MilestoneSection
            project={project}
            onToggle={handleToggleMilestone}
            onAdd={handleAddMilestone}
            onDelete={handleDeleteMilestone}
          />
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/projects`);
      setProjects(r.data);
    } catch (err) {
      if (err.response?.status !== 401) toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Open new modal if ?new=1
  useEffect(() => { if (searchParams.get('new') === '1') setModal('new'); }, [searchParams]);

  const filtered = useMemo(() => {
    return projects
      .filter(p => filter === 'All' || p.project_type === filter)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.client_name || '').toLowerCase().includes(search.toLowerCase()));
  }, [filter, search, projects]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal && typeof modal === 'object' && modal.id) {
        await ax().patch(`${API}/projects/${modal.id}`, form);
        toast.success('Project updated');
      } else {
        const r = await ax().post(`${API}/projects`, form);
        toast.success(`${form.name} created`);
        navigate(`/projects/${r.data.id}`);
      }
      setModal(null);
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await ax().delete(`${API}/projects/${id}`);
      toast.success('Project deleted');
      fetchProjects();
    } catch {
      toast.error('Failed to delete project');
    }
  };

  const formatDate = d => d ? new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '—';
  const daysLeft = d => {
    if (!d) return 999;
    return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  };

  // Stats
  const activeCount = projects.filter(p => p.status === 'active').length;
  const planningCount = projects.filter(p => p.status === 'planning').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const totalTasks = projects.reduce((s, p) => s + (p.task_count || 0), 0);
  const doneTasks = projects.reduce((s, p) => s + (p.completed_task_count || 0), 0);

  if (loading) {
    return (
      <div className="page-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="spin" color="var(--tx-3)" />
      </div>
    );
  }

  return (
    <div className="page-fill" style={{ flexDirection: 'row' }}>
      {modal && (
        <ProjectModal
          project={typeof modal === 'object' ? modal : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
          loading={saving}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>Projects</h1>
          <span style={{ fontSize: 12, color: 'var(--tx-3)', padding: '2px 8px', background: 'var(--bg-elevated)', borderRadius: 10 }}>{filtered.length}</span>
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', fontSize: 12.5, color: 'var(--tx-1)', outline: 'none', width: 180 }} />
          </div>
          <button onClick={() => setModal('new')} className="btn-primary btn-sm" style={{ gap: 5 }}>
            <Plus size={13} /> New Project
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 0, padding: '8px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[
            { label: 'Active', value: activeCount, color: '#22c55e' },
            { label: 'Planning', value: planningCount, color: '#f59e0b' },
            { label: 'Completed', value: completedCount, color: '#3b82f6' },
            { label: 'Tasks Done', value: `${doneTasks}/${totalTasks}`, color: 'var(--tx-1)' },
          ].map((m, i) => (
            <div key={i} style={{ paddingRight: 20, marginRight: 20, borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 1 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {['All', ...TYPE_OPTIONS].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filter === f ? 'var(--red)' : 'var(--border)', background: filter === f ? 'var(--red-bg)' : 'transparent', color: filter === f ? 'var(--red)' : 'var(--tx-3)', transition: 'all .1s' }}>
              {f === 'All' ? 'All' : (TYPE_CONFIG[f] || {}).label || f}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, alignContent: 'start' }}>
          {filtered.map(p => {
            const dl = daysLeft(p.due_date);

            return (
              <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                className="card" style={{ padding: '16px 18px', cursor: 'pointer', transition: 'all .12s' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TypePill type={p.project_type} />
                    <StatusDot status={p.status} />
                    <PaymentPill status={p.payment_status} />
                  </div>
                  <button onClick={e => { e.stopPropagation(); setModal(p); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2 }}>
                    <Edit3 size={12} />
                  </button>
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 4px', lineHeight: 1.3 }}>{p.name}</h3>
                {p.client_name && (
                  <div style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                    <Folder size={10} /> {p.client_name}
                  </div>
                )}

                {/* Progress */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{p.completed_task_count || 0}/{p.task_count || 0} tasks</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-1)' }}>{p.progress || 0}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.progress || 0}%`, background: p.progress === 100 ? '#22c55e' : 'var(--red)', borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: -4 }}>
                    {(p.team_members || []).slice(0, 3).map((m, i) => (
                      <div key={m.id} style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)', border: '2px solid var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--tx-1)', marginLeft: i > 0 ? -6 : 0, zIndex: 3 - i, position: 'relative' }} title={m.name}>
                        {(m.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                    ))}
                    {(p.team_members || []).length > 3 && <span style={{ fontSize: 10, color: 'var(--tx-3)', marginLeft: 4 }}>+{(p.team_members || []).length - 3}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: dl <= 7 ? '#ef4444' : dl <= 14 ? '#f59e0b' : 'var(--tx-3)', fontWeight: dl <= 14 ? 600 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={10} /> {formatDate(p.due_date)}
                    {dl <= 14 && dl > 0 && <span>({dl}d)</span>}
                    {dl <= 0 && p.due_date && <span style={{ color: '#ef4444' }}>Overdue</span>}
                  </span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:0.5 }}>📋</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--tx-1)', marginBottom:6 }}>
                {projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
              </div>
              <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 auto', maxWidth: 360 }}>
                {projects.length === 0 ? 'Projects organize tasks, deadlines, and deliverables for each client engagement.' : 'Try adjusting your search or filters.'}
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

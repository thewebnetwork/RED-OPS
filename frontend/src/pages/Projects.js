/**
 * Projects Hub — Full project management listing
 *
 * Features:
 *   • Summary KPI bar (active, planning, completed, on hold, task progress)
 *   • Search + multi-filters (status, type, priority, payment)
 *   • View toggle: cards / table (persisted)
 *   • Group by: none / status / type / client
 *   • Polished project cards with progress, team, deadlines
 *   • Table view with inline stats
 *   • Sort options
 *   • New/Edit project modal
 *   • Clean empty states
 *
 * Admin Feature:
 *   • AdminProjectsHub for admins: client-grouped project view with KPIs
 *   • Auto-created project indicators (service_request source)
 *   • Client linking and health metrics
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  FolderKanban, Plus, Calendar, Users, CheckSquare, ChevronRight,
  Circle, Clock, Folder, X, Edit3, Trash2, CheckCircle2,
  MoreHorizontal, AlertCircle, Target, BarChart3,
  Layers, FileText, Activity, Loader2, CreditCard,
  Search, Grid3X3, List, ChevronDown, ArrowUpDown,
  TrendingUp, Pause, Archive, Filter, Hash, Zap, ChevronUp,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

/* ── Helpers ── */
const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
const AVATAR_COLORS = ['#c92a3e','#7c3aed','#2563eb','#059669','#d97706','#0891b2','#db2777','#65a30d'];
const avatarBg = (id) => AVATAR_COLORS[(typeof id === 'string' ? id.charCodeAt(0) + (id.charCodeAt(1) || 0) : id) % AVATAR_COLORS.length];

const formatDate = d => d ? new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '—';
const formatDateLong = d => d ? new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const daysUntil = d => {
  if (!d) return 999;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
};

const isOverdue = (due) => due && new Date(due) < new Date() ? true : false;
const isThisMonth = (d) => {
  if (!d) return false;
  const now = new Date();
  const date = new Date(d);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

/* ── Config ── */
const TYPE_CONFIG = {
  campaign_build:    { label: 'Campaign Build',    color: '#a855f7', bg: '#a855f718', icon: Target },
  client_onboarding: { label: 'Client Onboarding', color: '#3b82f6', bg: '#3b82f618', icon: Users },
  creative_sprint:   { label: 'Creative Sprint',   color: '#22c55e', bg: '#22c55e18', icon: Activity },
  internal:          { label: 'Internal',           color: '#606060', bg: '#60606018', icon: Layers },
  retainer:          { label: 'Retainer',           color: '#f59e0b', bg: '#f59e0b18', icon: Clock },
  one_off:           { label: 'One-Off',            color: '#06b6d4', bg: '#06b6d418', icon: FileText },
  custom:            { label: 'Custom',             color: '#8b5cf6', bg: '#8b5cf618', icon: FolderKanban },
};

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: '#22c55e', icon: Circle,      bg: '#22c55e15' },
  planning:  { label: 'Planning',  color: '#f59e0b', icon: Clock,       bg: '#f59e0b15' },
  completed: { label: 'Completed', color: '#3b82f6', icon: CheckSquare, bg: '#3b82f615' },
  on_hold:   { label: 'On Hold',   color: '#ef4444', icon: Pause,       bg: '#ef444415' },
  archived:  { label: 'Archived',  color: '#606060', icon: Archive,     bg: '#60606015' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: '#ef444418' },
  high:   { label: 'High',   color: '#f59e0b', bg: '#f59e0b18' },
  medium: { label: 'Medium', color: '#3b82f6', bg: '#3b82f618' },
  low:    { label: 'Low',    color: '#606060', bg: '#60606018' },
};

const PAYMENT_OPTIONS = [
  { value: 'not_applicable', label: 'N/A' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name', label: 'Name A→Z' },
  { value: 'due_soon', label: 'Due Soonest' },
  { value: 'progress', label: 'Progress ↑' },
  { value: 'progress_desc', label: 'Progress ↓' },
];

const GROUP_OPTIONS = [
  { value: 'none', label: 'No Grouping' },
  { value: 'status', label: 'By Status' },
  { value: 'type', label: 'By Type' },
  { value: 'client', label: 'By Client' },
  { value: 'priority', label: 'By Priority' },
];

const TYPE_OPTIONS = Object.keys(TYPE_CONFIG);
const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

/* ═══════════════════════════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function TypePill({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.custom;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg?.icon || Circle;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: cfg?.bg || 'var(--bg-elevated)', color: cfg?.color || 'var(--tx-2)', whiteSpace: 'nowrap' }}>
      <Icon size={10} /> {cfg?.label || status}
    </span>
  );
}

function PriorityDot({ priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: cfg?.color || 'var(--tx-2)' }}>
      <Circle size={8} fill={cfg?.color || 'currentColor'} color={cfg?.color || 'currentColor'} /> {cfg?.label}
    </span>
  );
}

function PaymentPill({ status }) {
  const opt = PAYMENT_OPTIONS.find(o => o.value === status);
  const colors = { paid: '#22c55e', partial: '#f59e0b', unpaid: '#ef4444', not_applicable: '#606060' };
  const color = colors[status] || '#606060';
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: color + '18', color: color, whiteSpace: 'nowrap' }}>
      {opt?.label || status}
    </span>
  );
}

function ProgressBar({ progress, size = 'md' }) {
  const percent = progress || 0;
  const height = size === 'lg' ? 6 : size === 'sm' ? 2 : 4;
  const color = percent < 33 ? '#ef4444' : percent < 66 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ width: '100%', height, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: percent + '%', background: color, transition: 'width 0.3s ease' }} />
    </div>
  );
}

function AvatarStack({ members = [], max = 4 }) {
  const shown = members.slice(0, max);
  const hidden = Math.max(0, members.length - max);
  return (
    <div style={{ display: 'flex', gap: -6, alignItems: 'center' }}>
      {shown.map((m, i) => (
        <div key={i} style={{
          width: 24, height: 24, borderRadius: '50%', background: avatarBg(m.id || m),
          color: 'white', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--bg)', marginLeft: i > 0 ? -8 : 0,
        }} title={m.name || m}>
          {initials(m.name || m)}
        </div>
      ))}
      {hidden > 0 && (
        <div style={{
          width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -6,
        }} title={`+${hidden} more`}>
          +{hidden}
        </div>
      )}
    </div>
  );
}

function DeadlineTag({ dueDate }) {
  if (!dueDate) return <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>No deadline</span>;
  const days = daysUntil(dueDate);
  const overdue = days < 0;
  const urgent = days <= 3 && days >= 0;
  const color = overdue ? '#ef4444' : urgent ? '#f59e0b' : '#3b82f6';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color }}>
      <Calendar size={11} />
      {overdue ? `${Math.abs(days)}d overdue` : urgent ? `${days}d left` : `${days}d away`}
    </span>
  );
}

function KpiBar({ projects }) {
  const active = projects.filter(p => p.status === 'active').length;
  const planning = projects.filter(p => p.status === 'planning').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const onHold = projects.filter(p => p.status === 'on_hold').length;
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((a, p) => a + (p.progress || 0), 0) / projects.length) : 0;
  const totalTasks = projects.reduce((a, p) => a + (p.task_count || 0), 0);
  const completedTasks = projects.reduce((a, p) => a + (p.completed_task_count || 0), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
      {[
        { label: 'Active', value: active, color: '#22c55e' },
        { label: 'Planning', value: planning, color: '#f59e0b' },
        { label: 'Completed', value: completed, color: '#3b82f6' },
        { label: 'On Hold', value: onHold, color: '#ef4444' },
        { label: 'Avg Progress', value: avgProgress + '%', color: '#8b5cf6' },
        { label: 'Task Completion', value: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) + '%' : '0%', color: '#06b6d4' },
      ].map((kpi, i) => (
        <div key={i} style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>{kpi.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProjectCard({ project, onEdit, onClick }) {
  const typeConfig = TYPE_CONFIG[project.project_type] || TYPE_CONFIG.custom;
  const TypeIcon = typeConfig.icon;
  const statusCfg = STATUS_CONFIG[project.status];
  const overdue = isOverdue(project.due_date) && project.status !== 'completed';

  return (
    <div
      onClick={onClick}
      style={{
        padding: 14, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)',
        cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 4 }}>{project.name}</h4>
          {project.client_name && (
            <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0, marginBottom: 6 }}>{project.client_name}</p>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <TypePill type={project.project_type} />
            <StatusBadge status={project.status} />
            {project.source === 'service_request' && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#f59e0b18', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
                <Zap size={9} /> Auto
              </span>
            )}
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onEdit(project); }} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 0, fontSize: 16 }}>
          <MoreHorizontal size={14} />
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 4, fontWeight: 600 }}>Progress</div>
        <ProgressBar progress={project.progress} size="md" />
        <span style={{ fontSize: 9, color: 'var(--tx-3)', marginTop: 3, display: 'block' }}>{project.progress || 0}%</span>
      </div>

      {project.team_members && project.team_members.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 6, fontWeight: 600 }}>Team</div>
          <AvatarStack members={project.team_members} max={4} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <DeadlineTag dueDate={project.due_date} />
        <PriorityDot priority={project.priority} />
      </div>
    </div>
  );
}

function ProjectTableRow({ project, onEdit, onClick }) {
  const progress = project.progress || 0;
  const overdue = isOverdue(project.due_date) && project.status !== 'completed';
  const color = overdue ? '#ef4444' : progress < 33 ? '#ef4444' : progress < 66 ? '#f59e0b' : '#22c55e';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 100px 100px',
        gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
        alignItems: 'center', transition: 'background 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--tx-1)' }}>{project.name}</div>
        {project.client_name && <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{project.client_name}</div>}
      </div>
      <div><TypePill type={project.project_type} /></div>
      <div><StatusBadge status={project.status} /></div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color }}>{progress}%</div>
        <ProgressBar progress={progress} size="sm" />
      </div>
      <DeadlineTag dueDate={project.due_date} />
      <PriorityDot priority={project.priority} />
      <button onClick={(e) => { e.stopPropagation(); onEdit(project); }} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 0 }}>
        <MoreHorizontal size={14} />
      </button>
    </div>
  );
}

function GroupHeader({ label, count, color, collapsed, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-elevated)',
        border: '1px solid var(--border)', borderLeft: `4px solid ${color || 'var(--border)'}`, borderRadius: 6,
        cursor: 'pointer', marginBottom: 10, userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
    >
      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, background: color + '20', color, padding: '2px 8px', borderRadius: 4 }}>
        {count}
      </span>
    </div>
  );
}

function ProjectModal({ project, onClose, onSave, onDelete, loading, clients = [], teamMembers = [] }) {
  const [form, setForm] = useState(() => {
    const init = project || {};
    return { ...init, team_member_ids: init.team_member_ids || (init.team_members || []).map(m => m.id) || [] };
  });
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [mode, setMode] = useState('manual'); // 'manual' | 'template'

  useEffect(() => {
    if (!project) {
      ax().get(`${API}/project-templates`).then(r => setTemplates(r.data || [])).catch(() => {});
    }
  }, [project]);

  const handleChange = (field, value) => { setForm(f => ({ ...f, [field]: value })); };
  const toggleTeamMember = (userId) => {
    setForm(f => {
      const ids = f.team_member_ids || [];
      return { ...f, team_member_ids: ids.includes(userId) ? ids.filter(id => id !== userId) : [...ids, userId] };
    });
  };

  const handleSave = async () => {
    if (mode === 'template') {
      if (!selectedTemplate) return toast.error('Select a template');
      try {
        const res = await ax().post(`${API}/project-templates/${selectedTemplate.id}/apply`, {
          client_id: form.client_id || null,
          client_name: form.client_name || form.name || '',
          start_date: new Date().toISOString(),
        });
        toast.success(`Created project with ${res.data.tasks_created} tasks`);
        onSave(null);
        onClose();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Failed to apply template');
      }
      return;
    }

    if (!form.name?.trim()) return toast.error('Project name required');
    await onSave(form);
    onClose();
  };

  const TEMPLATE_TYPES = [
    { key: 'engagement', label: 'Client Engagements', icon: '🤝' },
    { key: 'content', label: 'Content Production', icon: '🎥' },
    { key: 'campaign', label: 'Campaigns', icon: '📣' },
    { key: 'funnel', label: 'Funnels', icon: '🎬' },
    { key: 'process', label: 'Processes', icon: '🔄' },
    { key: 'internal', label: 'Internal Ops', icon: '⚙️' },
  ];

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 12, maxWidth: 520, width: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 20 }}><X /></button>
        </div>

        {/* Tab bar — only on new project */}
        {!project && templates.length > 0 && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'manual', label: 'Create Manual' },
              { id: 'template', label: 'From Template' },
            ].map(tab => (
              <button key={tab.id} onClick={() => { setMode(tab.id); if (tab.id === 'manual') setSelectedTemplate(null); }}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: 13, fontWeight: mode === tab.id ? 700 : 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: mode === tab.id ? 'var(--accent)' : 'var(--tx-3)',
                  borderBottom: `2px solid ${mode === tab.id ? 'var(--accent)' : 'transparent'}`,
                  transition: 'all .15s',
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Template picker (only in template mode) ── */}
          {mode === 'template' && !project && (
            <div>
              {TEMPLATE_TYPES.map(type => {
                const group = templates.filter(t => (t.type || 'engagement') === type.key);
                if (!group.length) return null;
                return (
                  <div key={type.key} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                      {type.icon} {type.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {group.map(t => (
                        <button key={t.id} type="button" onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                          style={{
                            textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid',
                            borderColor: selectedTemplate?.id === t.id ? 'var(--accent)' : 'var(--border)',
                            background: selectedTemplate?.id === t.id ? 'rgba(201,42,62,0.08)' : 'var(--surface-2)',
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{t.icon || '📋'} {t.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{t.tasks?.length || 0} tasks</span>
                          </div>
                          {t.description && <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 3 }}>{t.description}</div>}
                          {selectedTemplate?.id === t.id && (
                            <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 6, fontWeight: 600 }}>
                              ✓ {t.phases?.length || 0} phases · {t.tasks?.length || 0} tasks will be created
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Client selector for template mode */}
              {selectedTemplate && (
                <div style={{ marginTop: 4 }}>
                  <label style={labelStyle}>Assign to Client (optional)</label>
                  <select value={form.client_id || ''} onChange={e => {
                    const sel = clients.find(c => (c.id || c._id) === e.target.value);
                    handleChange('client_id', e.target.value || null);
                    handleChange('client_name', sel?.name || sel?.company_name || '');
                  }} className="input-field">
                    <option value="">No client (internal project)</option>
                    {clients.map(c => <option key={c.id || c._id} value={c.id || c._id}>{c.company_name || c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── Manual form fields (only in manual mode or editing) ── */}
          {(mode === 'manual' || project) && (
            <>
          <div>
            <label style={labelStyle}>Project Name</label>
            <input type="text" value={form.name || ''} onChange={e => handleChange('name', e.target.value)} placeholder="Project name" className="input-field" />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description || ''} onChange={e => handleChange('description', e.target.value)} placeholder="Project description" className="input-field" style={{ minHeight: 80, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status || 'planning'} onChange={e => handleChange('status', e.target.value)} className="input-field">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.project_type || 'custom'} onChange={e => handleChange('project_type', e.target.value)} className="input-field">
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select value={form.priority || 'medium'} onChange={e => handleChange('priority', e.target.value)} className="input-field">
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Payment Status</label>
              <select value={form.payment_status || 'not_applicable'} onChange={e => handleChange('payment_status', e.target.value)} className="input-field">
                {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={form.due_date ? form.due_date.split('T')[0] : ''} onChange={e => handleChange('due_date', e.target.value ? new Date(e.target.value).toISOString() : null)} className="input-field" />
          </div>

          <div>
            <label style={labelStyle}>Client</label>
            <select value={form.client_id || ''} onChange={e => {
              const sel = clients.find(c => (c.id || c._id) === e.target.value);
              handleChange('client_id', e.target.value || null);
              handleChange('client_name', sel?.name || sel?.company_name || '');
            }} className="input-field">
              <option value="">No client (internal project)</option>
              {clients.map(c => <option key={c.id || c._id} value={c.id || c._id}>{c.company_name || c.name}</option>)}
            </select>
          </div>

          {form.client_id && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)' }}>Client can view this project</div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Visible in their portal</div>
              </div>
              <button type="button" onClick={() => handleChange('client_visible', !form.client_visible)}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', padding: 2, background: form.client_visible ? 'var(--accent)' : 'var(--border)', transition: 'background .2s', display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'transform .2s', transform: form.client_visible ? 'translateX(18px)' : 'translateX(0)' }} />
              </button>
            </div>
          )}

          {/* Team Members */}
          {teamMembers.length > 0 && (
            <div>
              <label style={labelStyle}>Team Members</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', maxHeight: 120, overflowY: 'auto' }}>
                {teamMembers.map(m => {
                  const selected = (form.team_member_ids || []).includes(m.id || m._id);
                  return (
                    <button key={m.id || m._id} type="button" onClick={() => toggleTeamMember(m.id || m._id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: selected ? 'var(--accent)' : 'var(--bg)', color: selected ? '#fff' : 'var(--tx-2)',
                        border: selected ? 'none' : '1px solid var(--border)', transition: 'all .12s',
                      }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: selected ? 'rgba(255,255,255,0.25)' : avatarBg(m.id || m._id), color: selected ? '#fff' : '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {initials(m.name)}
                      </span>
                      {m.name}
                    </button>
                  );
                })}
              </div>
              {(form.team_member_ids || []).length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 4, display: 'block' }}>{(form.team_member_ids || []).length} selected</span>
              )}
            </div>
          )}

          <div>
            <label style={labelStyle}>Progress (%)</label>
            <input type="number" min="0" max="100" value={form.progress || 0} onChange={e => handleChange('progress', parseInt(e.target.value))} className="input-field" />
          </div>
            </>
          )}
        </div>

        <div style={{ padding: 20, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          {project && onDelete && (
            <button onClick={() => onDelete(project.id)} style={{ padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={loading || (mode === 'template' && !selectedTemplate && !project)} className="btn-primary">
            {loading ? <Loader2 size={14} className="spin" style={{ marginRight: 6 }} /> : <Plus size={14} style={{ marginRight: 6 }} />}
            {project ? 'Update' : mode === 'template' ? 'Create from Template' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PROJECTS COMPONENT
   ═══════════════════════════════════════════════════════════ */

function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);

  // View + Filter state (persisted where useful)
  const [view, setView] = useState(() => localStorage.getItem('projects_view') || 'cards');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [groupBy, setGroupBy] = useState('none');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [clientsList, setClientsList] = useState([]);
  const [teamMembersList, setTeamMembersList] = useState([]);

  // Persist view
  useEffect(() => { localStorage.setItem('projects_view', view); }, [view]);

  // Preview-as-client support
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;

  // Fetch clients + team members for dropdowns
  useEffect(() => {
    ax().get(`${API}/users`).then(r => {
      const arr = Array.isArray(r.data) ? r.data : r.data?.items || [];
      setClientsList(arr.filter(u => u.account_type === 'Media Client'));
      setTeamMembersList(arr.filter(u => u.account_type !== 'Media Client' && u.active !== false));
    }).catch(() => {});
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const url = isPreview && previewClientId
        ? `${API}/projects?client_id=${previewClientId}`
        : `${API}/projects`;
      const r = await ax().get(url);
      setProjects(r.data);
    } catch (err) {
      if (err.response?.status !== 401) toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [isPreview, previewClientId]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { if (searchParams.get('new') === '1') setModal('new'); }, [searchParams]);

  // Count active filters
  const activeFilterCount = [filterStatus, filterType, filterPriority, filterPayment].filter(f => f !== 'all').length;

  // Filter + Sort + Group
  const filtered = useMemo(() => {
    let list = projects
      .filter(p => filterStatus === 'all' || p.status === filterStatus)
      .filter(p => filterType === 'all' || p.project_type === filterType)
      .filter(p => filterPriority === 'all' || p.priority === filterPriority)
      .filter(p => filterPayment === 'all' || p.payment_status === filterPayment)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
          (p.client_name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q);
      });

    // Sort
    const sorters = {
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      name: (a, b) => a.name.localeCompare(b.name),
      due_soon: (a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1,
      progress: (a, b) => (a.progress || 0) - (b.progress || 0),
      progress_desc: (a, b) => (b.progress || 0) - (a.progress || 0),
    };
    if (sorters[sortBy]) list.sort(sorters[sortBy]);

    return list;
  }, [projects, filterStatus, filterType, filterPriority, filterPayment, search, sortBy]);

  // Group
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;
    const groups = {};
    const groupColors = {};
    const colorMap = {
      status: (status) => STATUS_CONFIG[status]?.color || '#606060',
      type: (type) => TYPE_CONFIG[type]?.color || '#8b5cf6',
      priority: (pri) => PRIORITY_CONFIG[pri]?.color || '#606060',
    };

    filtered.forEach(p => {
      const key = groupBy === 'status' ? p.status : groupBy === 'type' ? p.project_type : p.priority;
      const label = groupBy === 'status' ? STATUS_CONFIG[key]?.label : groupBy === 'type' ? TYPE_CONFIG[key]?.label : PRIORITY_CONFIG[key]?.label;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
      groupColors[key] = colorMap[groupBy](key);
    });

    return Object.entries(groups).map(([k, items]) => ({
      key: k,
      label: groupBy === 'status' ? STATUS_CONFIG[k]?.label : groupBy === 'type' ? TYPE_CONFIG[k]?.label : PRIORITY_CONFIG[k]?.label,
      color: groupColors[k],
      items,
    }));
  }, [filtered, groupBy]);

  const toggleGroup = (key) => {
    setCollapsedGroups(c => ({ ...c, [key]: !c[key] }));
  };

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterType('all');
    setFilterPriority('all');
    setFilterPayment('all');
  };

  const renderContent = (items) => {
    return view === 'table' ? (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 100px 100px', gap: 10, padding: '0 14px 10px', borderBottom: '2px solid var(--border)', marginBottom: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Name</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Type</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Status</div>
          <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Progress</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Deadline</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Priority</div>
          <div />
        </div>
        {items.map(p => (
          <ProjectTableRow key={p.id} project={p} onEdit={() => setModal(p)} onClick={() => navigate(`/projects/${p.id}`)} />
        ))}
      </div>
    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        {items.map(p => (
          <ProjectCard key={p.id} project={p} onEdit={() => setModal(p)} onClick={() => navigate(`/projects/${p.id}`)} />
        ))}
      </div>
    );
  };

  if (loading) return <div className="page-fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="spin" color="var(--accent)" /></div>;

  return (
    <div className="page-fill" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderKanban size={20} color="var(--accent)" />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Projects</h1>
          <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: 4 }}>
            {projects.length}
          </span>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary" style={{ gap: 6 }}>
          <Plus size={14} /> New
        </button>
      </div>

      {/* KPI Bar */}
      <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        <KpiBar projects={projects} />
      </div>

      {/* Toolbar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: showFilters ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
            <Search size={14} color="var(--tx-3)" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--tx-1)' }} />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
            {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
            <button onClick={() => setView('cards')} className={view === 'cards' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px' }}><Grid3X3 size={14} /></button>
            <button onClick={() => setView('table')} className={view === 'table' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px' }}><List size={14} /></button>
          </div>
          <button onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: activeFilterCount > 0 ? 'var(--accent)' : 'var(--bg-elevated)', color: activeFilterCount > 0 ? 'white' : 'var(--tx-2)', border: activeFilterCount > 0 ? 'none' : '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            <Filter size={12} /> {activeFilterCount > 0 && activeFilterCount}
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Status</span>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Type</span>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Priority</span>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All</option>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Payment</span>
              <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All</option>
                {PAYMENT_OPTIONS.filter(o => o.value !== 'not_applicable').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {activeFilterCount > 0 && (
              <button onClick={clearFilters}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--tx-3)', cursor: 'pointer' }}>
                <X size={10} /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {filtered.length === 0 ? (
          /* Empty state */
          <div style={{ padding: '80px 20px', textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <FolderKanban size={28} color="var(--tx-3)" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 8px' }}>
              {projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
              {projects.length === 0
                ? 'Projects organize tasks, deadlines, and deliverables for each client engagement. Create your first one to get started.'
                : 'Try adjusting your search or filters to find what you\'re looking for.'}
            </p>
            {projects.length === 0 ? (
              <button onClick={() => setModal('new')} className="btn-primary" style={{ gap: 6 }}>
                <Plus size={14} /> Create First Project
              </button>
            ) : (
              <button onClick={clearFilters} className="btn-ghost" style={{ gap: 6 }}>
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>
        ) : grouped ? (
          /* Grouped view */
          <div>
            {grouped.map(g => (
              <div key={g.key} style={{ marginBottom: 8 }}>
                <GroupHeader
                  label={g.label}
                  count={g.items.length}
                  color={g.color}
                  collapsed={!!collapsedGroups[g.key]}
                  onToggle={() => toggleGroup(g.key)}
                />
                {!collapsedGroups[g.key] && renderContent(g.items)}
              </div>
            ))}
          </div>
        ) : (
          /* Flat view */
          renderContent(filtered)
        )}
      </div>

      {/* Modal */}
      {modal && <ProjectModal project={modal === 'new' ? null : modal} clients={clientsList} teamMembers={teamMembersList} onClose={() => setModal(null)} onSave={async (proj) => {
        if (!proj) { await fetchProjects(); setModal(null); return; }
        setSaving(true);
        try {
          if (proj.id) {
            await ax().patch(`${API}/projects/${proj.id}`, proj);
            toast.success('Project updated');
          } else {
            await ax().post(`${API}/projects`, proj);
            toast.success('Project created');
          }
          await fetchProjects();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to save project');
        } finally {
          setSaving(false);
        }
      }} onDelete={async (id) => {
        if (!window.confirm('Delete this project? This cannot be undone.')) return;
        try {
          await ax().delete(`${API}/projects/${id}`);
          toast.success('Project deleted');
          setModal(null);
          await fetchProjects();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete project'); }
      }} loading={saving} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ADMIN PROJECTS HUB COMPONENT
   ═══════════════════════════════════════════════════════════ */

function AdminProjectsHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [view, setView] = useState(() => localStorage.getItem('admin_projects_view') || 'cards');
  const [collapsedClients, setCollapsedClients] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [teamMembersList, setTeamMembersList] = useState([]);

  useEffect(() => { localStorage.setItem('admin_projects_view', view); }, [view]);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, clientRes, usersRes] = await Promise.all([
        ax().get(`${API}/projects`),
        ax().get(`${API}/dashboard/agency`).catch(() => ({ data: { clients: [] } })),
        ax().get(`${API}/users`).catch(() => ({ data: [] })),
      ]);
      setProjects(projRes.data);
      setClients(clientRes.data.clients || []);
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.items || [];
      setTeamMembersList(allUsers.filter(u => u.account_type !== 'Media Client' && u.active !== false));
    } catch (err) {
      if (err.response?.status !== 401) toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const activeProjs = projects.filter(p => p.status === 'active').length;
    const autoCreated = projects.filter(p => p.source === 'service_request').length;
    const overdueProjs = projects.filter(p => isOverdue(p.due_date) && p.status !== 'completed').length;
    const avgProgress = projects.length > 0 ? Math.round(projects.reduce((a, p) => a + (p.progress || 0), 0) / projects.length) : 0;
    const completedMtd = projects.filter(p => p.status === 'completed' && isThisMonth(p.created_at)).length;
    return { total: projects.length, activeProjs, autoCreated, overdueProjs, avgProgress, completedMtd };
  }, [projects]);

  // Filter projects
  const filtered = useMemo(() => {
    return projects
      .filter(p => filterStatus === 'all' || p.status === filterStatus)
      .filter(p => filterClient === 'all' || p.client_name === filterClient)
      .filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.client_name || '').toLowerCase().includes(q);
      });
  }, [projects, filterStatus, filterClient, search]);

  // Group by client
  const clientGroups = useMemo(() => {
    const groups = {};
    filtered.forEach(p => {
      const clientName = p.client_name || 'Unassigned';
      if (!groups[clientName]) groups[clientName] = [];
      groups[clientName].push(p);
    });

    return Object.entries(groups).map(([name, items]) => {
      const client = clients.find(c => c.name === name);
      const activeCount = items.filter(p => p.status === 'active').length;
      const completedCount = items.filter(p => p.status === 'completed').length;
      const overdueCount = items.filter(p => isOverdue(p.due_date) && p.status !== 'completed').length;
      return { name, items, client, activeCount, completedCount, overdueCount };
    }).sort((a, b) => b.items.length - a.items.length);
  }, [filtered, clients]);

  const clearFilters = () => { setSearch(''); setFilterStatus('all'); setFilterClient('all'); };
  const activeFilterCount = [filterStatus, filterClient].filter(f => f !== 'all').length + (search ? 1 : 0);

  const renderClientGroup = (group) => {
    const collapsed = collapsedClients[group.name];
    const clientColor = group.client ? '#3b82f6' : '#606060';
    return (
      <div key={group.name} style={{ marginBottom: 16 }}>
        {/* Client Group Header */}
        <div
          onClick={() => setCollapsedClients(c => ({ ...c, [group.name]: !collapsed }))}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            background: 'var(--card)', border: '1px solid var(--border)', borderLeft: `4px solid ${clientColor}`,
            borderRadius: 8, cursor: 'pointer', marginBottom: 10,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--card)'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>
              {group.name}
            </h3>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--tx-3)' }}>
              <span>{group.activeCount} active</span>
              <span>{group.completedCount} completed</span>
              {group.overdueCount > 0 && <span style={{ color: '#ef4444' }}>{group.overdueCount} overdue</span>}
            </div>
          </div>
          {group.client && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/clients/${group.client.id}`); }}
              style={{ padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            >
              View Client
            </button>
          )}
        </div>

        {/* Projects in group */}
        {!collapsed && (
          <div>
            {group.items.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--tx-3)', padding: '10px 14px' }}>No projects</p>
            ) : view === 'table' ? (
              <div style={{ marginBottom: 10 }}>
                {group.items.map(p => (
                  <ProjectTableRow key={p.id} project={p} onEdit={() => setModal(p)} onClick={() => navigate(`/projects/${p.id}`)} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 10 }}>
                {group.items.map(p => (
                  <ProjectCard key={p.id} project={p} onEdit={() => setModal(p)} onClick={() => navigate(`/projects/${p.id}`)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="page-fill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="spin" color="var(--accent)" /></div>;

  return (
    <div className="page-fill" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderKanban size={20} color="var(--accent)" />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Projects</h1>
          <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: 4 }}>
            {projects.length}
          </span>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary" style={{ gap: 6 }}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* KPI Strip */}
      <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Total Projects</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{kpis.total}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Active</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{kpis.activeProjs}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={10} /> Auto-Created
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{kpis.autoCreated}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Overdue</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{kpis.overdueProjs}</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Avg Progress</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{kpis.avgProgress}%</div>
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Completed MTD</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{kpis.completedMtd}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: showFilters ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
            <Search size={14} color="var(--tx-3)" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--tx-1)' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: 2 }}>
            <button onClick={() => setView('cards')} className={view === 'cards' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px' }}><Grid3X3 size={14} /></button>
            <button onClick={() => setView('table')} className={view === 'table' ? 'btn-primary' : 'btn-ghost'} style={{ padding: '4px 8px' }}><List size={14} /></button>
          </div>
          <button onClick={() => setShowFilters(!showFilters)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: activeFilterCount > 0 ? 'var(--accent)' : 'var(--bg-elevated)', color: activeFilterCount > 0 ? 'white' : 'var(--tx-2)', border: activeFilterCount > 0 ? 'none' : '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            <Filter size={12} /> {activeFilterCount > 0 && activeFilterCount}
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Status</span>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Client</span>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All Clients</option>
                {Array.from(new Set(projects.map(p => p.client_name).filter(Boolean))).sort().map(cn => (
                  <option key={cn} value={cn}>{cn}</option>
                ))}
              </select>
            </div>

            {activeFilterCount > 0 && (
              <button onClick={clearFilters}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--tx-3)', cursor: 'pointer' }}>
                <X size={10} /> Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content Area - Client Groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16, background: 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <FolderKanban size={28} color="var(--tx-3)" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 8px' }}>
              {projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
              {projects.length === 0
                ? 'Create your first project to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
            {projects.length === 0 ? (
              <button onClick={() => setModal('new')} className="btn-primary" style={{ gap: 6 }}>
                <Plus size={14} /> Create First Project
              </button>
            ) : (
              <button onClick={clearFilters} className="btn-ghost" style={{ gap: 6 }}>
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {clientGroups.map(group => renderClientGroup(group))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && <ProjectModal project={modal === 'new' ? null : modal} clients={clients} teamMembers={teamMembersList} onClose={() => setModal(null)} onSave={async (proj) => {
        if (!proj) { await fetchData(); setModal(null); return; }
        setSaving(true);
        try {
          if (proj.id) {
            await ax().patch(`${API}/projects/${proj.id}`, proj);
            toast.success('Project updated');
          } else {
            await ax().post(`${API}/projects`, proj);
            toast.success('Project created');
          }
          await fetchData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Failed to save project');
        } finally {
          setSaving(false);
        }
      }} onDelete={async (id) => {
        if (!window.confirm('Delete this project? This cannot be undone.')) return;
        try {
          await ax().delete(`${API}/projects/${id}`);
          toast.success('Project deleted');
          setModal(null);
          await fetchData();
        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete project'); }
      }} loading={saving} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROUTER COMPONENT (Default Export)
   ═══════════════════════════════════════════════════════════ */

export default function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';

  if (isAdmin && !isPreview) {
    return <AdminProjectsHub />;
  }

  return <Projects />;
}

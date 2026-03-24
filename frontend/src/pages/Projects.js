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
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  TrendingUp, Pause, Archive, Filter, Hash,
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
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: cfg.color, padding: '2px 8px', borderRadius: 4, background: cfg.bg }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

function PriorityDot({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: cfg.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function PaymentPill({ status }) {
  const colors = { paid: '#22c55e', partial: '#f59e0b', unpaid: '#ef4444', not_applicable: 'var(--tx-3)' };
  const labels = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', not_applicable: '—' };
  if (status === 'not_applicable' || !status) return null;
  const c = colors[status] || 'var(--tx-3)';
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${c}22`, color: c }}>{labels[status]}</span>;
}

function ProgressBar({ progress, size = 'md' }) {
  const h = size === 'sm' ? 4 : 6;
  const done = progress === 100;
  return (
    <div style={{ height: h, background: 'var(--bg-elevated)', borderRadius: h, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${progress || 0}%`, background: done ? '#22c55e' : 'var(--accent)', borderRadius: h, transition: 'width .4s ease' }} />
    </div>
  );
}

function AvatarStack({ members = [], max = 4 }) {
  const show = members.slice(0, max);
  const extra = members.length - max;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {show.map((m, i) => (
        <div key={m.id || i} title={m.name} style={{
          width: 26, height: 26, borderRadius: '50%', background: avatarBg(m.id || m.name || ''),
          border: '2px solid var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, color: '#fff', marginLeft: i > 0 ? -8 : 0,
          zIndex: max - i, position: 'relative',
        }}>
          {initials(m.name)}
        </div>
      ))}
      {extra > 0 && (
        <span style={{ fontSize: 10, color: 'var(--tx-3)', marginLeft: 4, fontWeight: 600 }}>+{extra}</span>
      )}
    </div>
  );
}

function DeadlineTag({ dueDate }) {
  if (!dueDate) return <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>No deadline</span>;
  const dl = daysUntil(dueDate);
  const overdue = dl <= 0;
  const urgent = dl > 0 && dl <= 7;
  const soon = dl > 7 && dl <= 14;
  const color = overdue ? '#ef4444' : urgent ? '#ef4444' : soon ? '#f59e0b' : 'var(--tx-3)';
  const weight = overdue || urgent || soon ? 600 : 400;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color, fontWeight: weight }}>
      <Calendar size={10} />
      {formatDate(dueDate)}
      {overdue && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#ef444420', color: '#ef4444', fontWeight: 700 }}>OVERDUE</span>}
      {urgent && !overdue && <span style={{ fontSize: 9, opacity: 0.8 }}>({dl}d left)</span>}
      {soon && <span style={{ fontSize: 9, opacity: 0.8 }}>({dl}d)</span>}
    </span>
  );
}


/* ═══════════════════════════════════════════════════════════
   KPI SUMMARY BAR
   ═══════════════════════════════════════════════════════════ */
function KpiBar({ projects }) {
  const active = projects.filter(p => p.status === 'active').length;
  const planning = projects.filter(p => p.status === 'planning').length;
  const completed = projects.filter(p => p.status === 'completed').length;
  const onHold = projects.filter(p => p.status === 'on_hold').length;
  const totalTasks = projects.reduce((s, p) => s + (p.task_count || 0), 0);
  const doneTasks = projects.reduce((s, p) => s + (p.completed_task_count || 0), 0);
  const taskPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const kpis = [
    { label: 'Active', value: active, color: '#22c55e' },
    { label: 'Planning', value: planning, color: '#f59e0b' },
    { label: 'Completed', value: completed, color: '#3b82f6' },
    { label: 'On Hold', value: onHold, color: '#ef4444' },
    { label: 'Tasks Done', value: `${doneTasks}/${totalTasks}`, sub: `${taskPct}%`, color: 'var(--accent)' },
  ];

  return (
    <div style={{ display: 'flex', gap: 0, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' }}>
      {kpis.map((k, i) => (
        <div key={k.label} style={{
          paddingRight: i < kpis.length - 1 ? 24 : 0,
          marginRight: i < kpis.length - 1 ? 24 : 0,
          borderRight: i < kpis.length - 1 ? '1px solid var(--border)' : 'none',
          minWidth: 'fit-content',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</span>
            {k.sub && <span style={{ fontSize: 11, fontWeight: 600, color: k.color, opacity: 0.7 }}>{k.sub}</span>}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 1, fontWeight: 500 }}>{k.label}</div>
        </div>
      ))}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   PROJECT CARD
   ═══════════════════════════════════════════════════════════ */
function ProjectCard({ project, onEdit, onClick }) {
  const p = project;
  const dl = daysUntil(p.due_date);
  const tasksDone = p.completed_task_count || 0;
  const tasksTotal = p.task_count || 0;
  const TypeIcon = (TYPE_CONFIG[p.project_type] || TYPE_CONFIG.custom).icon;

  return (
    <div onClick={onClick} className="card" style={{
      padding: 0, cursor: 'pointer', transition: 'all .15s ease',
      border: '1px solid var(--border)', overflow: 'hidden',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Top accent stripe */}
      <div style={{ height: 3, background: (STATUS_CONFIG[p.status] || STATUS_CONFIG.active).color }} />

      <div style={{ padding: '14px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusBadge status={p.status} />
            <PaymentPill status={p.payment_status} />
          </div>
          <button onClick={e => { e.stopPropagation(); onEdit(p); }}
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--tx-3)', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, transition: 'all .12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--tx-1)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--tx-3)'; }}
          >
            <Edit3 size={10} /> Edit
          </button>
        </div>

        {/* Title & client */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <TypeIcon size={14} color={(TYPE_CONFIG[p.project_type] || TYPE_CONFIG.custom).color} style={{ flexShrink: 0 }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </h3>
          </div>
          {p.client_name && (
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 20 }}>
              <Folder size={10} /> {p.client_name}
            </div>
          )}
        </div>

        {/* Progress section */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>
              <CheckSquare size={10} style={{ marginRight: 3, verticalAlign: -1 }} />
              {tasksDone}/{tasksTotal} tasks
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: (p.progress || 0) === 100 ? '#22c55e' : 'var(--tx-1)' }}>
              {p.progress || 0}%
            </span>
          </div>
          <ProgressBar progress={p.progress || 0} />
        </div>

        {/* Type pill + Priority */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
          <TypePill type={p.project_type} />
          <PriorityDot priority={p.priority} />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <AvatarStack members={p.team_members || []} max={4} />
          <DeadlineTag dueDate={p.due_date} />
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   PROJECT TABLE ROW
   ═══════════════════════════════════════════════════════════ */
function ProjectTableRow({ project, onEdit, onClick }) {
  const p = project;
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer', transition: 'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: (TYPE_CONFIG[p.project_type] || TYPE_CONFIG.custom).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {React.createElement((TYPE_CONFIG[p.project_type] || TYPE_CONFIG.custom).icon, { size: 14, color: (TYPE_CONFIG[p.project_type] || TYPE_CONFIG.custom).color })}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            {p.client_name && <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{p.client_name}</div>}
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)' }}><StatusBadge status={p.status} /></td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)' }}><PriorityDot priority={p.priority} /></td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <ProgressBar progress={p.progress || 0} size="sm" />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-1)', whiteSpace: 'nowrap' }}>{p.progress || 0}%</span>
        </div>
      </td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--tx-2)' }}>
        {p.completed_task_count || 0}/{p.task_count || 0}
      </td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>
        <AvatarStack members={p.team_members || []} max={3} />
      </td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>
        <DeadlineTag dueDate={p.due_date} />
      </td>
      <td style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={e => { e.stopPropagation(); onEdit(p); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, borderRadius: 4 }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--tx-1)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--tx-3)'}
        >
          <Edit3 size={13} />
        </button>
      </td>
    </tr>
  );
}


/* ═══════════════════════════════════════════════════════════
   GROUP HEADER
   ═══════════════════════════════════════════════════════════ */
function GroupHeader({ label, count, color, collapsed, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: '1px solid var(--border)', marginBottom: 12, marginTop: 8,
    }}>
      <ChevronDown size={14} color="var(--tx-3)" style={{ transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
      {color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>({count})</span>
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════
   PROJECT MODAL (New / Edit)
   ═══════════════════════════════════════════════════════════ */
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxHeight: '85vh', overflow: 'auto',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{isEdit ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--tx-3)', padding: '4px 6px', display: 'flex' }}>
            <X size={14} />
          </button>
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


/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function Projects() {
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

  // Persist view
  useEffect(() => { localStorage.setItem('projects_view', view); }, [view]);

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
    switch (sortBy) {
      case 'oldest': list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)); break;
      case 'name': list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'due_soon': list.sort((a, b) => (daysUntil(a.due_date)) - (daysUntil(b.due_date))); break;
      case 'progress': list.sort((a, b) => (a.progress || 0) - (b.progress || 0)); break;
      case 'progress_desc': list.sort((a, b) => (b.progress || 0) - (a.progress || 0)); break;
      default: list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); break;
    }

    return list;
  }, [projects, filterStatus, filterType, filterPriority, filterPayment, search, sortBy]);

  // Grouping logic
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;

    const groups = {};
    filtered.forEach(p => {
      let key, label, color;
      switch (groupBy) {
        case 'status':
          key = p.status || 'active';
          label = (STATUS_CONFIG[key] || {}).label || key;
          color = (STATUS_CONFIG[key] || {}).color;
          break;
        case 'type':
          key = p.project_type || 'custom';
          label = (TYPE_CONFIG[key] || {}).label || key;
          color = (TYPE_CONFIG[key] || {}).color;
          break;
        case 'client':
          key = p.client_name || '_none';
          label = p.client_name || 'No Client';
          color = key === '_none' ? 'var(--tx-3)' : 'var(--accent)';
          break;
        case 'priority':
          key = p.priority || 'medium';
          label = (PRIORITY_CONFIG[key] || {}).label || key;
          color = (PRIORITY_CONFIG[key] || {}).color;
          break;
        default:
          key = 'all'; label = 'All'; color = null;
      }
      if (!groups[key]) groups[key] = { label, color, items: [] };
      groups[key].items.push(p);
    });

    // Order groups logically
    const order = groupBy === 'status' ? STATUS_OPTIONS :
                  groupBy === 'type' ? TYPE_OPTIONS :
                  groupBy === 'priority' ? ['urgent','high','medium','low'] :
                  Object.keys(groups).sort();

    return order.filter(k => groups[k]).map(k => ({ key: k, ...groups[k] }));
  }, [filtered, groupBy]);

  const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  // CRUD
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

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterType('all');
    setFilterPriority('all');
    setFilterPayment('all');
    setSearch('');
  };

  // Render helpers
  const renderCards = (items) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
      {items.map(p => (
        <ProjectCard key={p.id} project={p} onEdit={setModal} onClick={() => navigate(`/projects/${p.id}`)} />
      ))}
    </div>
  );

  const renderTable = (items) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['Project', 'Status', 'Priority', 'Progress', 'Tasks', 'Team', 'Due Date', ''].map(h => (
              <th key={h} style={{ padding: '8px 8px 10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(p => (
            <ProjectTableRow key={p.id} project={p} onEdit={setModal} onClick={() => navigate(`/projects/${p.id}`)} />
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderContent = (items) => view === 'cards' ? renderCards(items) : renderTable(items);


  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="page-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="spin" color="var(--tx-3)" />
      </div>
    );
  }

  return (
    <div className="page-fill" style={{ flexDirection: 'column' }}>
      {modal && (
        <ProjectModal
          project={typeof modal === 'object' ? modal : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
          loading={saving}
        />
      )}

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <FolderKanban size={18} color="var(--accent)" />
        <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>Projects</h1>
        <span style={{ fontSize: 11, color: 'var(--tx-3)', padding: '2px 8px', background: 'var(--bg-elevated)', borderRadius: 10, fontWeight: 600 }}>
          {filtered.length}{filtered.length !== projects.length ? ` / ${projects.length}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setModal('new')} className="btn-primary btn-sm" style={{ gap: 5 }}>
          <Plus size={13} /> New Project
        </button>
      </div>

      {/* ── KPI Bar ── */}
      <KpiBar projects={projects} />

      {/* ── Toolbar: Search, Filters, Sort, View, Group ── */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
            <Search size={13} color="var(--tx-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px 7px 30px', fontSize: 12.5, color: 'var(--tx-1)', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
              background: showFilters || activeFilterCount > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
              color: showFilters || activeFilterCount > 0 ? '#fff' : 'var(--tx-2)',
              border: '1px solid', borderColor: showFilters || activeFilterCount > 0 ? 'var(--accent)' : 'var(--border)',
              borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
            }}>
            <Filter size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span style={{ background: '#fff', color: 'var(--accent)', fontSize: 10, fontWeight: 800, padding: '0 5px', borderRadius: 8, lineHeight: '16px' }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          <div style={{ flex: 1 }} />

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpDown size={11} color="var(--tx-3)" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Group by */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Layers size={11} color="var(--tx-3)" />
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
              {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 7, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {[
              { id: 'cards', icon: Grid3X3 },
              { id: 'table', icon: List },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                style={{
                  padding: '5px 10px', background: view === v.id ? 'var(--accent)' : 'var(--bg-elevated)',
                  border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  color: view === v.id ? '#fff' : 'var(--tx-3)', transition: 'all .1s',
                }}>
                <v.icon size={13} />
              </button>
            ))}
          </div>
        </div>

        {/* Filter row (collapsible) */}
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

      {/* ── Content Area ── */}
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
    </div>
  );
}

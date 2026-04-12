/**
 * Tasks Hub — Full task management with list + kanban views
 *
 * Features:
 *   • KPI summary bar (total, by status, overdue, completion rate)
 *   • Search + multi-filters (status, priority, assignee, project)
 *   • Sort options (newest, due soonest, priority, name)
 *   • View toggle: list / board (kanban) — persisted
 *   • Group by: none / status / priority / project / assignee
 *   • Polished list rows with avatars, priority icons, deadline urgency
 *   • Upgraded kanban columns with quick-add
 *   • Task detail drawer with comments, subtasks, editable fields
 *   • New task modal with project + assignee linking
 *   • Clean empty states
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus, List, LayoutGrid, Search, X, ChevronDown,
  Circle, CheckCircle2, Clock, AlertCircle, ArrowUp, Minus, ArrowDown,
  Calendar, User, Loader2, Trash2, Edit3,
  MessageSquare, FolderKanban, ChevronRight, Filter,
  ArrowUpDown, Layers, CheckSquare, Target, BarChart3,
  Hash, Grid3X3, Activity, TrendingUp,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import PillSelect, {
  STATUS_OPTIONS_LABEL,
  PRIORITY_OPTIONS_LABEL,
} from '../components/PillSelect';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

/* ── Status / Priority Config ── */
const STATUSES = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'];
const STATUS_MAP = { Backlog: 'backlog', Todo: 'todo', 'In Progress': 'doing', 'In Review': 'review', Done: 'done' };
const STATUS_RMAP = { backlog: 'Backlog', todo: 'Todo', doing: 'In Progress', waiting_on_client: 'In Progress', review: 'In Review', done: 'Done', open: 'Todo', assigned: 'Todo', revision: 'In Review', delivered: 'Done' };
const STATUS_COLORS = { Backlog: '#6b7280', Todo: '#3b82f6', 'In Progress': '#f59e0b', 'In Review': '#a855f7', Done: '#22c55e' };
const STATUS_BG = { Backlog: '#6b728015', Todo: '#3b82f615', 'In Progress': '#f59e0b15', 'In Review': '#a855f715', Done: '#22c55e15' };
const STATUS_ICONS = { Backlog: Hash, Todo: Circle, 'In Progress': Clock, 'In Review': AlertCircle, Done: CheckCircle2 };

const PRIORITIES = ['Urgent', 'High', 'Normal', 'Low'];
const PRIORITY_MAP = { Urgent: 'urgent', High: 'high', Normal: 'medium', Low: 'low' };
const PRIORITY_RMAP = { urgent: 'Urgent', high: 'High', medium: 'Normal', low: 'Low' };
const PRIORITY_COLORS = { Urgent: '#ef4444', High: '#f59e0b', Normal: '#6b7280', Low: '#9ca3af' };
const PRIORITY_ICON = {
  Urgent: <AlertCircle size={13} style={{ color: '#ef4444' }} />,
  High: <ArrowUp size={13} style={{ color: '#f59e0b' }} />,
  Normal: <Minus size={13} style={{ color: '#6b7280' }} />,
  Low: <ArrowDown size={13} style={{ color: '#9ca3af' }} />,
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'due_soon', label: 'Due Soonest' },
  { value: 'priority', label: 'Priority ↑' },
  { value: 'name', label: 'Name A→Z' },
];

const GROUP_OPTIONS = [
  { value: 'none', label: 'No Grouping' },
  { value: 'status', label: 'By Status' },
  { value: 'priority', label: 'By Priority' },
  { value: 'project', label: 'By Project' },
  { value: 'assignee', label: 'By Assignee' },
];

const PRIORITY_SORT_ORDER = { Urgent: 0, High: 1, Normal: 2, Low: 3 };

/* ── Helpers ── */
const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
const AVATAR_COLORS = ['#c92a3e','#7c3aed','#2563eb','#059669','#d97706','#0891b2','#db2777','#65a30d'];
const avatarBg = (name) => AVATAR_COLORS[(name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const daysUntil = d => {
  if (!d) return 999;
  return Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
};
const formatDate = d => d ? new Date(d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '';

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

function mapTaskFromApi(t) {
  return {
    ...t, _id: t.id,
    status: STATUS_RMAP[t.status] || t.status,
    priority: PRIORITY_RMAP[t.priority] || t.priority || 'Normal',
    assignee: t.assignee_name || '',
    assignee_id: t.assignee_id || '',
    due_date: t.due_at ? t.due_at.substring(0, 10) : '',
    project: t.project_name || '',
    project_id: t.project_id || '',
  };
}


/* ═══════════════════════════════════════════════════════════
   KPI BAR
   ═══════════════════════════════════════════════════════════ */
function KpiBar({ tasks }) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const overdue = tasks.filter(t => t.due_date && daysUntil(t.due_date) <= 0 && t.status !== 'Done').length;
  const completionPct = total ? Math.round((done / total) * 100) : 0;

  const kpis = [
    { label: 'Total', value: total, color: 'var(--tx-1)' },
    { label: 'In Progress', value: inProgress, color: '#f59e0b' },
    { label: 'Done', value: done, sub: `${completionPct}%`, color: '#22c55e' },
    { label: 'Overdue', value: overdue, color: overdue > 0 ? '#ef4444' : 'var(--tx-3)' },
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
   INLINE QUICK-ADD
   ═══════════════════════════════════════════════════════════ */
function InlineAdd({ onCreated }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await ax().post(`${API}/tasks`, { title: text.trim(), status: 'todo', priority: 'medium', visibility: 'both' });
      setText('');
      onCreated();
      ref.current?.focus();
    } catch { toast.error('Failed to create task'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      borderBottom: '1px solid var(--border)', background: 'var(--bg)',
    }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Plus size={11} style={{ color: 'var(--tx-3)' }} />
      </div>
      <input ref={ref} value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }}
        placeholder="Type a task name and press Enter to add..."
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx-1)', fontSize: 13, padding: '4px 0' }} />
      {saving && <Loader2 size={13} className="spin" style={{ color: 'var(--tx-3)' }} />}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   NEW TASK MODAL
   ═══════════════════════════════════════════════════════════ */
function NewTaskModal({ onClose, onSave, projects, users }) {
  const [form, setForm] = useState({
    title: '', status: 'Todo', priority: 'Normal',
    assignee_id: '', due_date: '', project_id: '', description: '',
  });
  const [reminderEmail, setReminderEmail] = useState(false);
  const [reminderSms, setReminderSms] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(60);
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const channels = [reminderEmail && 'email', reminderSms && 'sms'].filter(Boolean);
      await ax().post(`${API}/tasks`, {
        title: form.title, description: form.description || null,
        status: STATUS_MAP[form.status] || 'todo',
        priority: PRIORITY_MAP[form.priority] || 'medium',
        due_at: form.due_date ? new Date(form.due_date).toISOString() : null,
        project_id: form.project_id || null,
        assignee_user_id: form.assignee_id || null,
        visibility: 'both',
        reminder_minutes_before: channels.length ? reminderMinutes : null,
        reminder_channels: channels,
      });
      toast.success('Task created');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create task'); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxHeight: '85vh', overflow: 'auto',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>New Task</h2>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--tx-3)', padding: '4px 6px', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Task Title *</label>
            <input className="input-field" placeholder="What needs to be done?" value={form.title} onChange={e => f('title', e.target.value)} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea className="input-field" rows={2} placeholder="Details..." value={form.description} onChange={e => f('description', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <div>
                <PillSelect
                  value={form.status}
                  onChange={v => f('status', v)}
                  options={STATUS_OPTIONS_LABEL}
                  minWidth={160}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <div>
                <PillSelect
                  value={form.priority}
                  onChange={v => f('priority', v)}
                  options={PRIORITY_OPTIONS_LABEL}
                  minWidth={140}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Due Date & Time</label>
              <input className="input-field" type="datetime-local" value={form.due_date} onChange={e => f('due_date', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Assignee</label>
              <select className="input-field" value={form.assignee_id} onChange={e => f('assignee_id', e.target.value)}>
                <option value="">Unassigned</option>
                {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          {form.due_date && (
            <div style={{ marginTop: 4, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Reminders</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={reminderEmail} onChange={e => setReminderEmail(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  Email
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={reminderSms} onChange={e => setReminderSms(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  SMS
                </label>
                {(reminderEmail || reminderSms) && (
                  <select
                    value={reminderMinutes}
                    onChange={e => setReminderMinutes(Number(e.target.value))}
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)', padding: '4px 10px', fontSize: 12 }}
                  >
                    <option value={15}>15 min before</option>
                    <option value={30}>30 min before</option>
                    <option value={60}>1 hour before</option>
                    <option value={120}>2 hours before</option>
                    <option value={1440}>1 day before</option>
                    <option value={2880}>2 days before</option>
                  </select>
                )}
              </div>
            </div>
          )}
          <div>
            <label style={labelStyle}>Project</label>
            <select className="input-field" value={form.project_id} onChange={e => f('project_id', e.target.value)}>
              <option value="">No project</option>
              {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.title.trim() || saving}>
              {saving ? <Loader2 size={13} className="spin" /> : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ═══════════════════════════════════════════════════════════
   TASK DETAIL DRAWER
   ═══════════════════════════════════════════════════════════ */
function TaskDetail({ task, onClose, onRefresh, onDelete, users, allTasks }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [blockedByTasks, setBlockedByTasks] = useState(task.blocked_by_tasks || []);
  const [addingBlocker, setAddingBlocker] = useState(false);
  const [blockerSearchId, setBlockerSearchId] = useState('');
  const [timeEntries, setTimeEntries] = useState([]);
  const [newHours, setNewHours] = useState('');
  const [newTimeDesc, setNewTimeDesc] = useState('');
  const [addingTime, setAddingTime] = useState(false);

  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(false);
  const [desc, setDesc] = useState(task.description || '');

  useEffect(() => {
    setLoadingComments(true);
    setTitle(task.title);
    setDesc(task.description || '');
    setBlockedByTasks(task.blocked_by_tasks || []);
    Promise.all([
      ax().get(`${API}/tasks/${task.id}/comments`).then(r => setComments(r.data)).catch(() => {}),
      ax().get(`${API}/tasks/${task.id}/subtasks`).then(r => setSubtasks(r.data)).catch(() => {}),
      ax().get(`${API}/tasks/${task.id}/time-entries`).then(r => setTimeEntries(r.data)).catch(() => {}),
    ]).finally(() => setLoadingComments(false));
  }, [task.id, task.blocked_by_tasks]);

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      const r = await ax().post(`${API}/tasks/${task.id}/comments`, { content: newComment });
      setComments(prev => [...prev, r.data]);
      setNewComment('');
    } catch { toast.error('Failed to add comment'); }
  };

  const handleFieldUpdate = async (field, value) => {
    try {
      await ax().patch(`${API}/tasks/${task.id}`, { [field]: value });
      onRefresh();
    } catch { toast.error('Failed to update'); }
  };

  const handleStatusChange = (newStatus) => {
    const mappedStatus = STATUS_MAP[newStatus] || newStatus;
    // Guard: prevent marking done if subtasks are incomplete
    if (mappedStatus === 'done' && subtasks.length > 0 && doneCount < subtasks.length) {
      toast.error(`Complete all subtasks first (${doneCount}/${subtasks.length} done)`);
      return;
    }
    // Guard: prevent marking done if blocked by incomplete tasks
    const activeBlockers = blockedByTasks.filter(b => b.status !== 'done');
    if (mappedStatus === 'done' && activeBlockers.length > 0) {
      toast.error(`Blocked by ${activeBlockers.length} incomplete task(s)`);
      return;
    }
    handleFieldUpdate('status', mappedStatus);
  };
  const handlePriorityChange = (newPri) => handleFieldUpdate('priority', PRIORITY_MAP[newPri] || newPri);
  const handleDueChange = (val) => handleFieldUpdate('due_at', val ? new Date(val + 'T00:00:00Z').toISOString() : null);
  const handleAssigneeChange = (val) => handleFieldUpdate('assignee_id', val || null);

  const saveTitle = () => {
    if (title.trim() && title !== task.title) handleFieldUpdate('title', title.trim());
    setEditTitle(false);
  };
  const saveDesc = () => {
    if (desc !== (task.description || '')) handleFieldUpdate('description', desc);
    setEditDesc(false);
  };

  const toggleSubtask = async (stId, currentStatus) => {
    const newSt = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await ax().patch(`${API}/tasks/${stId}`, { status: newSt });
      setSubtasks(prev => prev.map(s => s.id === stId ? { ...s, status: newSt } : s));
    } catch { toast.error('Failed to update subtask'); }
  };

  const addSubtaskFn = async () => {
    if (!newSubtask.trim()) return;
    setAddingSubtask(true);
    try {
      const r = await ax().post(`${API}/tasks`, { title: newSubtask.trim(), status: 'todo', priority: 'medium', parent_task_id: task.id, visibility: 'both' });
      setSubtasks(prev => [...prev, r.data]);
      setNewSubtask('');
    } catch { toast.error('Failed to add subtask'); }
    finally { setAddingSubtask(false); }
  };

  const deleteSubtask = async (stId) => {
    try {
      await ax().delete(`${API}/tasks/${stId}`);
      setSubtasks(prev => prev.filter(s => s.id !== stId));
    } catch { toast.error('Failed to delete subtask'); }
  };

  const addBlocker = async () => {
    if (!blockerSearchId) return;
    setAddingBlocker(true);
    try {
      await ax().post(`${API}/tasks/${task.id}/block`, { blocked_by_id: blockerSearchId });
      const blockerTask = allTasks?.find(t => t._id === blockerSearchId || t.id === blockerSearchId);
      setBlockedByTasks(prev => [...prev, { id: blockerSearchId, title: blockerTask?.title || 'Task', status: blockerTask?.status || 'todo' }]);
      setBlockerSearchId('');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add blocker'); }
    finally { setAddingBlocker(false); }
  };

  const removeBlocker = async (blockerId) => {
    try {
      await ax().delete(`${API}/tasks/${task.id}/block/${blockerId}`);
      setBlockedByTasks(prev => prev.filter(b => b.id !== blockerId));
      onRefresh();
    } catch { toast.error('Failed to remove blocker'); }
  };

  const addTimeEntry = async () => {
    const hrs = parseFloat(newHours);
    if (!hrs || hrs <= 0) { toast.error('Enter valid hours'); return; }
    setAddingTime(true);
    try {
      const r = await ax().post(`${API}/tasks/${task.id}/time-entries`, { hours: hrs, description: newTimeDesc || null });
      setTimeEntries(prev => [r.data, ...prev]);
      setNewHours('');
      setNewTimeDesc('');
      onRefresh();
    } catch { toast.error('Failed to log time'); }
    finally { setAddingTime(false); }
  };

  const deleteTimeEntry = async (entryId) => {
    try {
      await ax().delete(`${API}/tasks/${task.id}/time-entries/${entryId}`);
      setTimeEntries(prev => prev.filter(e => e.id !== entryId));
      onRefresh();
    } catch { toast.error('Failed to delete time entry'); }
  };

  const totalHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  const doneCount = subtasks.filter(s => s.status === 'done').length;

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
        background: 'var(--card)', borderLeft: '1px solid var(--border)', zIndex: 100,
        display: 'flex', flexDirection: 'column',
        animation: 'slideRight .15s ease both', boxShadow: '-8px 0 30px rgba(0,0,0,.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Task Detail</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { if (window.confirm('Delete this task?')) onDelete(task.id); }}
                style={{ background: '#ef444415', border: '1px solid #ef444430', borderRadius: 5, cursor: 'pointer', color: '#ef4444', padding: '3px 8px', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Trash2 size={11} /> Delete
              </button>
              <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--tx-3)', padding: '3px 6px', display: 'flex' }}>
                <X size={13} />
              </button>
            </div>
          </div>
          {/* Editable title */}
          {editTitle ? (
            <input className="input-field" value={title} onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); }}
              autoFocus style={{ fontSize: 15, fontWeight: 700, padding: '6px 10px' }} />
          ) : (
            <h3 onClick={() => setEditTitle(true)} style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--tx-1)', cursor: 'pointer', lineHeight: 1.4 }}>
              {task.title}
              <Edit3 size={11} style={{ color: 'var(--tx-3)', marginLeft: 6, verticalAlign: 'middle', opacity: 0.5 }} />
            </h3>
          )}
          {/* Editable description */}
          {editDesc ? (
            <textarea className="input-field" value={desc} onChange={e => setDesc(e.target.value)}
              onBlur={saveDesc} autoFocus rows={2} style={{ fontSize: 12.5, marginTop: 8 }} />
          ) : (
            <p onClick={() => setEditDesc(true)} style={{ fontSize: 12.5, color: desc ? 'var(--tx-2)' : 'var(--tx-3)', margin: '8px 0 0', lineHeight: 1.5, cursor: 'pointer' }}>
              {desc || 'Click to add a description...'}
            </p>
          )}
        </div>

        {/* Meta fields */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Status</label>
            <PillSelect
              value={task.status}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS_LABEL}
              minWidth={160}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Priority</label>
            <PillSelect
              value={task.priority}
              onChange={handlePriorityChange}
              options={PRIORITY_OPTIONS_LABEL}
              minWidth={140}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Due Date</label>
            <input type="date" className="input-field" value={task.due_date || ''} onChange={e => handleDueChange(e.target.value)}
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Assignee</label>
            <select className="input-field" value={task.assignee_id || ''} onChange={e => handleAssigneeChange(e.target.value)}
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, width: '100%' }}>
              <option value="">Unassigned</option>
              {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          {task.project && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Project</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                <FolderKanban size={12} /> {task.project}
              </div>
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckSquare size={12} />
            Subtasks ({doneCount}/{subtasks.length})
            {subtasks.length > 0 && (
              <div style={{ flex: 1, height: 3, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${(doneCount / subtasks.length) * 100}%`, background: '#22c55e', borderRadius: 2, transition: 'width .2s' }} />
              </div>
            )}
          </div>
          {subtasks.map(st => (
            <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}
              onMouseEnter={e => { const d = e.currentTarget.querySelector('[data-del]'); if (d) d.style.opacity = 1; }}
              onMouseLeave={e => { const d = e.currentTarget.querySelector('[data-del]'); if (d) d.style.opacity = 0; }}>
              <button onClick={() => toggleSubtask(st.id, st.status)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: st.status === 'done' ? '#22c55e' : 'var(--tx-3)', padding: 0, display: 'flex', flexShrink: 0 }}>
                {st.status === 'done' ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              </button>
              <span style={{ fontSize: 12, color: st.status === 'done' ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: st.status === 'done' ? 'line-through' : 'none', flex: 1 }}>
                {st.title}
              </span>
              <button data-del onClick={() => deleteSubtask(st.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, opacity: 0, transition: 'opacity .1s', flexShrink: 0 }}>
                <X size={11} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Plus size={12} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
            <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSubtaskFn(); }}
              placeholder="Add subtask..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--tx-1)', padding: '3px 0' }} />
            {addingSubtask && <Loader2 size={12} className="spin" style={{ color: 'var(--tx-3)' }} />}
          </div>
        </div>

        {/* Blocked By */}
        {(blockedByTasks.length > 0 || allTasks?.length > 0) && (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} />
              Blocked By ({blockedByTasks.length})
            </div>
            {blockedByTasks.map(b => {
              const isDone = b.status === 'done';
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}
                  onMouseEnter={e => { const d = e.currentTarget.querySelector('[data-rm]'); if (d) d.style.opacity = 1; }}
                  onMouseLeave={e => { const d = e.currentTarget.querySelector('[data-rm]'); if (d) d.style.opacity = 0; }}>
                  {isDone ? <CheckCircle2 size={13} style={{ color: '#22c55e', flexShrink: 0 }} /> : <Clock size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, color: isDone ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: isDone ? 'line-through' : 'none', flex: 1 }}>
                    {b.title}
                  </span>
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: isDone ? '#22c55e18' : '#f59e0b18', color: isDone ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                    {STATUS_RMAP[b.status] || b.status}
                  </span>
                  <button data-rm onClick={() => removeBlocker(b.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, opacity: 0, transition: 'opacity .1s', flexShrink: 0 }}>
                    <X size={11} />
                  </button>
                </div>
              );
            })}
            {/* Add blocker selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <select className="input-field" value={blockerSearchId} onChange={e => setBlockerSearchId(e.target.value)}
                style={{ flex: 1, fontSize: 11, padding: '4px 6px', borderRadius: 5 }}>
                <option value="">Add blocking task...</option>
                {(allTasks || [])
                  .filter(t => (t._id || t.id) !== task.id && !blockedByTasks.some(b => b.id === (t._id || t.id)))
                  .map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.title}</option>)}
              </select>
              {blockerSearchId && (
                <button onClick={addBlocker} disabled={addingBlocker}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', padding: '4px 8px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                  {addingBlocker ? <Loader2 size={10} className="spin" /> : <Plus size={10} />}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Time Tracking */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={12} />
            Time Logged ({totalHours.toFixed(1)}h)
          </div>
          {timeEntries.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}
              onMouseEnter={ev => { const d = ev.currentTarget.querySelector('[data-tdel]'); if (d) d.style.opacity = 1; }}
              onMouseLeave={ev => { const d = ev.currentTarget.querySelector('[data-tdel]'); if (d) d.style.opacity = 0; }}>
              <span style={{ fontWeight: 600, color: 'var(--tx-1)', minWidth: 36 }}>{e.hours}h</span>
              <span style={{ flex: 1, color: 'var(--tx-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.description || '—'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--tx-3)', flexShrink: 0 }}>{e.user_name?.split(' ')[0]} · {e.date}</span>
              <button data-tdel onClick={() => deleteTimeEntry(e.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, opacity: 0, transition: 'opacity .1s', flexShrink: 0 }}>
                <X size={11} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <input value={newHours} onChange={e => setNewHours(e.target.value)} placeholder="Hrs"
              type="number" step="0.25" min="0"
              style={{ width: 50, background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 6px', fontSize: 12, color: 'var(--tx-1)', outline: 'none', textAlign: 'center' }} />
            <input value={newTimeDesc} onChange={e => setNewTimeDesc(e.target.value)} placeholder="What did you work on?"
              onKeyDown={e => { if (e.key === 'Enter') addTimeEntry(); }}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--tx-1)', padding: '3px 0' }} />
            {newHours && (
              <button onClick={addTimeEntry} disabled={addingTime}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', padding: '3px 8px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                {addingTime ? <Loader2 size={10} className="spin" /> : 'Log'}
              </button>
            )}
          </div>
        </div>

        {/* Comments */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={12} /> Comments ({comments.length})
          </div>
          {loadingComments && <div style={{ textAlign: 'center', padding: 16 }}><Loader2 size={16} className="spin" color="var(--tx-3)" /></div>}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-1)' }}>{c.user_name || 'Unknown'}</span>
                <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{new Date(c.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.5 }}>{c.content}</div>
            </div>
          ))}
          {!loadingComments && comments.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--tx-3)', textAlign: 'center', padding: 24, background: 'var(--bg-elevated)', borderRadius: 8 }}>No comments yet</div>
          )}
        </div>

        {/* Comment input */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input-field" placeholder="Add a comment..." value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
              style={{ flex: 1, fontSize: 12, padding: '8px 10px' }} />
            <button className="btn-primary btn-sm" onClick={addComment} disabled={!newComment.trim()}>Send</button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}


/* ═══════════════════════════════════════════════════════════
   LIST ROW
   ═══════════════════════════════════════════════════════════ */
function TaskRow({ task, onToggle, onClick, selected = false, onToggleSelect }) {
  const done = task.status === 'Done';
  const overdue = task.due_date && daysUntil(task.due_date) <= 0 && !done;
  const urgent = !done && task.due_date && daysUntil(task.due_date) > 0 && daysUntil(task.due_date) <= 3;

  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
      borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .08s',
      background: selected ? 'var(--accent-soft)' : 'transparent',
    }}
    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}>
      {/* Bulk select checkbox */}
      {onToggleSelect && (
        <input type="checkbox" checked={selected} onChange={e => { e.stopPropagation(); onToggleSelect(task._id || task.id); }}
          onClick={e => e.stopPropagation()}
          style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
      )}
      {/* Toggle */}
      <button onClick={e => { e.stopPropagation(); onToggle(task._id); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: done ? '#22c55e' : 'var(--tx-3)', padding: 0, flexShrink: 0, display: 'flex', transition: 'color .1s' }}
        onMouseEnter={e => { if (!done) e.currentTarget.style.color = '#22c55e'; }}
        onMouseLeave={e => { if (!done) e.currentTarget.style.color = 'var(--tx-3)'; }}
      >
        {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </button>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: done ? 'var(--tx-3)' : 'var(--tx-1)',
          textDecoration: done ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500,
        }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center', overflow: 'hidden' }}>
          {task.project && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
              <FolderKanban size={10} /> {task.project}
            </span>
          )}
          {task.subtask_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <CheckSquare size={10} /> {task.completed_subtask_count}/{task.subtask_count}
            </span>
          )}
          {task.comment_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <MessageSquare size={10} /> {task.comment_count}
            </span>
          )}
          {(task.blocked_by_tasks || []).some(b => b.status !== 'done') && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#ef4444', fontWeight: 600 }}>
              <AlertCircle size={10} /> Blocked
            </span>
          )}
        </div>
      </div>

      {/* Right side meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Priority */}
        {PRIORITY_ICON[task.priority]}

        {/* Assignee avatar */}
        {task.assignee && (
          <div title={task.assignee} style={{
            width: 24, height: 24, borderRadius: '50%', background: avatarBg(task.assignee),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials(task.assignee)}
          </div>
        )}

        {/* Due date */}
        {task.due_date && (
          <span style={{
            fontSize: 11, fontWeight: overdue || urgent ? 600 : 400,
            color: overdue ? '#ef4444' : urgent ? '#f59e0b' : 'var(--tx-3)',
            display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
          }}>
            {overdue && <AlertCircle size={11} />}
            {formatDate(task.due_date)}
          </span>
        )}

        {/* Status pill */}
        <div style={{
          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
          background: STATUS_BG[task.status], color: STATUS_COLORS[task.status],
          whiteSpace: 'nowrap',
        }}>
          {task.status}
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   KANBAN COLUMN
   ═══════════════════════════════════════════════════════════ */
function KanbanCol({ status, tasks, onToggle, onCardClick, onQuickAdd }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const color = STATUS_COLORS[status];
  const Icon = STATUS_ICONS[status] || Circle;

  const save = async () => {
    if (!text.trim()) { setAdding(false); return; }
    await onQuickAdd(text.trim(), status);
    setText('');
    setAdding(false);
  };

  return (
    <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Column header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)', flex: 1 }}>{status}</span>
        <span style={{ fontSize: 10, color: 'var(--tx-3)', background: 'var(--bg-elevated)', padding: '1px 8px', borderRadius: 10, fontWeight: 700 }}>{tasks.length}</span>
        <button onClick={() => setAdding(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--tx-3)'}
        ><Plus size={14} /></button>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {adding && (
          <div style={{ padding: '10px 12px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--accent)', boxShadow: '0 0 0 1px var(--accent)' }}>
            <input value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setAdding(false); }}
              onBlur={save} autoFocus placeholder="Task title..."
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: 'var(--tx-1)' }} />
          </div>
        )}
        {tasks.map(task => {
          const done = task.status === 'Done';
          const overdue = task.due_date && daysUntil(task.due_date) <= 0 && !done;
          return (
            <div key={task._id} onClick={() => onCardClick(task)}
              style={{
                padding: '10px 12px', background: 'var(--card)', borderRadius: 8,
                border: '1px solid var(--border)', cursor: 'pointer', transition: 'all .1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: done ? 'var(--tx-3)' : 'var(--tx-1)', flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                {PRIORITY_ICON[task.priority]}
              </div>
              {task.project && <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 3 }}><FolderKanban size={10} /> {task.project}</div>}
              {(task.blocked_by_tasks || []).some(b => b.status !== 'done') && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 4, background: '#ef444415', color: '#ef4444', fontSize: 9.5, fontWeight: 600, marginBottom: 6 }}>
                  <AlertCircle size={10} /> Blocked
                </div>
              )}
              {task.subtask_count > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ flex: 1, height: 3, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${(task.completed_subtask_count / task.subtask_count) * 100}%`, background: '#22c55e', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--tx-3)', fontWeight: 600 }}>{task.completed_subtask_count}/{task.subtask_count}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {task.assignee && (
                  <div title={task.assignee} style={{
                    width: 20, height: 20, borderRadius: '50%', background: avatarBg(task.assignee),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: '#fff',
                  }}>
                    {initials(task.assignee)}
                  </div>
                )}
                <span style={{ fontSize: 10, flex: 1, color: 'var(--tx-3)' }}>{task.assignee ? task.assignee.split(' ')[0] : ''}</span>
                {task.total_hours > 0 && <span style={{ fontSize: 10, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={9} /> {task.total_hours}h</span>}
                {task.comment_count > 0 && <span style={{ fontSize: 10, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 2 }}><MessageSquare size={9} /> {task.comment_count}</span>}
                {task.due_date && (
                  <span style={{ fontSize: 10, color: overdue ? '#ef4444' : 'var(--tx-3)', fontWeight: overdue ? 600 : 400 }}>
                    {formatDate(task.due_date)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && !adding && (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: 'var(--tx-3)' }}>
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   CALENDAR VIEW
   ═══════════════════════════════════════════════════════════ */
function CalendarView({ tasks, onTaskClick }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Build map: date string → tasks
  const tasksByDate = {};
  tasks.forEach(t => {
    if (!t.due_date) return;
    const d = t.due_date.slice(0, 10);
    if (!tasksByDate[d]) tasksByDate[d] = [];
    tasksByDate[d].push(t);
  });

  const cells = [];
  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setMonthOffset(p => p - 1)} className="btn-ghost btn-sm">&larr;</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{monthLabel}</span>
        <button onClick={() => setMonthOffset(p => p + 1)} className="btn-ghost btn-sm">&rarr;</button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', padding: '6px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} style={{ minHeight: 80, background: 'var(--surface)', borderRadius: 4 }} />;

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasksByDate[dateStr] || [];
          const isToday = dateStr === todayStr;

          return (
            <div key={dateStr} style={{
              minHeight: 80, padding: '4px 6px', background: isToday ? 'var(--accent-soft)' : 'var(--surface)',
              border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 4,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--tx-2)', marginBottom: 2 }}>
                {day}
              </div>
              {dayTasks.slice(0, 3).map(t => {
                const stColor = STATUS_COLORS[STATUS_RMAP[t.status] || t.status] || '#606060';
                return (
                  <div key={t._id || t.id} onClick={() => onTaskClick(t)}
                    style={{
                      fontSize: 10, padding: '2px 5px', borderRadius: 3, cursor: 'pointer',
                      background: `${stColor}18`, color: stColor, fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={t.title}>
                    {t.title}
                  </div>
                );
              })}
              {dayTasks.length > 3 && (
                <div style={{ fontSize: 9, color: 'var(--tx-3)', fontWeight: 600 }}>+{dayTasks.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unscheduled tasks */}
      {(() => {
        const unscheduled = tasks.filter(t => !t.due_date);
        if (unscheduled.length === 0) return null;
        return (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
              No Due Date ({unscheduled.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {unscheduled.slice(0, 20).map(t => (
                <div key={t._id || t.id} onClick={() => onTaskClick(t)}
                  style={{
                    fontSize: 11, padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
                    background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--tx-2)',
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
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
      borderBottom: '1px solid var(--border)', marginBottom: 4, marginTop: 8,
    }}>
      <ChevronDown size={14} color="var(--tx-3)" style={{ transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
      {color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>({count})</span>
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function Tasks() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(searchParams.get('new') === '1');
  const [selectedTask, setSelectedTask] = useState(null);

  // View + Filter state
  const [view, setView] = useState(() => localStorage.getItem('tasks_view') || 'list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [groupBy, setGroupBy] = useState('none');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(false);

  // Persist view
  useEffect(() => { localStorage.setItem('tasks_view', view); }, [view]);

  // Preview-as-client support
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;

  // Fetch data
  const fetchTasks = useCallback(async () => {
    try {
      const url = isPreview && previewClientId
        ? `${API}/tasks?assignee_user_id=${previewClientId}`
        : `${API}/tasks`;
      const r = await ax().get(url);
      const d = r.data;
      const arr = Array.isArray(d) ? d : d?.items || [];
      setTasks(arr.map(mapTaskFromApi));
    } catch (err) { if (err.response?.status !== 401) console.error('Failed to load tasks'); }
    setLoading(false);
  }, [isPreview, previewClientId]);

  const fetchProjects = useCallback(async () => {
    try { const r = await ax().get(`${API}/projects`); setProjects(r.data); } catch {}
  }, []);

  const fetchUsers = useCallback(async () => {
    try { const r = await ax().get(`${API}/users`); setUsers(r.data); } catch {}
  }, []);

  useEffect(() => { fetchTasks(); fetchProjects(); fetchUsers(); }, [fetchTasks, fetchProjects, fetchUsers]);

  // Auto-refresh every 30s for real-time feel
  useEffect(() => {
    const interval = setInterval(() => { fetchTasks(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // Active filter count
  const activeFilterCount = [filterStatus, filterPriority, filterAssignee, filterProject].filter(f => f !== 'all').length;

  // Get unique assignees from tasks
  const uniqueAssignees = useMemo(() => {
    const map = {};
    tasks.forEach(t => { if (t.assignee) map[t.assignee] = true; });
    return Object.keys(map).sort();
  }, [tasks]);

  // Get unique projects from tasks
  const uniqueProjects = useMemo(() => {
    const map = {};
    tasks.forEach(t => { if (t.project) map[t.project] = t.project_id; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = tasks
      .filter(t => filterStatus === 'all' || t.status === filterStatus)
      .filter(t => filterPriority === 'all' || t.priority === filterPriority)
      .filter(t => filterAssignee === 'all' || t.assignee === filterAssignee)
      .filter(t => filterProject === 'all' || t.project === filterProject)
      .filter(t => {
        if (!search) return true;
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) ||
          (t.assignee || '').toLowerCase().includes(q) ||
          (t.project || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q);
      });

    // Sort
    switch (sortBy) {
      case 'oldest': list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)); break;
      case 'name': list.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'due_soon': list.sort((a, b) => daysUntil(a.due_date) - daysUntil(b.due_date)); break;
      case 'priority': list.sort((a, b) => (PRIORITY_SORT_ORDER[a.priority] ?? 9) - (PRIORITY_SORT_ORDER[b.priority] ?? 9)); break;
      default: list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); break;
    }

    return list;
  }, [tasks, filterStatus, filterPriority, filterAssignee, filterProject, search, sortBy]);

  // Grouping
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;

    const groups = {};
    filtered.forEach(t => {
      let key, label, color;
      switch (groupBy) {
        case 'status':
          key = t.status || 'Todo';
          label = key;
          color = STATUS_COLORS[key] || 'var(--tx-3)';
          break;
        case 'priority':
          key = t.priority || 'Normal';
          label = key;
          color = PRIORITY_COLORS[key] || 'var(--tx-3)';
          break;
        case 'project':
          key = t.project || '_none';
          label = t.project || 'No Project';
          color = key === '_none' ? 'var(--tx-3)' : 'var(--accent)';
          break;
        case 'assignee':
          key = t.assignee || '_unassigned';
          label = t.assignee || 'Unassigned';
          color = key === '_unassigned' ? 'var(--tx-3)' : avatarBg(t.assignee);
          break;
        default:
          key = 'all'; label = 'All'; color = null;
      }
      if (!groups[key]) groups[key] = { label, color, items: [] };
      groups[key].items.push(t);
    });

    const order = groupBy === 'status' ? STATUSES :
                  groupBy === 'priority' ? PRIORITIES :
                  Object.keys(groups).sort((a, b) => {
                    if (a === '_none' || a === '_unassigned') return 1;
                    if (b === '_none' || b === '_unassigned') return -1;
                    return a.localeCompare(b);
                  });

    return order.filter(k => groups[k]).map(k => ({ key: k, ...groups[k] }));
  }, [filtered, groupBy]);

  const toggleGroup = (key) => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  // Actions
  const toggleDone = async (id) => {
    const task = tasks.find(t => t._id === id);
    if (!task) return;
    const newStatus = task.status === 'Done' ? 'todo' : 'done';
    // Guard: incomplete subtasks
    if (newStatus === 'done' && task.subtask_count > 0 && task.completed_subtask_count < task.subtask_count) {
      toast.error(`Complete all subtasks first (${task.completed_subtask_count}/${task.subtask_count} done)`);
      return;
    }
    // Guard: active blockers
    if (newStatus === 'done' && (task.blocked_by_tasks || []).some(b => b.status !== 'done')) {
      toast.error('This task is blocked by incomplete tasks');
      return;
    }
    try { await ax().patch(`${API}/tasks/${id}`, { status: newStatus }); fetchTasks(); }
    catch { toast.error('Failed to update task'); }
  };

  const handleDelete = async (id) => {
    try { await ax().delete(`${API}/tasks/${id}`); setSelectedTask(null); toast.success('Task deleted'); fetchTasks(); }
    catch { toast.error('Failed to delete task'); }
  };

  const kanbanQuickAdd = async (title, status) => {
    try {
      await ax().post(`${API}/tasks`, { title, status: STATUS_MAP[status] || 'todo', priority: 'medium', visibility: 'both' });
      fetchTasks();
    } catch { toast.error('Failed to create task'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(t => t._id || t.id)));
  };

  const executeBulkAction = async (action, value) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await ax().post(`${API}/tasks/batch-update`, { task_ids: ids, action, value });
      toast.success(`${action === 'delete' ? 'Deleted' : 'Updated'} ${ids.length} task(s)`);
      setSelectedIds(new Set());
      setBulkAction(false);
      fetchTasks();
    } catch { toast.error('Bulk action failed'); }
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterAssignee('all');
    setFilterProject('all');
    setSearch('');
  };

  // Render list rows (with optional grouping)
  const renderList = (items) => items.map(t => (
    <TaskRow key={t._id} task={t} onToggle={toggleDone} onClick={() => setSelectedTask(t)}
      selected={selectedIds.has(t._id || t.id)} onToggleSelect={toggleSelect} />
  ));


  /* ── Loading ── */
  if (loading) {
    return (
      <div className="page-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="spin" color="var(--tx-3)" />
      </div>
    );
  }

  return (
    <div className="page-fill" style={{ flexDirection: 'column' }}>
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} onSave={fetchTasks} projects={projects} users={users} />}
      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)}
          onRefresh={() => { fetchTasks(); }}
          onDelete={handleDelete} users={users} allTasks={tasks} />
      )}

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <CheckSquare size={18} color="var(--accent)" />
        <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.03em', margin: 0 }}>Tasks</h1>
        <span style={{ fontSize: 11, color: 'var(--tx-3)', padding: '2px 8px', background: 'var(--bg-elevated)', borderRadius: 10, fontWeight: 600 }}>
          {filtered.length}{filtered.length !== tasks.length ? ` / ${tasks.length}` : ''}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={async () => {
          try {
            const res = await ax().get(`${API}/exports/tasks`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a'); a.href = url; a.download = 'tasks_export.csv';
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
          } catch { toast.error('Export failed'); }
        }} className="btn-ghost btn-sm" style={{ gap: 4 }}>
          <ArrowUpDown size={12} /> Export
        </button>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm" style={{ gap: 5 }}>
          <Plus size={13} /> New Task
        </button>
      </div>

      {/* ── KPI Bar ── */}
      <KpiBar tasks={tasks} />

      {/* ── Toolbar ── */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
            <Search size={13} color="var(--tx-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
              style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px 7px 30px', fontSize: 12.5, color: 'var(--tx-1)', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Quick status pills */}
          <div style={{ display: 'flex', gap: 3 }}>
            {[{ v: 'all', l: 'All' }, ...STATUSES.map(s => ({ v: s, l: s === 'In Progress' ? 'Active' : s }))].map(({ v, l }) => (
              <button key={v} onClick={() => setFilterStatus(v)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid',
                borderColor: filterStatus === v ? 'var(--accent)' : 'var(--border)',
                background: filterStatus === v ? 'var(--accent)' : 'transparent',
                color: filterStatus === v ? '#fff' : 'var(--tx-3)',
                cursor: 'pointer', transition: 'all .1s', whiteSpace: 'nowrap',
              }}>{l}</button>
            ))}
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              background: showFilters || activeFilterCount > 0 ? 'var(--accent)' : 'var(--bg-elevated)',
              color: showFilters || activeFilterCount > 0 ? '#fff' : 'var(--tx-2)',
              border: '1px solid', borderColor: showFilters || activeFilterCount > 0 ? 'var(--accent)' : 'var(--border)',
              borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
            }}>
            <Filter size={11} />
            {activeFilterCount > 0 && (
              <span style={{ background: '#fff', color: 'var(--accent)', fontSize: 9, fontWeight: 800, padding: '0 4px', borderRadius: 8, lineHeight: '14px' }}>
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

          {/* Group by (list view only) */}
          {view === 'list' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Layers size={11} color="var(--tx-3)" />
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}

          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 7, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {[
              { id: 'list', icon: List },
              { id: 'board', icon: LayoutGrid },
              { id: 'calendar', icon: Calendar },
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
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Priority</span>
              <PillSelect
                value={filterPriority}
                onChange={setFilterPriority}
                options={[{ value: 'all', label: 'All', color: '#9ca3af' }, ...PRIORITY_OPTIONS_LABEL]}
                size="sm"
                minWidth={110}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Assignee</span>
              <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All</option>
                {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Project</span>
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: 'var(--tx-2)', cursor: 'pointer', outline: 'none' }}>
                <option value="all">All</option>
                {uniqueProjects.map(([name]) => <option key={name} value={name}>{name}</option>)}
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

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
          background: 'var(--accent-soft)', borderBottom: '1px solid var(--accent)',
          fontSize: 12, flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{selectedIds.size} selected</span>
          <div style={{ flex: 1 }} />
          <select onChange={e => { if (e.target.value) executeBulkAction('assign', e.target.value); e.target.value = ''; }}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--tx-1)', cursor: 'pointer' }}>
            <option value="">Assign to...</option>
            {(users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select onChange={e => { if (e.target.value) executeBulkAction('move', e.target.value); e.target.value = ''; }}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--tx-1)', cursor: 'pointer' }}>
            <option value="">Move to...</option>
            {STATUSES.map(s => <option key={s} value={STATUS_MAP[s] || s}>{s}</option>)}
          </select>
          <button onClick={() => executeBulkAction('close')} className="btn-ghost btn-xs" style={{ color: '#22c55e', borderColor: '#22c55e40' }}>
            <CheckCircle2 size={12} /> Close All
          </button>
          <button onClick={() => { if (window.confirm(`Delete ${selectedIds.size} task(s)? This cannot be undone.`)) executeBulkAction('delete'); }}
            className="btn-ghost btn-xs" style={{ color: '#ef4444', borderColor: '#ef444440' }}>
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={() => setSelectedIds(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Content Area ── */}
      {view === 'list' ? (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <InlineAdd onCreated={fetchTasks} />

          {filtered.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, background: 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <CheckSquare size={28} color="var(--tx-3)" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 8px' }}>
                {tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
                {tasks.length === 0
                  ? 'Create your first task to start tracking work across projects and team members.'
                  : 'Try adjusting your search or filters to find what you\'re looking for.'}
              </p>
              {tasks.length === 0 ? (
                <button onClick={() => setShowNew(true)} className="btn-primary" style={{ gap: 6 }}>
                  <Plus size={14} /> Create First Task
                </button>
              ) : (
                <button onClick={clearFilters} className="btn-ghost" style={{ gap: 6 }}>
                  <X size={12} /> Clear Filters
                </button>
              )}
            </div>
          ) : grouped ? (
            <div style={{ padding: '0 8px' }}>
              {grouped.map(g => (
                <div key={g.key}>
                  <GroupHeader
                    label={g.label}
                    count={g.items.length}
                    color={g.color}
                    collapsed={!!collapsedGroups[g.key]}
                    onToggle={() => toggleGroup(g.key)}
                  />
                  {!collapsedGroups[g.key] && renderList(g.items)}
                </div>
              ))}
            </div>
          ) : (
            renderList(filtered)
          )}
        </div>
      ) : view === 'calendar' ? (
        /* Calendar */
        <CalendarView tasks={filtered} onTaskClick={setSelectedTask} />
      ) : (
        /* Kanban */
        <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', gap: 12, padding: 12 }}>
          {STATUSES.map(s => {
            const col = filtered.filter(t => t.status === s);
            return <KanbanCol key={s} status={s} tasks={col} onToggle={toggleDone} onCardClick={setSelectedTask} onQuickAdd={kanbanQuickAdd} />;
          })}
        </div>
      )}
    </div>
  );
}

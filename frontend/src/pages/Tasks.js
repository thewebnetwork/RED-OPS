import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Plus, List, LayoutGrid, Search, X, ChevronDown,
  Circle, CheckCircle2, Clock, AlertCircle, ArrowUp, Minus, ArrowDown,
  Calendar, User, Loader2, Trash2, Edit3,
  MessageSquare, FolderKanban, ChevronRight,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STATUSES = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'];
const STATUS_MAP = { Backlog: 'backlog', Todo: 'todo', 'In Progress': 'doing', 'In Review': 'review', Done: 'done' };
const STATUS_RMAP = { backlog: 'Backlog', todo: 'Todo', doing: 'In Progress', waiting_on_client: 'In Progress', review: 'In Review', done: 'Done', open: 'Todo', assigned: 'Todo', revision: 'In Review', delivered: 'Done' };
const STATUS_COLORS = { Backlog: 'var(--tx-3)', Todo: '#3b82f6', 'In Progress': '#f59e0b', 'In Review': '#a855f7', Done: '#22c55e' };
const STATUS_BG = { Backlog: 'var(--bg-elevated)', Todo: '#3b82f618', 'In Progress': '#f59e0b18', 'In Review': '#a855f718', Done: '#22c55e18' };
const PRIORITY_ICON = { Urgent: <AlertCircle size={13} style={{ color: '#ef4444' }} />, High: <ArrowUp size={13} style={{ color: '#f59e0b' }} />, Normal: <Minus size={13} style={{ color: 'var(--tx-3)' }} />, Low: <ArrowDown size={13} style={{ color: 'var(--tx-3)' }} /> };
const PRIORITY_MAP = { Urgent: 'urgent', High: 'high', Normal: 'medium', Low: 'low' };
const PRIORITY_RMAP = { urgent: 'Urgent', high: 'High', medium: 'Normal', low: 'Low' };

function mapTaskFromApi(t) {
  return {
    ...t, _id: t.id,
    status: STATUS_RMAP[t.status] || t.status,
    priority: PRIORITY_RMAP[t.priority] || t.priority || 'Normal',
    assignee: t.assignee_name || '',
    due_date: t.due_at ? t.due_at.substring(0, 10) : '',
    project: t.project_name || '',
  };
}

/* ── Inline Quick-Add ────────────────────────────────────────────────────── */
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
      <Plus size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
      <input ref={ref} value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); }}
        placeholder="Type a task name and press Enter..."
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx-1)', fontSize: 13, padding: '4px 0' }} />
      {saving && <Loader2 size={13} className="spin" style={{ color: 'var(--tx-3)' }} />}
    </div>
  );
}

/* ── New Task Modal ────────────────────────────────────────────────────── */
function NewTaskModal({ onClose, onSave, projects }) {
  const [form, setForm] = useState({ title: '', status: 'Todo', priority: 'Normal', assignee: '', due_date: '', project_id: '', description: '' });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await ax().post(`${API}/tasks`, {
        title: form.title, description: form.description || null,
        status: STATUS_MAP[form.status] || 'todo',
        priority: PRIORITY_MAP[form.priority] || 'medium',
        due_at: form.due_date ? new Date(form.due_date + 'T00:00:00Z').toISOString() : null,
        project_id: form.project_id || null, visibility: 'both',
      });
      toast.success('Task created');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create task'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em' }}>New Task</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>Task Title *</label>
            <input className="input-field" placeholder="What needs to be done?" value={form.title} onChange={e => f('title', e.target.value)} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>Description</label>
            <textarea className="input-field" rows={2} placeholder="Details..." value={form.description} onChange={e => f('description', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>Status</label>
              <select className="input-field" value={form.status} onChange={e => f('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>Priority</label>
              <select className="input-field" value={form.priority} onChange={e => f('priority', e.target.value)}>
                {['Urgent', 'High', 'Normal', 'Low'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>Due Date</label>
              <input className="input-field" type="date" value={form.due_date} onChange={e => f('due_date', e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11.5, color: 'var(--tx-3)', display: 'block', marginBottom: 5 }}>Project</label>
              <select className="input-field" value={form.project_id} onChange={e => f('project_id', e.target.value)}>
                <option value="">No project</option>
                {(projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={!form.title.trim() || saving}>
              {saving ? <Loader2 size={13} className="spin" /> : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Task Detail Drawer ──────────────────────────────────────────────────── */
function TaskDetail({ task, onClose, onRefresh, onDelete }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);

  // Editable fields
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(false);
  const [desc, setDesc] = useState(task.description || '');

  useEffect(() => {
    setLoadingComments(true);
    setTitle(task.title);
    setDesc(task.description || '');
    Promise.all([
      ax().get(`${API}/tasks/${task.id}/comments`).then(r => setComments(r.data)).catch(() => {}),
      ax().get(`${API}/tasks/${task.id}/subtasks`).then(r => setSubtasks(r.data)).catch(() => {}),
    ]).finally(() => setLoadingComments(false));
  }, [task.id]);

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

  const handleStatusChange = (newStatus) => handleFieldUpdate('status', STATUS_MAP[newStatus] || newStatus);
  const handlePriorityChange = (newPri) => handleFieldUpdate('priority', PRIORITY_MAP[newPri] || newPri);
  const handleDueChange = (val) => handleFieldUpdate('due_at', val ? new Date(val + 'T00:00:00Z').toISOString() : null);

  const saveTitle = () => {
    if (title.trim() && title !== task.title) handleFieldUpdate('title', title.trim());
    setEditTitle(false);
  };
  const saveDesc = () => {
    if (desc !== (task.description || '')) handleFieldUpdate('description', desc);
    setEditDesc(false);
  };

  /* ── Subtask actions ──────────────────────────────────────────────────── */
  const toggleSubtask = async (stId, currentStatus) => {
    const newSt = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await ax().patch(`${API}/tasks/${stId}`, { status: newSt });
      setSubtasks(prev => prev.map(s => s.id === stId ? { ...s, status: newSt } : s));
    } catch { toast.error('Failed to update subtask'); }
  };

  const addSubtask = async () => {
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

  const doneCount = subtasks.filter(s => s.status === 'done').length;

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 440, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 100, display: 'flex', flexDirection: 'column', animation: 'slideRight .15s ease both', boxShadow: '-4px 0 20px rgba(0,0,0,.15)' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Task Detail</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { if (window.confirm('Delete this task?')) onDelete(task.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={14} /></button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={14} /></button>
          </div>
        </div>
        {/* Editable title */}
        {editTitle ? (
          <input className="input-field" value={title} onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); }}
            autoFocus style={{ fontSize: 15, fontWeight: 700, padding: '4px 8px' }} />
        ) : (
          <h3 onClick={() => setEditTitle(true)} style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--tx-1)', cursor: 'pointer' }}>
            {task.title} <Edit3 size={11} style={{ color: 'var(--tx-3)', marginLeft: 4, verticalAlign: 'middle' }} />
          </h3>
        )}
        {/* Editable description */}
        {editDesc ? (
          <textarea className="input-field" value={desc} onChange={e => setDesc(e.target.value)}
            onBlur={saveDesc} autoFocus rows={2} style={{ fontSize: 12.5, marginTop: 8 }} />
        ) : (
          <p onClick={() => setEditDesc(true)} style={{ fontSize: 12.5, color: desc ? 'var(--tx-2)' : 'var(--tx-3)', margin: '8px 0 0', lineHeight: 1.5, cursor: 'pointer' }}>
            {desc || 'Add a description...'} <Edit3 size={10} style={{ color: 'var(--tx-3)', marginLeft: 2, verticalAlign: 'middle' }} />
          </p>
        )}
      </div>

      {/* Meta — editable fields */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <select className="input-field" value={task.status} onChange={e => handleStatusChange(e.target.value)}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, width: 'auto' }}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input-field" value={task.priority} onChange={e => handlePriorityChange(e.target.value)}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, width: 'auto' }}>
          {['Urgent', 'High', 'Normal', 'Low'].map(p => <option key={p}>{p}</option>)}
        </select>
        <input type="date" className="input-field" value={task.due_date || ''} onChange={e => handleDueChange(e.target.value)}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, width: 'auto' }} />
        {task.assignee && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--tx-3)' }}>
            <User size={11} /> {task.assignee}
          </span>
        )}
        {task.project && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--tx-3)' }}>
            <FolderKanban size={11} /> {task.project}
          </span>
        )}
      </div>

      {/* Subtasks — interactive */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          Subtasks ({doneCount}/{subtasks.length})
          {subtasks.length > 0 && (
            <div style={{ flex: 1, height: 3, background: 'var(--bg-elevated)', borderRadius: 2, marginLeft: 8 }}>
              <div style={{ height: '100%', width: `${subtasks.length > 0 ? (doneCount / subtasks.length) * 100 : 0}%`, background: '#22c55e', borderRadius: 2, transition: 'width .2s' }} />
            </div>
          )}
        </div>
        {subtasks.map(st => (
          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', group: true }}
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
              <X size={12} />
            </button>
          </div>
        ))}
        {/* Add subtask inline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Plus size={13} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
          <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addSubtask(); }}
            placeholder="Add subtask..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--tx-1)', padding: '3px 0' }} />
          {addingSubtask && <Loader2 size={12} className="spin" style={{ color: 'var(--tx-3)' }} />}
        </div>
      </div>

      {/* Comments */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={12} /> Comments ({comments.length})
        </div>
        {loadingComments && <div style={{ textAlign: 'center', padding: 16 }}><Loader2 size={16} className="spin" color="var(--tx-3)" /></div>}
        {comments.map(c => (
          <div key={c.id} style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-1)' }}>{c.user_name || 'Unknown'}</span>
              <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{new Date(c.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.5 }}>{c.content}</div>
          </div>
        ))}
        {!loadingComments && comments.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--tx-3)', textAlign: 'center', padding: 20 }}>No comments yet</div>
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
  );
}

/* ── List Row ──────────────────────────────────────────────────────────── */
function TaskRow({ task, onToggle, onClick }) {
  const done = task.status === 'Done';
  const overdue = task.due_date && new Date(task.due_date) < new Date() && !done;
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .08s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <button onClick={e => { e.stopPropagation(); onToggle(task._id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: done ? '#22c55e' : 'var(--tx-3)', padding: 0, flexShrink: 0, display: 'flex' }}>
        {done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: done ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2, display: 'flex', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.project && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FolderKanban size={10} /> {task.project}</span>}
          {task.subtask_count > 0 && <span>{task.completed_subtask_count}/{task.subtask_count} subtasks</span>}
          {task.comment_count > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><MessageSquare size={10} /> {task.comment_count}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {PRIORITY_ICON[task.priority]}
        {task.assignee && (
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {task.assignee.charAt(0)}
          </div>
        )}
        {task.due_date && (
          <span style={{ fontSize: 11, color: overdue ? '#ef4444' : 'var(--tx-3)', fontWeight: overdue ? 600 : 400, display: 'flex', alignItems: 'center', gap: 3 }}>
            {overdue && <AlertCircle size={11} />}
            {new Date(task.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
          </span>
        )}
        <div style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: STATUS_BG[task.status], color: STATUS_COLORS[task.status] }}>
          {task.status}
        </div>
      </div>
    </div>
  );
}

/* ── Kanban Column ─────────────────────────────────────────────────────── */
function KanbanCol({ status, tasks, onToggle, onCardClick, onQuickAdd }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const color = STATUS_COLORS[status];

  const save = async () => {
    if (!text.trim()) { setAdding(false); return; }
    await onQuickAdd(text.trim(), status);
    setText('');
    setAdding(false);
  };

  return (
    <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>{status}</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tx-3)', background: 'var(--bg-overlay)', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>{tasks.length}</span>
        <button onClick={() => setAdding(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex' }}><Plus size={14} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {adding && (
          <div className="kanban-card" style={{ padding: '8px 10px' }}>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setAdding(false); }}
              onBlur={save} autoFocus placeholder="Task title..."
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--tx-1)' }} />
          </div>
        )}
        {tasks.map(task => {
          const done = task.status === 'Done';
          const overdue = task.due_date && new Date(task.due_date) < new Date() && !done;
          return (
            <div key={task._id} className="kanban-card" onClick={() => onCardClick(task)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: done ? 'var(--tx-3)' : 'var(--tx-1)', flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                {PRIORITY_ICON[task.priority]}
              </div>
              {task.project && <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 3 }}><FolderKanban size={10} /> {task.project}</div>}
              {task.subtask_count > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ flex: 1, height: 2, background: 'var(--bg-elevated)', borderRadius: 1 }}>
                    <div style={{ height: '100%', width: `${(task.completed_subtask_count / task.subtask_count) * 100}%`, background: '#22c55e', borderRadius: 1 }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--tx-3)' }}>{task.completed_subtask_count}/{task.subtask_count}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {task.assignee && (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'white' }}>
                    {task.assignee.charAt(0)}
                  </div>
                )}
                <span style={{ fontSize: 10, flex: 1, color: 'var(--tx-3)' }}>{task.assignee ? task.assignee.split(' ')[0] : ''}</span>
                {task.comment_count > 0 && <span style={{ fontSize: 10, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 2 }}><MessageSquare size={9} /> {task.comment_count}</span>}
                {task.due_date && (
                  <span style={{ fontSize: 10, color: overdue ? '#ef4444' : 'var(--tx-3)', fontWeight: overdue ? 600 : 400 }}>
                    {new Date(task.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */
export default function Tasks() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView] = useState(() => localStorage.getItem('tasks_view') || 'list');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(searchParams.get('new') === '1');
  const [selectedTask, setSelectedTask] = useState(null);

  const changeView = (v) => { setView(v); localStorage.setItem('tasks_view', v); };

  const fetchTasks = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/tasks`);
      const d = r.data;
      const arr = Array.isArray(d) ? d : d?.items || [];
      setTasks(arr.map(mapTaskFromApi));
    } catch (err) { if (err.response?.status !== 401) console.error('Failed to load tasks'); }
    setLoading(false);
  }, []);

  const fetchProjects = useCallback(async () => {
    try { const r = await ax().get(`${API}/projects`); setProjects(r.data); } catch {}
  }, []);

  useEffect(() => { fetchTasks(); fetchProjects(); }, [fetchTasks, fetchProjects]);

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || t.status === filter;
    return matchSearch && matchFilter;
  });

  const toggleDone = async (id) => {
    const task = tasks.find(t => t._id === id);
    if (!task) return;
    const newStatus = task.status === 'Done' ? 'todo' : 'done';
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

  return (
    <div className="page-fill">
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} onSave={fetchTasks} projects={projects} />}
      {selectedTask && (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)}
          onRefresh={() => { fetchTasks(); setSelectedTask(prev => prev); }}
          onDelete={handleDelete} />
      )}

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.03em', margin: 0, marginRight: 4 }}>Tasks</h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'All'], ['Todo', 'Todo'], ['In Progress', 'Active'], ['In Review', 'Review'], ['Done', 'Done']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid',
              borderColor: filter === v ? 'var(--red)' : 'var(--border)',
              background: filter === v ? 'var(--red-bg)' : 'transparent',
              color: filter === v ? '#e8404e' : 'var(--tx-2)', cursor: 'pointer', transition: 'all .1s',
            }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..."
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px 6px 28px', fontSize: 12.5, color: 'var(--tx-1)', outline: 'none', width: 180 }} />
        </div>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
          {[['list', <List size={13} />], ['board', <LayoutGrid size={13} />]].map(([v, ic]) => (
            <button key={v} onClick={() => changeView(v)} style={{
              padding: '6px 10px', background: view === v ? 'var(--bg-elevated)' : 'transparent', border: 'none',
              cursor: 'pointer', color: view === v ? 'var(--tx-1)' : 'var(--tx-3)', display: 'flex', alignItems: 'center',
            }}>{ic}</button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm" style={{ gap: 5 }}>
          <Plus size={12} /> New Task
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)' }}>
          <Loader2 size={20} className="spin" />
        </div>
      ) : view === 'list' ? (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <InlineAdd onCreated={fetchTasks} />
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: .5 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 6 }}>{tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filter'}</div>
              <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>{tasks.length === 0 ? 'Create your first task to start tracking work.' : 'Try adjusting your filters or search.'}</div>
            </div>
          ) : filtered.map(t => (
            <TaskRow key={t._id} task={t} onToggle={toggleDone} onClick={() => setSelectedTask(t)} />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', gap: 12, padding: 12 }}>
          {STATUSES.map(s => {
            const col = filtered.filter(t => t.status === s);
            return (
              <div key={s} className="kanban-col" style={{ flex: '0 0 240px', height: '100%' }}>
                <KanbanCol status={s} tasks={col} onToggle={toggleDone} onCardClick={setSelectedTask} onQuickAdd={kanbanQuickAdd} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

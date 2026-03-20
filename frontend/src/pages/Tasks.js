import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, List, LayoutGrid, Search, Filter, X, ChevronDown,
  Circle, CheckCircle2, Clock, User, Calendar, Flag,
  MoreHorizontal, Tag, Loader2, AlertTriangle, GripVertical
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const req = (path, opts = {}) => fetch(`${API}${path}`, {
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
  ...opts,
}).then(r => r.ok ? r.json() : Promise.reject(r));

// ── Constants ──
const STATUSES = [
  { key: 'backlog',   label: 'Backlog',     color: '#6b7280' },
  { key: 'todo',      label: 'To Do',       color: '#3b82f6' },
  { key: 'doing',     label: 'In Progress', color: '#f59e0b' },
  { key: 'review',    label: 'In Review',   color: '#a855f7' },
  { key: 'done',      label: 'Done',        color: '#10b981' },
];

const PRIORITIES = [
  { key: 'urgent', label: 'Urgent', color: '#ef4444' },
  { key: 'high',   label: 'High',   color: '#f97316' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'low',    label: 'Low',    color: '#6b7280' },
];

const PRI_COLOR = { urgent: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#6b7280' };
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]));

// ── Sub-components ──
function PriorityDot({ p, size = 7 }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: PRI_COLOR[p] || '#6b7280', display: 'inline-block', flexShrink: 0 }} />;
}

function StatusChip({ s }) {
  const st = STATUS_MAP[s] || { label: s, color: '#6b7280' };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: st.color + '20', color: st.color, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
      {st.label}
    </span>
  );
}

function Avatar({ name, size = 22 }) {
  const ch = (name || '?').charAt(0).toUpperCase();
  const hue = [...(name || 'X')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `hsl(${hue}, 55%, 45%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .42, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {ch}
    </div>
  );
}

// ── Task Modal ──
function TaskModal({ task, users, onSave, onClose }) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    assignee_id: task?.assignee_id || '',
    due_date: task?.due_date ? task.due_date.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.due_date) delete payload.due_date;
      if (!payload.assignee_id) delete payload.assignee_id;
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-1))' }}>
            {task ? 'Edit Task' : 'New Task'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-3))' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <input
            className="input-field"
            placeholder="Task title"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            autoFocus
            style={{ fontSize: 15, fontWeight: 600 }}
          />

          {/* Description */}
          <textarea
            className="input-field"
            placeholder="Add a description..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />

          {/* Row: Status + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-3))', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Status</label>
              <select className="input-field" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-3))', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Priority</label>
              <select className="input-field" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Assignee + Due date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-3))', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Assignee</label>
              <select className="input-field" value={form.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-3))', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Due Date</label>
              <input type="date" className="input-field" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} className="btn-ghost-dark" style={{ padding: '8px 16px' }}>Cancel</button>
          <button onClick={save} className="btn-primary-dark" style={{ padding: '8px 18px' }} disabled={!form.title.trim() || saving}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : (task ? 'Save Changes' : 'Create Task')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ──
function KanbanColumn({ status, tasks, onStatusChange, onEdit, onDelete }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      style={{
        flex: '0 0 240px',
        background: 'hsl(var(--surface-2))',
        border: `1px solid ${dragOver ? status.color + '60' : 'hsl(var(--border))'}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
        transition: 'border-color .15s',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const id = e.dataTransfer.getData('taskId');
        if (id) onStatusChange(id, status.key);
      }}
    >
      {/* Column header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status.color }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-2))', flex: 1 }}>{status.label}</span>
        <span style={{ fontSize: 11, color: 'hsl(var(--text-3))', background: 'hsl(var(--surface-3))', padding: '1px 6px', borderRadius: 10 }}>{tasks.length}</span>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {tasks.map(task => (
          <KanbanCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({ task, onEdit, onDelete }) {
  const [menu, setMenu] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('taskId', task.id)}
      className="kanban-card"
      style={{ marginBottom: 6, position: 'relative', cursor: 'grab' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <PriorityDot p={task.priority} size={7} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--text-1))', lineHeight: 1.35, marginBottom: 6 }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            {task.due_date && (
              <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: isOverdue ? '#ef4444' : 'hsl(var(--text-3))' }}>
                <Calendar size={9} />
                {new Date(task.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task.assignee_name && (
              <Avatar name={task.assignee_name} size={16} />
            )}
          </div>
        </div>
        <button
          onClick={() => setMenu(m => !m)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-3))', padding: 2, flexShrink: 0, opacity: .6 }}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>
      {menu && (
        <div style={{ position: 'absolute', top: 28, right: 0, background: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border))', borderRadius: 7, padding: '4px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
          <button onClick={() => { onEdit(task); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-2))', fontSize: 12, borderRadius: 5, whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--surface-2))'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >Edit</button>
          <button onClick={() => { onDelete(task.id); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, borderRadius: 5, whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >Delete</button>
        </div>
      )}
    </div>
  );
}

// ── List Row ──
function TaskRow({ task, onEdit, onStatusChange, onDelete }) {
  const [menu, setMenu] = useState(false);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 14px',
      borderBottom: '1px solid hsl(var(--border))',
      transition: 'background .1s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--surface-2))'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Status toggle */}
      <button
        onClick={() => {
          const idx = STATUSES.findIndex(s => s.key === task.status);
          const next = STATUSES[(idx + 1) % STATUSES.length].key;
          onStatusChange(task.id, next);
        }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: STATUS_MAP[task.status]?.color || '#6b7280', padding: 0, flexShrink: 0 }}
      >
        {task.status === 'done' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </button>

      <PriorityDot p={task.priority} />

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: task.status === 'done' ? 'hsl(var(--text-3))' : 'hsl(var(--text-1))', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>
          {task.title}
        </span>
      </div>

      {/* Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <StatusChip s={task.status} />
        {task.due_date && (
          <span style={{ fontSize: 11, color: isOverdue ? '#ef4444' : 'hsl(var(--text-3))', display: 'flex', alignItems: 'center', gap: 3, minWidth: 65 }}>
            <Calendar size={10} />
            {new Date(task.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {task.assignee_name ? (
          <Avatar name={task.assignee_name} size={20} />
        ) : (
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px dashed hsl(var(--border))' }} />
        )}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-3))', padding: 3 }}>
            <MoreHorizontal size={13} />
          </button>
          {menu && (
            <div style={{ position: 'absolute', top: 24, right: 0, background: 'hsl(var(--surface-3))', border: '1px solid hsl(var(--border))', borderRadius: 7, padding: '4px', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
              <button onClick={() => { onEdit(task); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-2))', fontSize: 12, borderRadius: 5, whiteSpace: 'nowrap' }}
                onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--surface-2))'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >Edit</button>
              <button onClick={() => { onDelete(task.id); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, borderRadius: 5, whiteSpace: 'nowrap' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
export default function Tasks() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [modal, setModal] = useState(null); // null | { task } | 'new'

  // Open new task modal if ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') setModal('new');
  }, [searchParams]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, usersRes] = await Promise.all([
        req('/tasks?limit=100'),
        req('/users?limit=50'),
      ]);
      const taskList = tasksRes?.items || tasksRes?.tasks || (Array.isArray(tasksRes) ? tasksRes : []);
      setTasks(taskList);
      const userList = usersRes?.users || (Array.isArray(usersRes) ? usersRes : []);
      setUsers(userList.filter(u => u.account_type !== 'Media Client'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Keyboard shortcut: C to create
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName === 'BODY') {
        setModal('new');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const createTask = async (data) => {
    const res = await req('/tasks', { method: 'POST', body: JSON.stringify(data) });
    setTasks(prev => [res, ...prev]);
  };

  const updateTask = async (id, data) => {
    const res = await req(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...res } : t));
  };

  const deleteTask = async (id) => {
    await req(`/tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const onStatusChange = (id, status) => updateTask(id, { status });

  // Filter tasks
  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  // Group by status for kanban
  const byStatus = Object.fromEntries(STATUSES.map(s => [s.key, filtered.filter(t => t.status === s.key)]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Top Bar ── */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: 12, background: 'hsl(var(--background))', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'hsl(var(--text-1))', letterSpacing: '-.02em' }}>Tasks</h1>
          <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--text-3))', marginTop: 1 }}>{tasks.length} total · Press <kbd style={{ fontSize: 10, padding: '1px 4px', background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 3 }}>C</kbd> to create</p>
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-3))', pointerEvents: 'none' }} />
          <input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 28, width: 180, height: 32, fontSize: 12 }}
          />
        </div>

        {/* Filters */}
        <select className="input-field" style={{ height: 32, fontSize: 12, paddingLeft: 8 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="input-field" style={{ height: 32, fontSize: 12, paddingLeft: 8 }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All priorities</option>
          {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 7, padding: 2 }}>
          {[{ key: 'list', icon: List }, { key: 'kanban', icon: LayoutGrid }].map(({ key, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)} style={{
              padding: '5px 8px', background: view === key ? 'hsl(var(--surface-3))' : 'transparent',
              border: 'none', borderRadius: 5, cursor: 'pointer', color: view === key ? 'hsl(var(--text-1))' : 'hsl(var(--text-3))',
              transition: 'all .15s',
            }}>
              <Icon size={14} />
            </button>
          ))}
        </div>

        <button onClick={() => setModal('new')} className="btn-primary-dark btn-sm" style={{ gap: 5 }}>
          <Plus size={13} /> New Task
        </button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={24} style={{ color: 'hsl(var(--primary))', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : view === 'kanban' ? (

        /* ── Kanban ── */
        <div style={{ flex: 1, overflowX: 'auto', padding: '16px 24px', display: 'flex', gap: 12 }}>
          {STATUSES.map(status => (
            <KanbanColumn
              key={status.key}
              status={status}
              tasks={byStatus[status.key] || []}
              onStatusChange={onStatusChange}
              onEdit={task => setModal({ task })}
              onDelete={deleteTask}
            />
          ))}
        </div>

      ) : (

        /* ── List ── */
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'hsl(var(--text-3))' }}>
              <CheckCircle2 size={32} style={{ opacity: .3, marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>No tasks yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Press C or click New Task to get started</div>
            </div>
          ) : (
            <div style={{ background: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--border))', borderRadius: 10, marginTop: 16, overflow: 'hidden' }}>
              {/* List header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--surface-3))' }}>
                <div style={{ width: 16 }} />
                <div style={{ width: 7 }} />
                <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.07em', textTransform: 'uppercase' }}>Title</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.07em', textTransform: 'uppercase', width: 80 }}>Status</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.07em', textTransform: 'uppercase', width: 65 }}>Due</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-3))', letterSpacing: '.07em', textTransform: 'uppercase', width: 20 }}>Who</div>
                <div style={{ width: 20 }} />
              </div>
              {filtered.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onEdit={t => setModal({ task: t })}
                  onStatusChange={onStatusChange}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <TaskModal
          task={modal === 'new' ? null : modal.task}
          users={users}
          onSave={modal === 'new' ? createTask : (data) => updateTask(modal.task.id, data)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

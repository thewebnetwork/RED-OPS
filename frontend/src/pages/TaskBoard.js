import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Calendar,
  User as UserIcon,
  GripVertical,
  Pencil,
  Search,
  CheckCircle2,
  Loader2,
  X,
  Filter,
  Inbox,
  ChevronDown,
  Flag,
  Circle,
  Clock,
  Tag,
  MoreHorizontal,
  Trash2,
  Users,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLUMNS = [
  { id: 'backlog',          label: 'Backlog',      color: '#94a3b8' },
  { id: 'todo',             label: 'To Do',        color: '#3b82f6' },
  { id: 'doing',            label: 'In Progress',  color: '#f59e0b' },
  { id: 'waiting_on_client',label: 'Waiting',      color: '#8b5cf6' },
  { id: 'review',           label: 'Review',       color: '#06b6d4' },
  { id: 'done',             label: 'Done',         color: '#22c55e' },
];

const PRIORITY = {
  urgent: { label: 'Urgent', color: '#ef4444', bg: '#ef444418' },
  high:   { label: 'High',   color: '#f97316', bg: '#f9731618' },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#f59e0b18' },
  low:    { label: 'Low',    color: '#94a3b8', bg: '#94a3b818' },
};

function avatar(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

function fmtDate(d) {
  if (!d) return null;
  try {
    const dt = new Date(d);
    const now = new Date();
    const diff = Math.floor((dt - now) / 86400000);
    if (diff < 0) return { text: 'Overdue', color: '#ef4444', bg: '#ef444418' };
    if (diff === 0) return { text: 'Today',    color: '#f59e0b', bg: '#f59e0b18' };
    if (diff === 1) return { text: 'Tomorrow', color: '#f59e0b', bg: '#f59e0b18' };
    return { text: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'var(--tx-3)', bg: 'var(--bg-elevated)' };
  } catch { return null; }
}

function InlineCreate({ colId, onSave, onCancel }) {
  const [val, setVal] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  function submit(e) {
    e.preventDefault();
    if (!val.trim()) return onCancel();
    onSave(colId, val.trim());
    setVal('');
  }
  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <input
        ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        placeholder="Task name…"
        style={{
          width: '100%', padding: '7px 10px', background: 'var(--bg-elevated)',
          border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)',
          fontSize: 13, outline: 'none', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button type="submit" style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '6px 0', borderRadius: 6, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}>Add</button>
        <button type="button" onClick={onCancel} style={{ flex: 1, fontSize: 12, fontWeight: 600, padding: '6px 0', borderRadius: 6, background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
      </div>
    </form>
  );
}

function AssigneePicker({ users, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = users.find(u => u.id === value);
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 10px', fontSize: 13, borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-elevated)',
          color: 'var(--tx-1)', cursor: 'pointer',
        }}
      >
        {selected ? (
          <>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#c92a3e22', color: 'var(--red)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatar(selected.name)}</span>
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</span>
          </>
        ) : (
          <>
            <UserIcon size={14} style={{ color: 'var(--tx-3)' }} />
            <span style={{ flex: 1, textAlign: 'left', color: 'var(--tx-3)' }}>Unassigned</span>
          </>
        )}
        <ChevronDown size={12} style={{ color: 'var(--tx-3)' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, marginTop: 4, width: '100%',
          borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--bg-card)', boxShadow: '0 8px 32px #0008',
        }}>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 13, color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <UserIcon size={14} /> Unassigned
          </button>
          {users.map(u => (
            <button key={u.id} type="button"
              onClick={() => { onChange(u.id); setOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', fontSize: 13, background: u.id === value ? '#c92a3e18' : 'none',
                color: u.id === value ? 'var(--red)' : 'var(--tx-1)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#c92a3e22', color: 'var(--red)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{avatar(u.name)}</span>
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickTaskDialog({ task, users, columns, onSave, onClose, saving }) {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    title: task?.title || '', description: task?.description || '',
    status: task?.status || columns[0]?.id || 'todo', priority: task?.priority || 'medium',
    assignee_user_id: task?.assignee_user_id || null,
    due_at: task?.due_at ? task.due_at.substring(0, 10) : '',
  });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function submit(e) { e.preventDefault(); if (!form.title.trim()) return toast.error('Title is required'); onSave({ ...task, ...form }); }

  const inputStyle = {
    width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: 16, boxShadow: '0 24px 64px #000a', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
        </div>
        {/* Body */}
        <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Add details…" rows={3} style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Assignee</label>
              <AssigneePicker users={users} value={form.assignee_user_id} onChange={v => set('assignee_user_id', v)} />
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={form.due_at} onChange={e => set('due_at', e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
          </div>
        </form>
        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 10, background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={submit} disabled={saving} style={{ flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 700, borderRadius: 10, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (<div ref={setNodeRef} style={style}><TaskCard {...props} dragHandleProps={{ ...attributes, ...listeners }} /></div>);
}

function TaskCard({ task, onEdit, dragHandleProps, isDragging }) {
  const pri = PRIORITY[task.priority] || PRIORITY.medium;
  const date = fmtDate(task.due_at);
  const assigneeName = task.assigned_user?.name || task.assignee_name || null;
  return (
    <div
      style={{
        position: 'relative', background: 'var(--bg-card)', borderRadius: 10,
        border: `1px solid ${isDragging ? 'var(--red)' : 'var(--border)'}`,
        boxShadow: isDragging ? '0 12px 40px #0009' : '0 1px 4px #0003',
        cursor: 'pointer', overflow: 'hidden',
        transform: isDragging ? 'rotate(1.5deg)' : 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onClick={() => onEdit(task)}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.borderColor = '#3a3a3a'; }}
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {/* Priority bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: pri.color, borderRadius: '10px 0 0 10px' }} />
      <div style={{ paddingLeft: 10, paddingRight: 12, paddingTop: 10, paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div {...dragHandleProps} style={{ marginTop: 2, flexShrink: 0, cursor: 'grab', color: 'var(--tx-3)', opacity: 0.4 }} onClick={e => e.stopPropagation()}>
            <GripVertical size={13} />
          </div>
          <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', lineHeight: 1.4, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{task.title}</p>
          <button
            style={{ flexShrink: 0, padding: 3, borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', opacity: 0.4, display: 'flex' }}
            onClick={e => { e.stopPropagation(); onEdit(task); }}
          >
            <Pencil size={11} />
          </button>
        </div>
        {task.description && (
          <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4, marginLeft: 19, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: 19, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: pri.bg, color: pri.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: pri.color, flexShrink: 0 }} />
            {pri.label}
          </span>
          {date && (
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: date.bg, color: date.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Calendar size={9} />{date.text}
            </span>
          )}
          {assigneeName && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#c92a3e22', color: 'var(--red)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{avatar(assigneeName)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ col, tasks, onAddTask, onEdit, inlineCreate, setInlineCreate }) {
  const taskIds = tasks.map(t => t.id);
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 272, maxWidth: 272 }}>
      {/* Header */}
      <div style={{
        borderRadius: '10px 10px 0 0', borderTop: `3px solid ${col.color}`,
        background: 'var(--bg-card)', border: `1px solid var(--border)`,
        borderTopColor: col.color, padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1, color: col.color }}>{col.label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: col.color + '22', color: col.color }}>{tasks.length}</span>
        <button
          onClick={() => setInlineCreate(inlineCreate === col.id ? null : col.id)}
          style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex', marginLeft: 2 }}
          title="Add task"
        >
          <Plus size={13} />
        </button>
      </div>
      {/* Body — registered as droppable target */}
      <div ref={setNodeRef} style={{
        flex: 1, borderRadius: '0 0 10px 10px',
        border: '1px solid var(--border)', borderTop: 'none',
        background: isOver ? `${col.color}15` : col.color + '08',
        outline: isOver ? `1px dashed ${col.color}60` : 'none',
        padding: 8, minHeight: 120, display: 'flex', flexDirection: 'column', gap: 6,
        transition: 'background 0.15s',
      }}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (<SortableTaskCard key={task.id} task={task} onEdit={onEdit} />))}
        </SortableContext>
        {inlineCreate === col.id && (<InlineCreate colId={col.id} onSave={onAddTask} onCancel={() => setInlineCreate(null)} />)}
        {tasks.length === 0 && inlineCreate !== col.id && (
          isOver ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: col.color, fontSize: 12, fontWeight: 500 }}>Drop here</div>
          ) : (
            <button
              onClick={() => setInlineCreate(col.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '14px 0', fontSize: 12, color: 'var(--tx-3)',
                background: 'none', border: `2px dashed var(--border)`, borderRadius: 8, cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--tx-3)'; }}
            >
              <Plus size={11} /> Add task
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default function TaskBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineCreateCol, setInlineCreateCol] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const tk = useCallback(() => localStorage.getItem('token'), []);
  const headers = useCallback(() => ({ Authorization: `Bearer ${tk()}` }), [tk]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterAssignee) params.set('assignee_user_id', filterAssignee);
      if (filterStatus) params.set('status', filterStatus);
      if (searchQuery) params.set('search', searchQuery);
      const { data } = await axios.get(`${API}/tasks?${params.toString()}`, { headers: headers() });
      setTasks(Array.isArray(data) ? data : (data.tasks || []));
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filterAssignee, filterStatus, searchQuery, headers]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/tasks/assignable-users`, { headers: headers() });
      setAssignableUsers(Array.isArray(data) ? data : []);
    } catch { }
  }, [headers]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleSave(formData) {
    setSaving(true);
    try {
      if (formData.id) {
        const { data } = await axios.patch(`${API}/tasks/${formData.id}`, formData, { headers: headers() });
        setTasks(prev => prev.map(t => t.id === data.id ? data : t));
        toast.success('Task updated');
      } else {
        const { data } = await axios.post(`${API}/tasks`, formData, { headers: headers() });
        setTasks(prev => [...prev, data]);
        toast.success('Task created');
      }
      setDialogOpen(false);
      setEditingTask(null);
    } catch { toast.error('Failed to save task'); } finally { setSaving(false); }
  }

  async function handleInlineSave(colId, title) {
    setInlineCreateCol(null);
    try {
      const { data } = await axios.post(`${API}/tasks`, { title, status: colId, priority: 'medium' }, { headers: headers() });
      setTasks(prev => [...prev, data]);
      toast.success('Task added');
    } catch { toast.error('Failed to create task'); }
  }

  function openEdit(task) { setEditingTask(task); setDialogOpen(true); }
  function openNew(colId) { setEditingTask({ status: colId || 'todo' }); setDialogOpen(true); }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function handleDragStart({ active }) { setActiveTask(tasks.find(t => t.id === active.id) || null); }
  async function handleDragEnd({ active, over }) {
    setActiveTask(null);
    if (!over || active.id === over.id) return;
    const activeT = tasks.find(t => t.id === active.id);
    const overT = tasks.find(t => t.id === over.id);
    if (!activeT) return;
    const targetColId = COLUMNS.find(c => c.id === over.id)?.id || overT?.status;
    if (!targetColId) return;
    const newStatus = targetColId;
    setTasks(tasks.map(t => t.id === activeT.id ? { ...t, status: newStatus } : t));
    try {
      await axios.patch(`${API}/tasks/${activeT.id}`, { status: newStatus }, { headers: headers() });
    } catch { toast.error('Failed to move task'); loadTasks(); }
  }

  function tasksForCol(colId) {
    return tasks.filter(t => {
      if (t.status !== colId) return false;
      if (searchQuery && !t.title?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterAssignee && t.assignee_user_id !== filterAssignee) return false;
      return true;
    });
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const hasFilters = filterAssignee || filterStatus || searchQuery;

  const selectStyle = {
    padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 7, color: 'var(--tx-2)', fontSize: 13, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', margin: 0, letterSpacing: '-0.03em' }}>Task Board</h1>
            <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 3 }}>
              {totalTasks} tasks · {doneTasks} done
              {totalTasks > 0 && (
                <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 60, height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${progress}%`, height: '100%', background: '#22c55e', borderRadius: 3, transition: 'width 0.4s' }} />
                  </span>
                  <span style={{ color: '#22c55e', fontWeight: 600 }}>{progress}%</span>
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                style={{
                  paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                  fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', width: 180,
                }}
              />
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                fontSize: 13, borderRadius: 8, border: '1px solid var(--border)',
                background: showFilters ? '#c92a3e18' : 'var(--bg-elevated)',
                color: showFilters ? 'var(--red)' : 'var(--tx-2)', cursor: 'pointer',
                borderColor: showFilters ? 'var(--red)' : 'var(--border)',
              }}
            >
              <Filter size={13} /> Filters
            </button>
            <button
              onClick={() => openNew()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={13} /> New Task
            </button>
          </div>
        </div>
        {showFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Filter:</span>
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={selectStyle}>
              <option value="">All Assignees</option>
              {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="">All Statuses</option>
              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            {hasFilters && (
              <button
                onClick={() => { setFilterAssignee(''); setFilterStatus(''); setSearchQuery(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Board */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--tx-3)' }}>
            <div className="spinner-ring" />
            <p style={{ fontSize: 13 }}>Loading tasks…</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div style={{ display: 'flex', gap: 14, padding: 20, height: '100%', minWidth: 'max-content' }}>
              {COLUMNS.map(col => (
                <KanbanColumn key={col.id} col={col} tasks={tasksForCol(col.id)}
                  onAddTask={handleInlineSave} onEdit={openEdit}
                  inlineCreate={inlineCreateCol} setInlineCreate={setInlineCreateCol}
                />
              ))}
            </div>
            <DragOverlay>{activeTask && (<TaskCard task={activeTask} onEdit={() => {}} isDragging />)}</DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Empty state */}
      {!loading && tasks.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, top: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', pointerEvents: 'auto' }}>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Inbox size={26} style={{ color: 'var(--tx-3)' }} />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 6px' }}>No tasks yet</h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 16px' }}>Create your first task to get started</p>
            <button
              onClick={() => openNew()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10, background: 'var(--red)', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              <Plus size={13} /> Create Task
            </button>
          </div>
        </div>
      )}

      {dialogOpen && (
        <QuickTaskDialog
          task={editingTask} users={assignableUsers} columns={COLUMNS}
          onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingTask(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}

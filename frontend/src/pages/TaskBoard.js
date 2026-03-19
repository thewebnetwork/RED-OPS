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

const API = process.env.REACT_APP_API_URL || 'https://red-ops-production.up.railway.app';

const COLUMNS = [
  {
    id: 'backlog',
    label: 'Backlog',
    color: '#94a3b8',
    borderColor: 'border-t-slate-400',
    bg: 'bg-slate-50',
    dot: 'bg-slate-400',
    countBg: 'bg-slate-200 text-slate-700',
    headerText: 'text-slate-600',
  },
  {
    id: 'todo',
    label: 'To Do',
    color: '#3b82f6',
    borderColor: 'border-t-blue-500',
    bg: 'bg-blue-50/60',
    dot: 'bg-blue-500',
    countBg: 'bg-blue-100 text-blue-700',
    headerText: 'text-blue-700',
  },
  {
    id: 'doing',
    label: 'In Progress',
    color: '#f59e0b',
    borderColor: 'border-t-amber-500',
    bg: 'bg-amber-50/60',
    dot: 'bg-amber-500',
    countBg: 'bg-amber-100 text-amber-700',
    headerText: 'text-amber-700',
  },
  {
    id: 'waiting_on_client',
    label: 'Waiting',
    color: '#8b5cf6',
    borderColor: 'border-t-purple-500',
    bg: 'bg-purple-50/60',
    dot: 'bg-purple-500',
    countBg: 'bg-purple-100 text-purple-700',
    headerText: 'text-purple-700',
  },
  {
    id: 'review',
    label: 'Review',
    color: '#06b6d4',
    borderColor: 'border-t-cyan-500',
    bg: 'bg-cyan-50/60',
    dot: 'bg-cyan-500',
    countBg: 'bg-cyan-100 text-cyan-700',
    headerText: 'text-cyan-700',
  },
  {
    id: 'done',
    label: 'Done',
    color: '#22c55e',
    borderColor: 'border-t-green-500',
    bg: 'bg-green-50/60',
    dot: 'bg-green-500',
    countBg: 'bg-green-100 text-green-700',
    headerText: 'text-green-700',
  },
];

const PRIORITY = {
  urgent: { label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' },
  high:   { label: 'High',   color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  low:    { label: 'Low',    color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  dot: 'bg-slate-400' },
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
    if (diff < 0) return { text: 'Overdue', cls: 'text-red-600 bg-red-50 border-red-200' };
    if (diff === 0) return { text: 'Today', cls: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-amber-600 bg-amber-50 border-amber-200' };
    return {
      text: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cls: 'text-slate-500 bg-slate-50 border-slate-200',
    };
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
    <form onSubmit={submit} className="mt-2">
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Escape' && onCancel()} placeholder="Task name…" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder-slate-400" />
      <div className="flex gap-1.5 mt-1.5">
        <button type="submit" className="flex-1 text-xs font-medium py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors">Add</button>
        <button type="button" onClick={onCancel} className="flex-1 text-xs font-medium py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

function AssigneePicker({ users, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = users.find(u => u.id === value);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
        {selected ? (<><span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">{avatar(selected.name)}</span><span className="flex-1 text-left truncate">{selected.name}</span></>) : (<><UserIcon size={14} className="text-slate-400" /><span className="flex-1 text-left text-slate-400">Unassigned</span></>)}
        <ChevronDown size={12} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-slate-500"><UserIcon size={14} /> Unassigned</button>
          {users.map(u => (<button key={u.id} type="button" onClick={() => { onChange(u.id); setOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${u.id === value ? 'bg-red-50 text-red-700 font-medium' : ''}`}><span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center">{avatar(u.name)}</span>{u.name}</button>))}
        </div>
      )}
    </div>
  );
}

function QuickTaskDialog({ task, users, columns, onSave, onClose, saving }) {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({ title: task?.title || '', description: task?.description || '', status: task?.status || columns[0]?.id || 'todo', priority: task?.priority || 'medium', assignee_user_id: task?.assignee_user_id || null, due_at: task?.due_at ? task.due_at.substring(0, 10) : '' });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function submit(e) { e.preventDefault(); if (!form.title.trim()) return toast.error('Title is required'); onSave({ ...task, ...form }); }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Title *</label><input autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent" /></div>
          <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Add details…" rows={3} className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Status</label><select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">{columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Priority</label><select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Assignee</label><AssigneePicker users={users} value={form.assignee_user_id} onChange={v => set('assignee_user_id', v)} /></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Due Date</label><input type="date" value={form.due_at} onChange={e => set('due_at', e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white" /></div>
          </div>
        </form>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{saving && <Loader2 size={14} className="animate-spin" />}{isEdit ? 'Save Changes' : 'Create Task'}</button>
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
    <div className={`group relative bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer overflow-hidden ${isDragging ? 'rotate-1 shadow-xl ring-2 ring-red-400' : ''}`} onClick={() => onEdit(task)}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${pri.dot}`} />
      <div className="pl-3 pr-3 pt-3 pb-2.5">
        <div className="flex items-start gap-2">
          <div {...dragHandleProps} className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0" onClick={e => e.stopPropagation()}><GripVertical size={14} className="text-slate-300" /></div>
          <p className="flex-1 text-sm font-medium text-slate-800 leading-snug line-clamp-2">{task.title}</p>
          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-100 flex-shrink-0" onClick={e => { e.stopPropagation(); onEdit(task); }}><Pencil size={12} className="text-slate-400" /></button>
        </div>
        {task.description && (<p className="text-xs text-slate-400 mt-1.5 ml-5 line-clamp-1">{task.description}</p>)}
        <div className="flex items-center gap-2 mt-2.5 ml-5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${pri.color} ${pri.bg} ${pri.border}`}><span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />{pri.label}</span>
          {date && (<span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md border ${date.cls}`}><Calendar size={10} />{date.text}</span>)}
          {assigneeName && (<span className="ml-auto inline-flex items-center gap-1"><span className="w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold flex items-center justify-center">{avatar(assigneeName)}</span></span>)}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ col, tasks, onAddTask, onEdit, inlineCreate, setInlineCreate }) {
  const taskIds = tasks.map(t => t.id);
  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      <div className={`rounded-t-xl border-t-[3px] ${col.borderColor} bg-white border border-slate-200 px-4 py-3 flex items-center gap-2.5 sticky top-0 z-10`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
        <span className={`text-sm font-semibold flex-1 ${col.headerText}`}>{col.label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.countBg}`}>{tasks.length}</span>
        <button onClick={() => setInlineCreate(inlineCreate === col.id ? null : col.id)} className="p-1 rounded-md hover:bg-slate-100 transition-colors ml-1" title="Add task"><Plus size={14} className="text-slate-500" /></button>
      </div>
      <div className={`flex-1 rounded-b-xl border border-t-0 border-slate-200 ${col.bg} p-2 min-h-[120px] space-y-2`}>
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (<SortableTaskCard key={task.id} task={task} onEdit={onEdit} />))}
        </SortableContext>
        {inlineCreate === col.id && (<InlineCreate colId={col.id} onSave={onAddTask} onCancel={() => setInlineCreate(null)} />)}
        {tasks.length === 0 && inlineCreate !== col.id && (<button onClick={() => setInlineCreate(col.id)} className="w-full flex items-center justify-center gap-1.5 py-4 text-xs text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-300 transition-all"><Plus size={12} />Add task</button>)}
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
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Task Board</h1>
            <p className="text-sm text-slate-500 mt-0.5">{totalTasks} tasks · {doneTasks} done{totalTasks > 0 && (<span className="ml-2 inline-flex items-center gap-1.5"><span className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden"><span className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></span><span className="text-green-600 font-medium">{progress}%</span></span>)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tasks…" className="pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 w-48" /></div>
            <button onClick={() => setShowFilters(f => !f)} className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${showFilters ? 'bg-red-50 border-red-200 text-red-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Filter size={14} />Filters</button>
            <button onClick={() => openNew()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm"><Plus size={14} />New Task</button>
          </div>
        </div>
        {showFilters && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter by:</span>
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"><option value="">All Assignees</option>{assignableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"><option value="">All Statuses</option>{COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            {(filterAssignee || filterStatus || searchQuery) && (<button onClick={() => { setFilterAssignee(''); setFilterStatus(''); setSearchQuery(''); }} className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"><X size={12} /> Clear</button>)}
          </div>
        )}
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center"><div className="flex flex-col items-center gap-3 text-slate-400"><Loader2 size={32} className="animate-spin text-red-500" /><p className="text-sm">Loading tasks…</p></div></div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 p-6 h-full" style={{ minWidth: 'max-content' }}>
              {COLUMNS.map(col => (<KanbanColumn key={col.id} col={col} tasks={tasksForCol(col.id)} onAddTask={handleInlineSave} onEdit={openEdit} inlineCreate={inlineCreateCol} setInlineCreate={setInlineCreateCol} />))}
            </div>
            <DragOverlay>{activeTask && (<TaskCard task={activeTask} onEdit={() => {}} isDragging />)}</DragOverlay>
          </DndContext>
        </div>
      )}
      {!loading && tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '140px' }}>
          <div className="text-center pointer-events-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4"><Inbox size={28} className="text-slate-400" /></div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">No tasks yet</h3>
            <p className="text-sm text-slate-500 mb-4">Create your first task to get started</p>
            <button onClick={() => openNew()} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm"><Plus size={14} />Create Task</button>
          </div>
        </div>
      )}
      {dialogOpen && (<QuickTaskDialog task={editingTask} users={assignableUsers} columns={COLUMNS} onSave={handleSave} onClose={() => { setDialogOpen(false); setEditingTask(null); }} saving={saving} />)}
    </div>
  );
}

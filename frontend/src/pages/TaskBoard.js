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
  Link2,
  User as UserIcon,
  Eye,
  EyeOff,
  GripVertical,
  X,
  Pencil,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', color: 'bg-slate-100 border-slate-300', dot: 'bg-slate-400', textColor: 'text-slate-600' },
  { id: 'todo', label: 'To Do', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500', textColor: 'text-blue-700' },
  { id: 'doing', label: 'Doing', color: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', textColor: 'text-amber-700' },
  { id: 'waiting_on_client', label: 'Waiting on Client', color: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500', textColor: 'text-purple-700' },
  { id: 'review', label: 'Review', color: 'bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500', textColor: 'text-cyan-700' },
  { id: 'done', label: 'Done', color: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', textColor: 'text-emerald-700' },
];

const VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Internal' },
  { value: 'client', label: 'Client' },
  { value: 'both', label: 'Both' },
];

const TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'request_generated', label: 'Request Generated' },
  { value: 'approval', label: 'Approval' },
  { value: 'follow_up', label: 'Follow Up' },
];

function isAdmin(user) {
  return user?.role === 'Administrator';
}

function isClient(user) {
  return user?.account_type === 'Media Client';
}

// ─── Sortable Task Card ──────────────────────────────────────────
function SortableTaskCard({ task, onEdit, canEdit, isClientUser }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: 'task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskCard
        task={task}
        onEdit={onEdit}
        canEdit={canEdit}
        dragListeners={listeners}
        isClientUser={isClientUser}
      />
    </div>
  );
}

function TaskCard({ task, onEdit, canEdit, dragListeners, isClientUser, isOverlay }) {
  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';

  return (
    <div
      data-testid={`task-card-${task.id}`}
      className={`group bg-white rounded-lg border border-slate-200 p-3 mb-2 
        hover:border-slate-300 hover:shadow-sm transition-all duration-150
        ${isOverlay ? 'shadow-lg ring-2 ring-primary/20 rotate-1' : ''}
        ${isOverdue ? 'border-l-2 border-l-red-400' : ''}`}
    >
      <div className="flex items-start gap-2">
        {canEdit && (
          <button
            {...(dragListeners || {})}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0"
            data-testid={`task-drag-handle-${task.id}`}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
            {task.title}
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {task.assignee_name && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <UserIcon className="w-3 h-3" />
                <span className="truncate max-w-[80px]">{task.assignee_name}</span>
              </span>
            )}
            {dueDate && (
              <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                <Calendar className="w-3 h-3" />
                {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {task.request_id && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-500" title={task.request_title || 'Linked request'}>
                <Link2 className="w-3 h-3" />
              </span>
            )}
            {!isClientUser && task.visibility !== 'internal' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-200">
                {task.visibility === 'client' ? <Eye className="w-2.5 h-2.5 mr-0.5" /> : null}
                {task.visibility}
              </Badge>
            )}
          </div>
        </div>

        {canEdit && !isClientUser && onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 shrink-0"
            data-testid={`task-edit-btn-${task.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Column ──────────────────────────────────────────────────────
function KanbanColumn({ column, tasks, onEdit, canEdit, isClientUser, onAddTask }) {
  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      data-testid={`kanban-column-${column.id}`}
      className="flex flex-col min-w-[260px] w-[260px] shrink-0"
    >
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${column.color}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.dot}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${column.textColor}`}>
            {column.label}
          </span>
          <span className="text-xs text-slate-400 font-medium">{tasks.length}</span>
        </div>
        {canEdit && !isClientUser && onAddTask && (
          <button
            onClick={() => onAddTask(column.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            data-testid={`add-task-${column.id}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 bg-slate-50/50 rounded-b-lg border border-t-0 border-slate-200 p-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-220px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              canEdit={canEdit}
              isClientUser={isClientUser}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-400">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Task Form Dialog ────────────────────────────────────────────
function TaskFormDialog({ open, onClose, task, orgUsers, onSave, saving }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'todo',
    visibility: 'internal',
    task_type: 'manual',
    assignee_user_id: '',
    due_at: '',
    request_id: '',
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        visibility: task.visibility || 'internal',
        task_type: task.task_type || 'manual',
        assignee_user_id: task.assignee_user_id || '',
        due_at: task.due_at ? task.due_at.slice(0, 10) : '',
        request_id: task.request_id || '',
      });
    } else {
      setForm({
        title: '',
        description: '',
        status: 'todo',
        visibility: 'internal',
        task_type: 'manual',
        assignee_user_id: '',
        due_at: '',
        request_id: '',
      });
    }
  }, [task, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form, task?.id);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="task-form-dialog">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              data-testid="task-title-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              data-testid="task-description-input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional details..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="task-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger data-testid="task-visibility-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                <SelectTrigger data-testid="task-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assignee</Label>
              <Select
                value={form.assignee_user_id || '_none'}
                onValueChange={(v) => setForm({ ...form, assignee_user_id: v === '_none' ? '' : v })}
              >
                <SelectTrigger data-testid="task-assignee-select">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Unassigned</SelectItem>
                  {orgUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="task-due">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                data-testid="task-due-input"
                value={form.due_at}
                onChange={(e) => setForm({ ...form, due_at: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="task-request">Request ID</Label>
              <Input
                id="task-request"
                data-testid="task-request-input"
                value={form.request_id}
                onChange={(e) => setForm({ ...form, request_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="task-form-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.title.trim()} data-testid="task-form-submit">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {task ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main TaskBoard ──────────────────────────────────────────────
export default function TaskBoard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orgUsers, setOrgUsers] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const userIsAdmin = isAdmin(user);
  const userIsClient = isClient(user);
  const canEdit = userIsAdmin || !userIsClient;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterAssignee) params.append('assignee_user_id', filterAssignee);
      const res = await axios.get(`${API}/tasks?${params.toString()}`);
      setTasks(res.data);
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filterAssignee]);

  // Fetch org users for assignee picker (admin only)
  useEffect(() => {
    if (!userIsAdmin) return;
    axios.get(`${API}/users`)
      .then((res) => {
        const users = (res.data || []).map((u) => ({
          id: u.id,
          name: u.full_name || u.name || u.email,
          email: u.email,
        }));
        setOrgUsers(users);
      })
      .catch(() => {});
  }, [userIsAdmin]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Group tasks by status
  const getColumnTasks = useCallback(
    (statusId) => {
      let filtered = tasks.filter((t) => t.status === statusId);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.assignee_name && t.assignee_name.toLowerCase().includes(q))
        );
      }
      return filtered.sort((a, b) => (a.position || 0) - (b.position || 0));
    },
    [tasks, searchQuery]
  );

  // ─── Drag handlers ─────────────────────────────────────────────
  const handleDragStart = (event) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || !active) return;

    const taskId = active.id;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target column
    let targetStatus = null;

    // Check if dropped over a column (the droppable area)
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask) {
      targetStatus = overTask.status;
    } else {
      // Dropped on empty column area
      const colId = over.id;
      if (COLUMNS.some((c) => c.id === colId)) {
        targetStatus = colId;
      }
    }

    if (!targetStatus) return;

    // If status didn't change and we're over the same task, handle reorder
    if (task.status === targetStatus) {
      const columnTasks = getColumnTasks(targetStatus);
      const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
      const newIndex = columnTasks.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        // Calculate new position
        const prevPos = newIndex > 0 ? reordered[newIndex - 1].position || 0 : 0;
        const nextPos = newIndex < reordered.length - 1 ? reordered[newIndex + 1].position || prevPos + 2000 : prevPos + 2000;
        const newPosition = (prevPos + nextPos) / 2;

        // Optimistic update
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, position: newPosition } : t))
        );

        try {
          await axios.patch(`${API}/tasks/reorder`, {
            task_id: taskId,
            new_position: newPosition,
          });
        } catch {
          fetchTasks();
          toast.error('Failed to reorder task');
        }
      }
      return;
    }

    // Status change — optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await axios.patch(`${API}/tasks/${taskId}`, { status: targetStatus });
      toast.success(`Moved to ${COLUMNS.find((c) => c.id === targetStatus)?.label}`);
    } catch (err) {
      fetchTasks();
      const msg = err.response?.data?.detail || 'Failed to update task';
      toast.error(msg);
    }
  };

  // ─── Create / Edit task ────────────────────────────────────────
  const handleSave = async (form, taskId) => {
    setSaving(true);
    const orgId = user?.org_id || user?.team_id;
    try {
      if (taskId) {
        // Edit
        const payload = {};
        if (form.title) payload.title = form.title;
        if (form.description !== undefined) payload.description = form.description;
        if (form.status) payload.status = form.status;
        if (form.visibility) payload.visibility = form.visibility;
        if (form.task_type) payload.task_type = form.task_type;
        if (form.assignee_user_id) payload.assignee_user_id = form.assignee_user_id;
        if (form.due_at) payload.due_at = new Date(form.due_at).toISOString();
        await axios.patch(`${API}/tasks/${taskId}`, payload);
        toast.success('Task updated');
      } else {
        // Create
        const payload = {
          org_id: orgId,
          title: form.title,
          status: form.status || 'todo',
          visibility: form.visibility || 'internal',
          task_type: form.task_type || 'manual',
        };
        if (form.description) payload.description = form.description;
        if (form.assignee_user_id) payload.assignee_user_id = form.assignee_user_id;
        if (form.due_at) payload.due_at = new Date(form.due_at).toISOString();
        if (form.request_id) payload.request_id = form.request_id;
        await axios.post(`${API}/tasks`, payload);
        toast.success('Task created');
      }
      setDialogOpen(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to save task';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openCreate = (status) => {
    setEditingTask(null);
    setDialogOpen(true);
    // Pre-set status in next render via useEffect in dialog
    setTimeout(() => {
      setEditingTask({ status, title: '', description: '', visibility: 'internal', task_type: 'manual' });
    }, 0);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  // ─── Render ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" data-testid="task-board-loading">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full" data-testid="task-board-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {userIsClient ? 'Track work assigned to your team' : 'Manage and track all work'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              data-testid="task-search-input"
              className="pl-8 h-8 w-48 text-sm"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Assignee filter — admin only */}
          {userIsAdmin && orgUsers.length > 0 && (
            <Select
              value={filterAssignee || '_all'}
              onValueChange={(v) => setFilterAssignee(v === '_all' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-40 text-sm" data-testid="task-filter-assignee">
                <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <SelectValue placeholder="All members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All members</SelectItem>
                {orgUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Create button — admin only */}
          {userIsAdmin && (
            <Button
              size="sm"
              onClick={() => { setEditingTask(null); setDialogOpen(true); }}
              data-testid="create-task-btn"
              className="h-8"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4" data-testid="kanban-board">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={getColumnTasks(col.id)}
              onEdit={userIsAdmin ? openEdit : null}
              canEdit={canEdit}
              isClientUser={userIsClient}
              onAddTask={userIsAdmin ? openCreate : null}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-[240px]">
              <TaskCard task={activeTask} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Empty state */}
      {tasks.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400" data-testid="task-board-empty">
          <CheckCircle2 className="w-10 h-10 mb-3 text-slate-300" />
          <p className="text-sm font-medium">No tasks yet</p>
          {userIsAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => { setEditingTask(null); setDialogOpen(true); }}
              data-testid="empty-create-task-btn"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create your first task
            </Button>
          )}
        </div>
      )}

      {/* Task form dialog — admin only */}
      {userIsAdmin && (
        <TaskFormDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingTask(null); }}
          task={editingTask}
          orgUsers={orgUsers}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

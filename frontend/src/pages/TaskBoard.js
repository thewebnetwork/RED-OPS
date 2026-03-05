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
  GripVertical,
  Pencil,
  Search,
  Users,
  CheckCircle2,
  Loader2,
  ChevronDown,
  X,
  Shield,
  Settings2,
  UserCog,
  Filter,
  Inbox,
  MessageSquarePlus,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';

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
  { value: 'internal', label: 'Internal', desc: 'Team only' },
  { value: 'client', label: 'Client', desc: 'Client visible' },
  { value: 'both', label: 'Both', desc: 'Everyone' },
];

const TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'request_generated', label: 'Request Generated' },
  { value: 'approval', label: 'Approval' },
  { value: 'follow_up', label: 'Follow Up' },
];

// ── Role helpers ─────────────────────────────────────────────────
function getUserMode(user) {
  if (user?.role === 'Administrator') return 'admin';
  if (user?.account_type === 'Media Client') return 'client';
  return 'manager';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getRoleBadge(u) {
  const type = u.account_type || '';
  if (type === 'Media Client') return { label: 'Client', cls: 'bg-purple-100 text-purple-700' };
  if (type === 'Internal Staff') return { label: 'Internal', cls: 'bg-blue-100 text-blue-700' };
  if (type === 'Partner') return { label: 'Partner', cls: 'bg-amber-100 text-amber-700' };
  if (type === 'Vendor/Freelancer') return { label: 'Vendor', cls: 'bg-teal-100 text-teal-700' };
  return { label: 'User', cls: 'bg-slate-100 text-slate-600' };
}

// ── Inline Column Create (Admin / Manager only) ─────────────────
function InlineCreate({ columnId, onSubmit, onCancel }) {
  const [title, setTitle] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim(), columnId);
    setTitle('');
  };

  return (
    <div className="mb-2 animate-in fade-in slide-in-from-top-1 duration-150" data-testid={`inline-create-${columnId}`}>
      <div className="bg-white rounded-lg border-2 border-primary/30 shadow-sm p-2">
        <input
          ref={inputRef}
          data-testid={`inline-create-input-${columnId}`}
          className="w-full text-sm text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
          placeholder="Task title... press Enter"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }}
          onBlur={() => { if (!title.trim()) onCancel(); }}
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-slate-400">Enter to create</span>
          <div className="flex gap-1">
            <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded">Esc</button>
            <button onClick={handleSubmit} disabled={!title.trim()}
              className="text-xs bg-primary text-white px-2 py-0.5 rounded disabled:opacity-40 hover:bg-primary/90"
              data-testid={`inline-create-submit-${columnId}`}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Client Assignee Picker (simplified: Me / My Account Manager) ─
function ClientAssigneePicker({ users, value, onChange, currentUserId }) {
  const selfUser = users.find(u => u.id === currentUserId);
  const amUser = users.find(u => u.is_account_manager);

  return (
    <div className="flex flex-col gap-1.5" data-testid="client-assignee-picker">
      <button
        type="button"
        data-testid="assignee-option-self"
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-all ${
          value === currentUserId
            ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
            : 'border-slate-200 hover:border-slate-300 text-slate-700'
        }`}
        onClick={() => onChange(currentUserId)}
      >
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center">
          {selfUser ? getInitials(selfUser.name) : 'ME'}
        </span>
        <span>Assign to me</span>
      </button>
      {amUser && (
        <button
          type="button"
          data-testid="assignee-option-am"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-all ${
            value === amUser.id
              ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20'
              : 'border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
          onClick={() => onChange(amUser.id)}
        >
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-[10px] font-medium flex items-center justify-center">
            <Shield className="w-3 h-3" />
          </span>
          <span>Assign to my account manager</span>
          <span className="text-xs text-slate-400 ml-auto">{amUser.name}</span>
        </button>
      )}
      <button
        type="button"
        data-testid="assignee-option-unassigned"
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm transition-all ${
          !value ? 'border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/20' : 'border-slate-200 hover:border-slate-300 text-slate-500'
        }`}
        onClick={() => onChange('')}
      >
        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 text-[10px] font-medium flex items-center justify-center">&mdash;</span>
        <span>No one yet</span>
      </button>
    </div>
  );
}

// ── Assignee Picker (Admin / Manager) ────────────────────────────
function AssigneePicker({ users, value, onChange, mode }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedUser = users.find(u => u.id === value);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  // Group users by type for admin
  const clientUsers = filtered.filter(u => u.account_type === 'Media Client');
  const internalUsers = filtered.filter(u => u.account_type !== 'Media Client');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" data-testid="quick-assignee-picker"
          className="flex items-center gap-1.5 h-8 px-2 rounded-md border border-slate-200 hover:border-slate-300 bg-white text-sm transition-colors min-w-0">
          {selectedUser ? (
            <>
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                {getInitials(selectedUser.name)}
              </span>
              <span className="truncate max-w-[100px] text-slate-700">{selectedUser.name}</span>
            </>
          ) : (
            <><UserIcon className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-400">Assign</span></>
          )}
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b">
          <Input data-testid="assignee-search-input" placeholder="Search people..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="h-7 text-sm" autoFocus />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          <button type="button"
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-slate-50 ${!value ? 'bg-slate-50' : ''}`}
            onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
            data-testid="assignee-option-none">
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-medium flex items-center justify-center">&mdash;</span>
            <span className="text-slate-500">Unassigned</span>
          </button>

          {mode === 'admin' && internalUsers.length > 0 && clientUsers.length > 0 && (
            <div className="px-2 pt-2 pb-1"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Team</span></div>
          )}
          {internalUsers.map(u => {
            const badge = getRoleBadge(u);
            return (
              <button key={u.id} type="button"
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-slate-50 ${value === u.id ? 'bg-primary/5' : ''}`}
                onClick={() => { onChange(u.id); setOpen(false); setSearch(''); }}
                data-testid={`assignee-option-${u.id}`}>
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center shrink-0">
                  {getInitials(u.name)}
                </span>
                <span className="truncate text-slate-700 flex-1 text-left">{u.name}</span>
                <span className={`text-[10px] px-1.5 py-0 rounded-full ${badge.cls}`}>{badge.label}</span>
              </button>
            );
          })}

          {mode === 'admin' && clientUsers.length > 0 && (
            <div className="px-2 pt-2 pb-1"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Clients</span></div>
          )}
          {clientUsers.map(u => (
            <button key={u.id} type="button"
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-slate-50 ${value === u.id ? 'bg-primary/5' : ''}`}
              onClick={() => { onChange(u.id); setOpen(false); setSearch(''); }}
              data-testid={`assignee-option-${u.id}`}>
              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 text-[10px] font-medium flex items-center justify-center shrink-0">
                {getInitials(u.name)}
              </span>
              <span className="truncate text-slate-700 flex-1 text-left">{u.name}</span>
              <span className="text-[10px] px-1.5 py-0 rounded-full bg-purple-100 text-purple-700">Client</span>
            </button>
          ))}

          {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No match</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Quick Task Dialog ────────────────────────────────────────────
function QuickTaskDialog({ open, onClose, task, assignableUsers, onSave, saving, mode, currentUserId }) {
  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', visibility: mode === 'client' ? 'client' : 'internal',
    task_type: 'manual', assignee_user_id: '', due_at: '', request_id: '',
  });
  const [showMore, setShowMore] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (task?.id) {
      setForm({
        title: task.title || '', description: task.description || '',
        status: task.status || 'todo', visibility: task.visibility || (mode === 'client' ? 'client' : 'internal'),
        task_type: task.task_type || 'manual', assignee_user_id: task.assignee_user_id || '',
        due_at: task.due_at ? task.due_at.slice(0, 10) : '', request_id: task.request_id || '',
      });
      setShowMore(!!(task.description || task.request_id || task.task_type !== 'manual'));
    } else {
      setForm({
        title: '', description: '', status: task?.status || 'todo',
        visibility: mode === 'client' ? 'client' : 'internal',
        task_type: 'manual', assignee_user_id: '', due_at: '', request_id: '',
      });
      setShowMore(false);
    }
    setTimeout(() => titleRef.current?.focus(), 100);
  }, [task, open, mode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form, task?.id);
  };

  const isEditing = !!task?.id;
  const isClient = mode === 'client';
  const isManager = mode === 'manager';

  // Client mode: simplified dialog
  if (isClient) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden" data-testid="task-form-dialog">
          <DialogTitle className="sr-only">{isEditing ? 'Edit Request' : 'New Request'}</DialogTitle>
          <form onSubmit={handleSubmit}>
            <div className="px-5 pt-5 pb-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {isEditing ? 'Edit your request' : 'What do you need help with?'}
              </p>
              <input ref={titleRef} data-testid="task-title-input"
                className="w-full text-base font-medium text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
                placeholder="Describe what you need..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            {/* Simple status pills for client */}
            <div className="px-5 pb-3 flex items-center gap-2">
              <div className="flex items-center gap-0.5 bg-slate-100 rounded-md p-0.5">
                {COLUMNS.filter(c => ['todo', 'doing', 'review'].includes(c.id)).map(col => (
                  <button key={col.id} type="button" data-testid={`status-pill-${col.id}`}
                    className={`text-xs px-2.5 py-1 rounded transition-all ${
                      form.status === col.id ? 'bg-white shadow-sm text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setForm({ ...form, status: col.id })}>
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Client assignee picker */}
            <div className="px-5 pb-3">
              <p className="text-xs text-slate-500 mb-1.5">Who should handle this?</p>
              <ClientAssigneePicker
                users={assignableUsers}
                value={form.assignee_user_id}
                onChange={(v) => setForm({ ...form, assignee_user_id: v })}
                currentUserId={currentUserId}
              />
            </div>

            {/* Due date */}
            <div className="px-5 pb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input type="date" data-testid="task-due-input"
                className="text-sm text-slate-600 outline-none bg-transparent border-none cursor-pointer"
                value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
              {form.due_at && (
                <button type="button" onClick={() => setForm({ ...form, due_at: '' })} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
              {!form.due_at && <span className="text-xs text-slate-400">When do you need this?</span>}
            </div>

            {/* Optional description */}
            {!showMore ? (
              <div className="px-5 pb-3">
                <button type="button" onClick={() => setShowMore(true)} data-testid="show-more-fields"
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                  + Add more details
                </button>
              </div>
            ) : (
              <div className="px-5 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <Textarea data-testid="task-description-input" className="text-sm resize-none" rows={2}
                  placeholder="Add any details that would help..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            )}

            <div className="flex items-center justify-between px-5 py-3 border-t bg-slate-50/50">
              <span className="text-[11px] text-slate-400">{isEditing ? 'Editing request' : ''}</span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} data-testid="task-form-cancel">Cancel</Button>
                <Button type="submit" size="sm" disabled={saving || !form.title.trim()} data-testid="task-form-submit">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  {isEditing ? 'Save' : 'Submit Request'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Admin / Manager dialog
  const visibilityOptions = VISIBILITY_OPTIONS;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden" data-testid="task-form-dialog">
        <DialogTitle className="sr-only">{isEditing ? 'Edit Task' : 'New Task'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <div className="px-5 pt-5 pb-3">
            <input ref={titleRef} data-testid="task-title-input"
              className="w-full text-base font-medium text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
              placeholder={isEditing ? 'Task title' : 'What needs to be done?'}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          {/* Quick controls */}
          <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
            {/* Status pills */}
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-md p-0.5">
              {COLUMNS.slice(0, 4).map(col => (
                <button key={col.id} type="button" data-testid={`status-pill-${col.id}`}
                  className={`text-xs px-2 py-1 rounded transition-all ${
                    form.status === col.id ? 'bg-white shadow-sm text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  onClick={() => setForm({ ...form, status: col.id })}>
                  {col.label}
                </button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button"
                    className={`text-xs px-2 py-1 rounded transition-all ${
                      !['backlog','todo','doing','waiting_on_client'].includes(form.status)
                        ? 'bg-white shadow-sm text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {!['backlog','todo','doing','waiting_on_client'].includes(form.status) ? COLUMNS.find(c => c.id === form.status)?.label : 'More'}
                    <ChevronDown className="w-3 h-3 ml-0.5 inline" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-36 p-1" align="start">
                  {COLUMNS.filter(c => !['backlog','todo','doing','waiting_on_client'].includes(c.id)).map(col => (
                    <button key={col.id} type="button"
                      className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-slate-50 ${form.status === col.id ? 'bg-slate-50 font-medium' : ''}`}
                      onClick={() => setForm({ ...form, status: col.id })}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${col.dot} mr-1.5`} />{col.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>

            {/* Assignee */}
            <AssigneePicker users={assignableUsers} value={form.assignee_user_id}
              onChange={(v) => setForm({ ...form, assignee_user_id: v })} mode={mode} />

            {/* Visibility toggle - Admin only */}
            {mode === 'admin' && (
              <div className="flex items-center gap-0.5 bg-slate-100 rounded-md p-0.5">
                {visibilityOptions.map(v => (
                  <button key={v.value} type="button" data-testid={`visibility-toggle-${v.value}`} title={v.desc}
                    className={`text-xs px-2 py-1 rounded transition-all ${
                      form.visibility === v.value ? 'bg-white shadow-sm text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setForm({ ...form, visibility: v.value })}>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due date */}
          <div className="px-5 pb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input type="date" data-testid="task-due-input"
              className="text-sm text-slate-600 outline-none bg-transparent border-none cursor-pointer"
              value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
            {form.due_at && (
              <button type="button" onClick={() => setForm({ ...form, due_at: '' })} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
            {!form.due_at && <span className="text-xs text-slate-400">No due date</span>}
          </div>

          {/* Expandable section */}
          {!showMore ? (
            <div className="px-5 pb-3">
              <button type="button" onClick={() => setShowMore(true)} data-testid="show-more-fields"
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                + Description{mode === 'admin' ? ', linked request, type' : isManager ? ', details' : ''}
              </button>
            </div>
          ) : (
            <div className="px-5 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <Textarea data-testid="task-description-input" className="text-sm resize-none" rows={2}
                placeholder="Add description..." value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              {mode === 'admin' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500">Linked Request</Label>
                    <Input data-testid="task-request-input" className="h-8 text-sm mt-1"
                      placeholder="Request ID" value={form.request_id}
                      onChange={(e) => setForm({ ...form, request_id: e.target.value })} />
                  </div>
                  <div className="w-36">
                    <Label className="text-xs text-slate-500">Type</Label>
                    <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                      <SelectTrigger className="h-8 text-sm mt-1" data-testid="task-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3 border-t bg-slate-50/50">
            <span className="text-[11px] text-slate-400">{isEditing ? 'Editing task' : ''}</span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} data-testid="task-form-cancel">Cancel</Button>
              <Button type="submit" size="sm" disabled={saving || !form.title.trim()} data-testid="task-form-submit">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                {isEditing ? 'Save' : 'Create Task'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Task Card ────────────────────────────────────────────────────
function SortableTaskCard({ task, onEdit, canDrag, canEditCard, mode, currentUserId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, data: { type: 'task', task }, disabled: !canDrag,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskCard task={task} onEdit={onEdit} canDrag={canDrag} canEditCard={canEditCard}
        dragListeners={canDrag ? listeners : undefined} mode={mode} currentUserId={currentUserId} />
    </div>
  );
}

function TaskCard({ task, onEdit, canDrag, canEditCard, dragListeners, mode, currentUserId, isOverlay }) {
  const dueDate = task.due_at ? new Date(task.due_at) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';
  const isClient = mode === 'client';

  // Client-friendly assignee label
  const getClientAssigneeLabel = () => {
    if (!task.assignee_user_id) return null;
    if (task.assignee_user_id === currentUserId) return 'You';
    return task.assignee_name || 'Account Manager';
  };

  return (
    <div data-testid={`task-card-${task.id}`}
      className={`group bg-white rounded-lg border border-slate-200 p-3 mb-2 
        hover:border-slate-300 hover:shadow-sm transition-all duration-150
        ${isOverlay ? 'shadow-lg ring-2 ring-primary/20 rotate-1' : ''}
        ${isOverdue ? 'border-l-2 border-l-red-400' : ''}`}>
      <div className="flex items-start gap-2">
        {canDrag && (
          <button {...(dragListeners || {})}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0"
            data-testid={`task-drag-handle-${task.id}`}>
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{task.title}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {isClient ? (
              /* Client: simplified metadata */
              <>
                {getClientAssigneeLabel() && (
                  <span className={`inline-flex items-center gap-1 text-xs ${
                    task.assignee_user_id === currentUserId ? 'text-primary font-medium' : 'text-slate-500'
                  }`}>
                    {task.assignee_user_id === currentUserId ? (
                      <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-medium flex items-center justify-center">
                        {getInitials(task.assignee_name || 'Me')}
                      </span>
                    ) : (
                      <Shield className="w-3 h-3 text-blue-500" />
                    )}
                    {getClientAssigneeLabel()}
                  </span>
                )}
                {dueDate && (
                  <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                    <Calendar className="w-3 h-3" />
                    {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </>
            ) : (
              /* Admin / Manager: full metadata */
              <>
                {task.assignee_name && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[9px] font-medium flex items-center justify-center">
                      {getInitials(task.assignee_name)}
                    </span>
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
                {mode === 'admin' && task.visibility !== 'internal' && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-slate-200">
                    {task.visibility === 'client' ? <Eye className="w-2.5 h-2.5 mr-0.5" /> : null}
                    {task.visibility}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        {canEditCard && onEdit && (
          <button onClick={() => onEdit(task)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600 shrink-0"
            data-testid={`task-edit-btn-${task.id}`}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Column ───────────────────────────────────────────────────────
function KanbanColumn({ column, tasks, onEdit, canDrag, canEditCard, canAddInline, mode,
  inlineCreateCol, setInlineCreateCol, onInlineSubmit, currentUserId }) {
  const taskIds = tasks.map(t => t.id);
  const showInline = inlineCreateCol === column.id;

  const emptyMessages = {
    admin: 'No tasks',
    manager: 'No tasks',
    client: 'Nothing here',
  };

  return (
    <div data-testid={`kanban-column-${column.id}`} className="flex flex-col min-w-[260px] w-[260px] shrink-0">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${column.color}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.dot}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${column.textColor}`}>{column.label}</span>
          <span className="text-xs text-slate-400 font-medium">{tasks.length}</span>
        </div>
        {canAddInline && (
          <button onClick={() => setInlineCreateCol(showInline ? null : column.id)}
            className={`transition-colors ${showInline ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
            data-testid={`add-task-${column.id}`}>
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 bg-slate-50/50 rounded-b-lg border border-t-0 border-slate-200 p-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-220px)]">
        {showInline && <InlineCreate columnId={column.id} onSubmit={onInlineSubmit} onCancel={() => setInlineCreateCol(null)} />}
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} onEdit={onEdit} canDrag={canDrag}
              canEditCard={canEditCard} mode={mode} currentUserId={currentUserId} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !showInline && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-400">{emptyMessages[mode]}</div>
        )}
      </div>
    </div>
  );
}

// ── Account Manager Management Dialog (Admin only) ───────────────
function AccountManagerDialog({ open, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    axios.get(`${API}/tasks/client-assignments`)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load client data'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSetAM = async (clientId, amId) => {
    setSaving(clientId);
    try {
      await axios.patch(`${API}/tasks/account-manager/${clientId}`, { account_manager_id: amId || null });
      setData(prev => ({
        ...prev,
        clients: prev.clients.map(c => c.id === clientId
          ? { ...c, account_manager_id: amId, account_manager_name: amId ? prev.internal_staff.find(s => s.id === amId)?.name : null }
          : c
        ),
      }));
      toast.success('Account manager updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" data-testid="am-management-dialog">
        <DialogTitle className="text-base font-semibold flex items-center gap-2">
          <UserCog className="w-4 h-4" /> Account Manager Assignments
        </DialogTitle>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : !data?.clients?.length ? (
          <p className="text-sm text-slate-500 py-4 text-center">No client accounts found</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.clients.map(client => (
              <div key={client.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                data-testid={`am-row-${client.id}`}>
                <span className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 text-[10px] font-medium flex items-center justify-center shrink-0">
                  {getInitials(client.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{client.name}</p>
                  <p className="text-xs text-slate-400">
                    {client.account_manager_name ? `AM: ${client.account_manager_name}` : 'No account manager'}
                  </p>
                </div>
                <Select
                  value={client.account_manager_id || '_none'}
                  onValueChange={(v) => handleSetAM(client.id, v === '_none' ? '' : v)}
                  disabled={saving === client.id}
                >
                  <SelectTrigger className="h-7 w-36 text-xs" data-testid={`am-select-${client.id}`}>
                    <SelectValue placeholder="Set AM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No AM</SelectItem>
                    {data.internal_staff?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main TaskBoard ───────────────────────────────────────────────
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
  const [amDialogOpen, setAmDialogOpen] = useState(false);

  const mode = getUserMode(user);
  const canCreate = true;
  const canDrag = true;
  const canEditCard = mode === 'admin' || mode === 'manager';
  const canAddInline = mode === 'admin' || mode === 'manager';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterAssignee) params.append('assignee_user_id', filterAssignee);
      if (filterStatus) params.append('status', filterStatus);
      const res = await axios.get(`${API}/tasks?${params.toString()}`);
      setTasks(res.data);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filterAssignee, filterStatus]);

  useEffect(() => {
    axios.get(`${API}/tasks/assignable-users`)
      .then(res => setAssignableUsers(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const getColumnTasks = useCallback((statusId) => {
    let filtered = tasks.filter(t => t.status === statusId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) || (t.assignee_name && t.assignee_name.toLowerCase().includes(q))
      );
    }
    return filtered.sort((a, b) => (a.position || 0) - (b.position || 0));
  }, [tasks, searchQuery]);

  // ── Drag handlers ──
  const handleDragStart = (event) => {
    setActiveTask(tasks.find(t => t.id === event.active.id) || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || !active) return;
    const taskId = active.id;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    let targetStatus = null;
    const overTask = tasks.find(t => t.id === over.id);
    if (overTask) targetStatus = overTask.status;
    else if (COLUMNS.some(c => c.id === over.id)) targetStatus = over.id;
    if (!targetStatus) return;

    if (task.status === targetStatus) {
      const columnTasks = getColumnTasks(targetStatus);
      const oldIndex = columnTasks.findIndex(t => t.id === taskId);
      const newIndex = columnTasks.findIndex(t => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(columnTasks, oldIndex, newIndex);
        const prevPos = newIndex > 0 ? reordered[newIndex - 1].position || 0 : 0;
        const nextPos = newIndex < reordered.length - 1 ? reordered[newIndex + 1].position || prevPos + 2000 : prevPos + 2000;
        const newPosition = (prevPos + nextPos) / 2;
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, position: newPosition } : t));
        try { await axios.patch(`${API}/tasks/reorder`, { task_id: taskId, new_position: newPosition }); }
        catch { fetchTasks(); toast.error('Failed to reorder'); }
      }
      return;
    }

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus } : t));
    try {
      await axios.patch(`${API}/tasks/${taskId}`, { status: targetStatus });
      toast.success(`Moved to ${COLUMNS.find(c => c.id === targetStatus)?.label}`);
    } catch (err) {
      fetchTasks();
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  // ── Inline create ──
  const handleInlineCreate = async (title, columnId) => {
    const orgId = user?.org_id || user?.team_id;
    const visibility = mode === 'client' ? 'client' : 'internal';
    const tempId = `temp-${Date.now()}`;
    setTasks(prev => [...prev, {
      id: tempId, title, status: columnId, visibility, task_type: 'manual',
      org_id: orgId, created_source: mode === 'client' ? 'client' : 'admin', position: Date.now(),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }]);
    setInlineCreateCol(null);

    try {
      const res = await axios.post(`${API}/tasks`, {
        org_id: orgId, title, status: columnId, visibility, task_type: 'manual',
      });
      setTasks(prev => prev.map(t => t.id === tempId ? res.data : t));
      toast.success('Task created');
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempId));
      toast.error(err.response?.data?.detail || 'Failed to create');
    }
  };

  // ── Dialog save ──
  const handleSave = async (form, taskId) => {
    setSaving(true);
    const orgId = user?.org_id || user?.team_id;
    try {
      if (taskId) {
        const payload = {};
        if (form.title) payload.title = form.title;
        if (form.description !== undefined) payload.description = form.description;
        if (form.status) payload.status = form.status;
        if (mode === 'admin') {
          if (form.visibility) payload.visibility = form.visibility;
          if (form.task_type) payload.task_type = form.task_type;
        }
        if (form.assignee_user_id !== undefined) payload.assignee_user_id = form.assignee_user_id;
        if (form.due_at) payload.due_at = new Date(form.due_at).toISOString();
        await axios.patch(`${API}/tasks/${taskId}`, payload);
        toast.success('Task updated');
      } else {
        const payload = {
          org_id: orgId, title: form.title,
          status: form.status || 'todo',
          visibility: mode === 'client' ? (form.visibility || 'client') : (form.visibility || 'internal'),
          task_type: form.task_type || 'manual',
        };
        if (form.description) payload.description = form.description;
        if (form.assignee_user_id) payload.assignee_user_id = form.assignee_user_id;
        if (form.due_at) payload.due_at = new Date(form.due_at).toISOString();
        if (form.request_id) payload.request_id = form.request_id;
        await axios.post(`${API}/tasks`, payload);
        toast.success(mode === 'client' ? 'Request submitted' : 'Task created');
      }
      setDialogOpen(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (task) => { setEditingTask(task); setDialogOpen(true); };

  const handleCardEdit = (task) => {
    if (mode === 'client' && task.created_by_user_id !== user?.id) return;
    openEdit(task);
  };

  // Derived filter data
  const clientUsers = assignableUsers.filter(u => u.account_type === 'Media Client');
  const allFilterUsers = assignableUsers;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" data-testid="task-board-loading">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full" data-testid="task-board-page">
      {/* ── ADMIN HEADER ── */}
      {mode === 'admin' && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-800 tracking-tight" data-testid="task-board-title">Task Board</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage and track all work across your team</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                onClick={() => setAmDialogOpen(true)} data-testid="manage-am-btn">
                <UserCog className="w-3.5 h-3.5" /> Account Managers
              </Button>
              <Button size="sm" onClick={() => { setEditingTask(null); setDialogOpen(true); }}
                data-testid="create-task-btn" className="h-8">
                <Plus className="w-4 h-4 mr-1" /> New Task
              </Button>
            </div>
          </div>
          {/* Admin filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input data-testid="task-search-input" className="pl-8 h-8 w-48 text-sm"
                placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {allFilterUsers.length > 0 && (
              <Select value={filterAssignee || '_all'} onValueChange={v => setFilterAssignee(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-8 w-44 text-sm" data-testid="task-filter-assignee">
                  <Users className="w-3.5 h-3.5 mr-1 text-slate-400" /><SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All members</SelectItem>
                  {allFilterUsers.filter(u => u.account_type !== 'Media Client').length > 0 && (
                    <div className="px-2 pt-1.5 pb-0.5"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Team</span></div>
                  )}
                  {allFilterUsers.filter(u => u.account_type !== 'Media Client').map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                  {clientUsers.length > 0 && (
                    <div className="px-2 pt-1.5 pb-0.5"><span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Clients</span></div>
                  )}
                  {clientUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterStatus || '_all'} onValueChange={v => setFilterStatus(v === '_all' ? '' : v)}>
              <SelectTrigger className="h-8 w-36 text-sm" data-testid="task-filter-status">
                <Filter className="w-3.5 h-3.5 mr-1 text-slate-400" /><SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All statuses</SelectItem>
                {COLUMNS.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot} mr-1.5`} />{c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterAssignee || filterStatus) && (
              <button onClick={() => { setFilterAssignee(''); setFilterStatus(''); }}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1" data-testid="clear-filters-btn">
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── ACCOUNT MANAGER HEADER ── */}
      {mode === 'manager' && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-800 tracking-tight" data-testid="task-board-title">My Client Tasks</h1>
              <p className="text-sm text-slate-500 mt-0.5">Manage tasks for your assigned clients</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => { setEditingTask(null); setDialogOpen(true); }}
                data-testid="create-task-btn" className="h-8">
                <Plus className="w-4 h-4 mr-1" /> New Task
              </Button>
            </div>
          </div>
          {/* Manager filters: search + client filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input data-testid="task-search-input" className="pl-8 h-8 w-48 text-sm"
                placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {clientUsers.length > 0 && (
              <Select value={filterAssignee || '_all'} onValueChange={v => setFilterAssignee(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-8 w-44 text-sm" data-testid="task-filter-assignee">
                  <Users className="w-3.5 h-3.5 mr-1 text-slate-400" /><SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All clients</SelectItem>
                  {clientUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {filterAssignee && (
              <button onClick={() => setFilterAssignee('')}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1" data-testid="clear-filters-btn">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── CLIENT HEADER ── */}
      {mode === 'client' && (
        <div className="mb-4 px-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-800 tracking-tight" data-testid="task-board-title">My Tasks</h1>
              <p className="text-sm text-slate-500 mt-0.5">Track progress on your account</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input data-testid="task-search-input" className="pl-8 h-8 w-40 text-sm"
                  placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" onClick={() => { setEditingTask(null); setDialogOpen(true); }}
                data-testid="create-task-btn" className="h-8 gap-1.5">
                <MessageSquarePlus className="w-3.5 h-3.5" /> New Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── KANBAN BOARD ── */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" data-testid="kanban-board">
          {COLUMNS.map(col => (
            <KanbanColumn key={col.id} column={col} tasks={getColumnTasks(col.id)}
              onEdit={mode === 'client' ? handleCardEdit : openEdit}
              canDrag={canDrag} canEditCard={canEditCard || mode === 'client'}
              canAddInline={canAddInline} mode={mode}
              inlineCreateCol={inlineCreateCol} setInlineCreateCol={setInlineCreateCol}
              onInlineSubmit={handleInlineCreate} currentUserId={user?.id} />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? <div className="w-[240px]"><TaskCard task={activeTask} isOverlay mode={mode} currentUserId={user?.id} /></div> : null}
        </DragOverlay>
      </DndContext>

      {/* ── ROLE-AWARE EMPTY STATE ── */}
      {tasks.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400" data-testid="task-board-empty">
          {mode === 'client' ? (
            <>
              <Inbox className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No tasks on your account yet</p>
              <p className="text-xs text-slate-400 mt-1">Your team will add tasks here as work progresses</p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5"
                onClick={() => { setEditingTask(null); setDialogOpen(true); }}
                data-testid="empty-create-task-btn">
                <MessageSquarePlus className="w-3.5 h-3.5" /> Submit a request
              </Button>
            </>
          ) : mode === 'manager' ? (
            <>
              <CheckCircle2 className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No tasks for your clients yet</p>
              <p className="text-xs text-slate-400 mt-1">Create a task to start managing work for your clients</p>
              <Button size="sm" className="mt-4"
                onClick={() => { setEditingTask(null); setDialogOpen(true); }}
                data-testid="empty-create-task-btn">
                <Plus className="w-4 h-4 mr-1" /> Create your first task
              </Button>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No tasks yet</p>
              <p className="text-xs text-slate-400 mt-1">Start by creating a task or assigning work</p>
              <Button size="sm" className="mt-4"
                onClick={() => { setEditingTask(null); setDialogOpen(true); }}
                data-testid="empty-create-task-btn">
                <Plus className="w-4 h-4 mr-1" /> Create your first task
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── TASK DIALOG ── */}
      <QuickTaskDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTask(null); }}
        task={editingTask}
        assignableUsers={assignableUsers}
        onSave={handleSave}
        saving={saving}
        mode={mode}
        currentUserId={user?.id}
      />

      {/* ── ADMIN: ACCOUNT MANAGER MANAGEMENT ── */}
      {mode === 'admin' && (
        <AccountManagerDialog
          open={amDialogOpen}
          onClose={() => setAmDialogOpen(false)}
        />
      )}
    </div>
  );
}

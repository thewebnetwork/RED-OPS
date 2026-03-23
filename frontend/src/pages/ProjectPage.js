import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  ArrowLeft, Plus, Calendar, Users, CheckSquare, ChevronRight, ChevronDown,
  Circle, Clock, Folder, X, Edit3, Save, Trash2, CheckCircle2, MoreHorizontal,
  Target, BarChart3, FileText, Loader2, CreditCard, AlertCircle, Hash,
  File, FilePlus, FolderOpen, Bold, Italic, List, Link2, Type, Grip,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

// ── Config ────────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  campaign_build:    { label: 'Campaign Build',    color: '#a855f7', bg: '#a855f718' },
  client_onboarding: { label: 'Client Onboarding', color: '#3b82f6', bg: '#3b82f618' },
  creative_sprint:   { label: 'Creative Sprint',   color: '#22c55e', bg: '#22c55e18' },
  internal:          { label: 'Internal',          color: '#606060', bg: '#60606018' },
  retainer:          { label: 'Retainer',          color: '#f59e0b', bg: '#f59e0b18' },
  one_off:           { label: 'One-Off',           color: '#06b6d4', bg: '#06b6d418' },
  custom:            { label: 'Custom',            color: '#8b5cf6', bg: '#8b5cf618' },
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

const TASK_STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#606060' },
  todo:    { label: 'To Do',   color: '#3b82f6' },
  doing:   { label: 'In Progress', color: '#f59e0b' },
  review:  { label: 'In Review', color: '#a855f7' },
  done:    { label: 'Done',    color: '#22c55e' },
};

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

// ── Small UI helpers ──────────────────────────────────────────────────────────
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

function PriorityPill({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${cfg.color}22`, color: cfg.color }}>{cfg.label}</span>;
}

// ── Add Task Modal ────────────────────────────────────────────────────────────
function AddTaskModal({ projectId, teamMembers, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('todo');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Task title is required'); return; }
    setSaving(true);
    try {
      await ax().post(`${API}/tasks`, {
        title: title.trim(),
        project_id: projectId,
        priority,
        status,
        assignee_user_id: assignee || undefined,
        due_at: dueDate ? new Date(dueDate + 'T00:00:00Z').toISOString() : null,
        visibility: 'both',
      });
      toast.success('Task created');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create task');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 440, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Add Task to Project</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input className="input-field" autoFocus placeholder="What needs to be done?" value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                {Object.entries(TASK_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select className="input-field" value={priority} onChange={e => setPriority(e.target.value)}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Assignee</label>
            <select className="input-field" value={assignee} onChange={e => setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {(teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" className="input-field" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={13} className="spin" /> : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Document Editor ───────────────────────────────────────────────────────────
function DocumentEditor({ doc, projectId, onBack, onRefresh }) {
  const [title, setTitle] = useState(doc?.title || 'Untitled');
  const [content, setContent] = useState(doc?.content || '');
  const [saving, setSaving] = useState(false);
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title || 'Untitled');
      setContent(doc.content || '');
      setDirty(false);
    }
  }, [doc]);

  // Load children (sub-docs)
  useEffect(() => {
    if (!doc?.id) return;
    setLoadingChildren(true);
    ax().get(`${API}/projects/${projectId}/documents?parent_id=${doc.id}`)
      .then(r => setChildren(r.data))
      .catch(() => {})
      .finally(() => setLoadingChildren(false));
  }, [doc?.id, projectId]);

  // Auto-save on changes (debounced)
  const autoSave = useCallback(async (newTitle, newContent) => {
    if (!doc?.id) return;
    setSaving(true);
    try {
      await ax().patch(`${API}/projects/${projectId}/documents/${doc.id}`, {
        title: newTitle,
        content: newContent,
      });
      setDirty(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }, [doc?.id, projectId]);

  const handleTitleChange = (val) => {
    setTitle(val);
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(val, content), 1200);
  };

  const handleContentChange = (val) => {
    setContent(val);
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(title, val), 1200);
  };

  const handleManualSave = async () => {
    clearTimeout(saveTimer.current);
    await autoSave(title, content);
    toast.success('Saved');
  };

  const handleAddSubDoc = async () => {
    try {
      await ax().post(`${API}/projects/${projectId}/documents`, {
        title: 'Untitled',
        parent_id: doc.id,
        content: '',
      });
      // Reload children
      const r = await ax().get(`${API}/projects/${projectId}/documents?parent_id=${doc.id}`);
      setChildren(r.data);
      onRefresh();
    } catch { toast.error('Failed to create sub-document'); }
  };

  const handleDeleteSubDoc = async (subId) => {
    if (!window.confirm('Delete this sub-document?')) return;
    try {
      await ax().delete(`${API}/projects/${projectId}/documents/${subId}`);
      setChildren(prev => prev.filter(c => c.id !== subId));
      onRefresh();
    } catch { toast.error('Failed to delete'); }
  };

  if (!doc) return null;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 12, color: 'var(--tx-3)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <ArrowLeft size={12} /> Documents
        </button>
        <ChevronRight size={10} />
        <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{title || 'Untitled'}</span>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 8 }}>
        <input value={title} onChange={e => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 26, fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-.04em', padding: 0 }} />
      </div>

      {/* Save indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 11, color: 'var(--tx-3)' }}>
        {saving ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Loader2 size={10} className="spin" /> Saving...</span>
        ) : dirty ? (
          <span style={{ color: '#f59e0b' }}>Unsaved changes</span>
        ) : (
          <span style={{ color: '#22c55e' }}>Saved</span>
        )}
        <button onClick={handleManualSave} className="btn-ghost btn-sm" style={{ fontSize: 11, padding: '3px 8px', gap: 4 }}>
          <Save size={10} /> Save
        </button>
      </div>

      {/* Content editor */}
      <div style={{ marginBottom: 32 }}>
        <textarea
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          placeholder="Start writing... (supports markdown)"
          style={{
            width: '100%', minHeight: 400, border: 'none', outline: 'none',
            background: 'transparent', fontSize: 14, color: 'var(--tx-1)',
            lineHeight: 1.8, resize: 'vertical', fontFamily: 'inherit',
            padding: 0,
          }}
        />
      </div>

      {/* Sub-documents */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>Sub-documents</span>
          <button onClick={handleAddSubDoc} className="btn-ghost btn-sm" style={{ gap: 4, fontSize: 11 }}>
            <Plus size={11} /> Add
          </button>
        </div>

        {loadingChildren ? (
          <div style={{ padding: 16, textAlign: 'center' }}><Loader2 size={14} className="spin" color="var(--tx-3)" /></div>
        ) : children.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 12, color: 'var(--tx-3)' }}>
            No sub-documents. Click "Add" to create one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {children.map(child => (
              <div key={child.id}
                onClick={() => onBack(child)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border)', transition: 'border-color .1s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <span style={{ fontSize: 16 }}>{child.icon || '📄'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.title || 'Untitled'}
                  </div>
                  {child.child_count > 0 && (
                    <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 2 }}>{child.child_count} sub-doc{child.child_count !== 1 ? 's' : ''}</div>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); handleDeleteSubDoc(child.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, opacity: 0.5 }}>
                  <Trash2 size={11} />
                </button>
                <ChevronRight size={12} color="var(--tx-3)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ projectId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docStack, setDocStack] = useState([]); // for breadcrumb navigation

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ax().get(`${API}/projects/${projectId}/documents`);
      setDocs(r.data);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleCreate = async () => {
    try {
      const r = await ax().post(`${API}/projects/${projectId}/documents`, {
        title: 'Untitled',
        content: '',
      });
      setEditingDoc(r.data);
      setDocStack([]);
      fetchDocs();
    } catch { toast.error('Failed to create document'); }
  };

  const handleOpenDoc = async (doc) => {
    try {
      const r = await ax().get(`${API}/projects/${projectId}/documents/${doc.id}`);
      setEditingDoc(r.data);
    } catch { toast.error('Failed to open document'); }
  };

  const handleDelete = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this document and all sub-documents?')) return;
    try {
      await ax().delete(`${API}/projects/${projectId}/documents/${docId}`);
      toast.success('Document deleted');
      fetchDocs();
    } catch { toast.error('Failed to delete'); }
  };

  const handleBack = (navigateToChild) => {
    if (navigateToChild && navigateToChild.id) {
      // Navigate to a child doc
      setDocStack(prev => [...prev, editingDoc]);
      handleOpenDoc(navigateToChild);
    } else if (docStack.length > 0) {
      // Go back in stack
      const prev = docStack[docStack.length - 1];
      setDocStack(s => s.slice(0, -1));
      handleOpenDoc(prev);
    } else {
      // Back to list
      setEditingDoc(null);
      fetchDocs();
    }
  };

  if (editingDoc) {
    return (
      <DocumentEditor
        doc={editingDoc}
        projectId={projectId}
        onBack={handleBack}
        onRefresh={fetchDocs}
      />
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: 'var(--tx-1)' }}>Documents</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Project docs, notes, and references — like Notion pages</p>
        </div>
        <button onClick={handleCreate} className="btn-primary btn-sm" style={{ gap: 5 }}>
          <FilePlus size={12} /> New Document
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} className="spin" color="var(--tx-3)" /></div>
      ) : docs.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <FileText size={32} color="var(--tx-3)" style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-2)', margin: '0 0 4px' }}>No documents yet</p>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 16px' }}>Create your first document to start organizing project knowledge.</p>
          <button onClick={handleCreate} className="btn-primary btn-sm" style={{ gap: 5 }}>
            <FilePlus size={12} /> Create Document
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {docs.map(doc => (
            <div key={doc.id}
              onClick={() => handleOpenDoc(doc)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', transition: 'all .1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}>
              <span style={{ fontSize: 20 }}>{doc.icon || '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.title || 'Untitled'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2, display: 'flex', gap: 10 }}>
                  {doc.child_count > 0 && <span>{doc.child_count} sub-doc{doc.child_count !== 1 ? 's' : ''}</span>}
                  <span>{new Date(doc.updated_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
                  {doc.created_by_name && <span>by {doc.created_by_name}</span>}
                </div>
              </div>
              <button onClick={e => handleDelete(doc.id, e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, opacity: 0.4 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>
                <Trash2 size={13} />
              </button>
              <ChevronRight size={14} color="var(--tx-3)" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task Edit Drawer ──────────────────────────────────────────────────────────
function TaskEditDrawer({ task, teamMembers, onClose, onUpdated }) {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    assignee_user_id: task.assignee_user_id || task.assignee_id || '',
    due_at: task.due_at ? task.due_at.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const saveTimer = useRef(null);

  const save = useCallback(async (data) => {
    setSaving(true);
    try {
      const payload = { ...data };
      if (payload.due_at) payload.due_at = new Date(payload.due_at + 'T00:00:00Z').toISOString();
      else payload.due_at = null;
      if (!payload.assignee_user_id) payload.assignee_user_id = null;
      await ax().patch(`${API}/tasks/${task.id}`, payload);
      onUpdated();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  }, [task.id, onUpdated]);

  const autoSave = (field, value) => {
    const newForm = { ...form, [field]: value };
    set(field, value);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(newForm), 600);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await ax().delete(`${API}/tasks/${task.id}`);
      toast.success('Task deleted');
      onClose();
      onUpdated();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(2px)' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 400, maxWidth: '90vw',
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'auto',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)' }}>Task Details</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {saving && <Loader2 size={12} className="spin" style={{ color: 'var(--tx-3)' }} />}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={16} /></button>
          </div>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input className="input-field" value={form.title} onChange={e => autoSave('title', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea className="input-field" rows={4} placeholder="Add details…" value={form.description}
              onChange={e => autoSave('description', e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="input-field" value={form.status} onChange={e => autoSave('status', e.target.value)}>
                {Object.entries(TASK_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select className="input-field" value={form.priority} onChange={e => autoSave('priority', e.target.value)}>
                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Assignee</label>
            <select className="input-field" value={form.assignee_user_id} onChange={e => autoSave('assignee_user_id', e.target.value)}>
              <option value="">Unassigned</option>
              {(teamMembers || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" className="input-field" value={form.due_at} onChange={e => autoSave('due_at', e.target.value)} />
          </div>
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button onClick={handleDelete} style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
              padding: '8px 16px', background: 'rgba(201,42,62,.08)', color: 'var(--red)',
              border: '1px solid rgba(201,42,62,.15)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              <Trash2 size={13} /> Delete Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────
function TasksTab({ projectId, taskCount, teamMembers }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editTask, setEditTask] = useState(null);
  const [quickAdd, setQuickAdd] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ax().get(`${API}/projects/${projectId}/tasks`);
      setTasks(r.data);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const toggleDone = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await ax().patch(`${API}/tasks/${taskId}`, { status: newStatus });
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: currentStatus } : t));
      toast.error('Failed to update task');
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAdd.trim()) return;
    setAdding(true);
    try {
      await ax().post(`${API}/tasks`, {
        title: quickAdd.trim(),
        project_id: projectId,
        status: 'todo',
        priority: 'medium',
        visibility: 'both',
      });
      setQuickAdd('');
      fetchTasks();
    } catch { toast.error('Failed to add task'); }
    finally { setAdding(false); }
  };

  const filtered = filter === 'all' ? tasks : filter === 'active' ? tasks.filter(t => t.status !== 'done') : tasks.filter(t => t.status === 'done');
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      {showModal && (
        <AddTaskModal
          projectId={projectId}
          teamMembers={teamMembers}
          onClose={() => setShowModal(false)}
          onCreated={fetchTasks}
        />
      )}
      {editTask && (
        <TaskEditDrawer
          task={editTask}
          teamMembers={teamMembers}
          onClose={() => setEditTask(null)}
          onUpdated={() => { fetchTasks(); setEditTask(null); }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: 'var(--tx-1)' }}>Tasks</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>{doneCount}/{tasks.length} completed</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary btn-sm" style={{ gap: 5 }}>
          <Plus size={12} /> Add Task
        </button>
      </div>

      {/* Inline quick-add */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Plus size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            className="input-field"
            placeholder="Quick add task… (Enter to create)"
            value={quickAdd}
            onChange={e => setQuickAdd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
            disabled={adding}
            style={{ paddingLeft: 30 }}
          />
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${tasks.length})` },
          { key: 'active', label: `Active (${tasks.length - doneCount})` },
          { key: 'done', label: `Done (${doneCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: filter === f.key ? 'var(--red)' : 'var(--border)', background: filter === f.key ? 'var(--red-bg)' : 'transparent', color: filter === f.key ? 'var(--red)' : 'var(--tx-3)' }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Loader2 size={20} className="spin" color="var(--tx-3)" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <CheckSquare size={32} color="var(--tx-3)" style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-2)', margin: '0 0 4px' }}>
            {tasks.length === 0 ? 'No tasks yet' : 'No tasks match this filter'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 16px' }}>
            {tasks.length === 0 ? 'Add your first task above or use the Add Task button.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(t => {
            const isDone = t.status === 'done';
            const stCfg = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.todo;
            const prCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', transition: 'background .08s' }}
                onClick={() => setEditTask(t)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                <button onClick={(e) => { e.stopPropagation(); toggleDone(t.id, t.status); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDone ? '#22c55e' : 'var(--tx-3)', padding: 0, flexShrink: 0, display: 'flex' }}>
                  {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 3, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {t.assignee_name && <span>{t.assignee_name}</span>}
                    {t.due_at && <span><Calendar size={9} style={{ marginRight: 2 }} />{new Date(t.due_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${prCfg.color}22`, color: prCfg.color }}>{prCfg.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${stCfg.color}22`, color: stCfg.color }}>{stCfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Milestones Tab ────────────────────────────────────────────────────────────
function MilestonesTab({ project, onRefresh }) {
  const [newLabel, setNewLabel] = useState('');

  const handleToggle = async (mId) => {
    try {
      await ax().patch(`${API}/projects/${project.id}/milestones/${mId}`);
      onRefresh();
    } catch { toast.error('Failed to toggle milestone'); }
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    try {
      await ax().post(`${API}/projects/${project.id}/milestones`, { label: newLabel.trim() });
      setNewLabel('');
      onRefresh();
    } catch { toast.error('Failed to add milestone'); }
  };

  const handleDelete = async (mId) => {
    try {
      await ax().delete(`${API}/projects/${project.id}/milestones/${mId}`);
      onRefresh();
    } catch { toast.error('Failed to delete milestone'); }
  };

  const milestones = project.milestones || [];
  const doneCount = milestones.filter(m => m.done).length;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: 'var(--tx-1)' }}>Milestones</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>{doneCount}/{milestones.length} completed</p>
        </div>
      </div>

      {/* Add input */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input className="input-field" placeholder="Add a milestone..." value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          style={{ flex: 1 }} />
        <button onClick={handleAdd} className="btn-primary btn-sm" style={{ gap: 4 }}>
          <Plus size={12} /> Add
        </button>
      </div>

      {milestones.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <Target size={32} color="var(--tx-3)" style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-2)', margin: '0 0 4px' }}>No milestones yet</p>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Add milestones to track major deliverables and checkpoints.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {milestones.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
              {/* Connector line */}
              {i < milestones.length - 1 && (
                <div style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 2, background: m.done ? '#22c55e30' : 'var(--border)' }} />
              )}
              <button onClick={() => handleToggle(m.id)}
                style={{ width: 30, height: 30, borderRadius: '50%', border: m.done ? 'none' : '2px solid var(--border)', background: m.done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, position: 'relative', zIndex: 1, transition: 'all .15s' }}>
                {m.done && <CheckCircle2 size={16} color="#fff" />}
              </button>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: m.done ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: m.done ? 'line-through' : 'none' }}>
                  {m.label}
                </div>
                {m.completed_at && (
                  <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>
                    Completed {new Date(m.completed_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
              <button onClick={() => handleDelete(m.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, opacity: 0.4, alignSelf: 'center' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function ProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [allUsers, setAllUsers] = useState([]);

  const fetchProject = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/projects/${id}`);
      setProject(r.data);
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Project not found');
        navigate('/projects');
      } else {
        toast.error('Failed to load project');
      }
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Load team members for assignee dropdowns
  useEffect(() => {
    ax().get(`${API}/users`).then(r => {
      const list = r.data?.data || r.data || [];
      setAllUsers(Array.isArray(list) ? list.map(u => ({ id: u.id, name: u.name || u.username || 'Unknown' })) : []);
    }).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="page-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="spin" color="var(--tx-3)" />
      </div>
    );
  }

  if (!project) return null;

  const completedMilestones = (project.milestones || []).filter(m => m.done).length;

  const tabs = [
    { id: 'overview',   label: 'Overview',   icon: BarChart3 },
    { id: 'tasks',      label: `Tasks (${project.task_count || 0})`, icon: CheckSquare },
    { id: 'documents',  label: 'Documents',  icon: FileText },
    { id: 'milestones', label: `Milestones (${(project.milestones || []).length})`, icon: Target },
  ];

  return (
    <div className="page-fill" style={{ flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <button onClick={() => navigate('/projects')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <ArrowLeft size={13} /> Projects
          </button>
          <ChevronRight size={10} color="var(--tx-3)" />
          <span style={{ fontSize: 12, color: 'var(--tx-1)', fontWeight: 600 }}>{project.name}</span>
        </div>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <TypePill type={project.project_type} />
              <StatusDot status={project.status} />
              <PriorityPill priority={project.priority} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-.03em', color: 'var(--tx-1)' }}>{project.name}</h1>
            {project.client_name && (
              <div style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Folder size={11} /> {project.client_name}
              </div>
            )}
          </div>

          <button onClick={() => navigate(`/projects?edit=${project.id}`)} className="btn-ghost btn-sm" style={{ gap: 4 }}>
            <Edit3 size={12} /> Edit
          </button>
        </div>

        {/* Progress + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
          <div style={{ flex: 1, maxWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{project.completed_task_count || 0}/{project.task_count || 0} tasks</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-1)' }}>{project.progress || 0}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${project.progress || 0}%`, background: project.progress === 100 ? '#22c55e' : 'var(--red)', borderRadius: 3, transition: 'width .3s' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--tx-3)' }}>
            <span><Calendar size={10} style={{ marginRight: 3 }} /> Due {project.due_date ? new Date(project.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
            <span><Users size={10} style={{ marginRight: 3 }} /> {(project.team_members || []).length} member{(project.team_members || []).length !== 1 ? 's' : ''}</span>
            <span><Target size={10} style={{ marginRight: 3 }} /> {completedMilestones}/{(project.milestones || []).length} milestones</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--red)' : 'transparent'}`, cursor: 'pointer', color: active ? 'var(--tx-1)' : 'var(--tx-3)', fontSize: 12, fontWeight: active ? 600 : 500, transition: 'all .12s', marginBottom: -1 }}>
                <t.icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }}>
        {tab === 'overview' && (
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
            {/* Description */}
            {project.description && (
              <div style={{ marginBottom: 24 }}>
                <div style={labelStyle}>Description</div>
                <div style={{ fontSize: 13.5, color: 'var(--tx-2)', lineHeight: 1.7, background: 'var(--bg-elevated)', padding: '14px 16px', borderRadius: 10 }}>
                  {project.description}
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
              {[
                { label: 'Progress', value: `${project.progress || 0}%`, color: project.progress === 100 ? '#22c55e' : 'var(--red)', icon: BarChart3 },
                { label: 'Tasks', value: `${project.completed_task_count || 0}/${project.task_count || 0}`, color: '#22c55e', icon: CheckSquare },
                { label: 'Milestones', value: `${completedMilestones}/${(project.milestones || []).length}`, color: '#a855f7', icon: Target },
                { label: 'Team', value: (project.team_members || []).length, color: '#3b82f6', icon: Users },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <s.icon size={14} color={s.color} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, letterSpacing: '-.02em' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Team members */}
            {(project.team_members || []).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={labelStyle}>Team</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(project.team_members || []).map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--red)' }}>
                        {(m.name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <span style={{ fontSize: 12.5, color: 'var(--tx-1)', fontWeight: 500 }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setTab('tasks')} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
                <CheckSquare size={13} /> View Tasks
              </button>
              <button onClick={() => setTab('documents')} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
                <FileText size={13} /> Documents
              </button>
              <button onClick={() => setTab('milestones')} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
                <Target size={13} /> Milestones
              </button>
            </div>
          </div>
        )}

        {tab === 'tasks' && <TasksTab projectId={project.id} taskCount={project.task_count} teamMembers={allUsers} />}
        {tab === 'documents' && <DocumentsTab projectId={project.id} />}
        {tab === 'milestones' && <MilestonesTab project={project} onRefresh={fetchProject} />}
      </div>
    </div>
  );
}

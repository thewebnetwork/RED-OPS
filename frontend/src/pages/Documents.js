/**
 * Documents — Notion-style block editor with page hierarchy
 *
 * Features:
 *   • Sidebar page tree with parent/child nesting
 *   • TipTap rich text editor (headings, lists, code, tasks)
 *   • Create, edit, archive documents
 *   • Search across all pages
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  FileText, Plus, Search, X, ChevronRight, ChevronDown,
  Loader2, Trash2, ArrowLeft, Bold, Italic, List, ListOrdered,
  Heading1, Heading2, Code, CheckSquare, Minus, Upload, Download, File, Image,
} from 'lucide-react';
import BulkActionBar from '../components/BulkActionBar';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

/* ── Editor Toolbar ── */
function EditorToolbar({ editor }) {
  if (!editor) return null;
  const btn = (active, onClick, children) => (
    <button onClick={onClick} style={{
      padding: '4px 6px', background: active ? 'var(--accent-soft)' : 'none',
      border: 'none', borderRadius: 4, cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--tx-2)',
      display: 'flex', alignItems: 'center',
    }}>{children}</button>
  );
  return (
    <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={15} />)}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={15} />)}
      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={15} />)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={15} />)}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), <Code size={15} />)}
      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={15} />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={15} />)}
      {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), <CheckSquare size={15} />)}
      {btn(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), <>{`{ }`}</>)}
      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), <Minus size={15} />)}
    </div>
  );
}

/* ── Page Tree Item ── */
function PageTreeItem({ doc, selected, onSelect, depth = 0, checkedIds, onToggleCheck }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const hasChildren = doc.child_count > 0;
  const isSelected = selected === doc.id;

  useEffect(() => {
    if (expanded && hasChildren && children.length === 0) {
      ax().get(`${API}/documents/${doc.id}/children`).then(r => setChildren(r.data || [])).catch(() => {});
    }
  }, [expanded, hasChildren, doc.id, children.length]);

  return (
    <>
      <div
        onClick={() => onSelect(doc.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
          paddingLeft: 8 + depth * 16, borderRadius: 5, cursor: 'pointer',
          background: isSelected ? 'var(--accent-soft)' : 'transparent',
          color: isSelected ? 'var(--accent)' : 'var(--tx-2)', fontSize: 13, fontWeight: 500,
          transition: 'background .1s',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-3)'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        {hasChildren ? (
          <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span style={{ width: 13 }} />}
        {onToggleCheck && (
          <input type="checkbox" checked={(checkedIds || []).includes(doc.id)}
            onChange={e => { e.stopPropagation(); onToggleCheck(doc.id, e.target.checked); }}
            onClick={e => e.stopPropagation()}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 14 }}>{doc.icon || '📄'}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
      </div>
      {expanded && children.map(c => (
        <PageTreeItem key={c.id} doc={c} selected={selected} onSelect={onSelect} depth={depth + 1} checkedIds={checkedIds} onToggleCheck={onToggleCheck} />
      ))}
    </>
  );
}

/* ── Main Page ── */
export default function Documents() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [editTitle, setEditTitle] = useState(false);
  const [docFiles, setDocFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState('');
  const saveTimer = { current: null };

  const fetchDocs = useCallback(async () => {
    try {
      const res = await ax().get(`${API}/documents`, { params: search ? { search } : {} });
      setDocs(res.data || []);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // Auto-save after 1s of inactivity
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (selectedId) saveContent(selectedId, editor.getJSON());
      }, 1000);
    },
  });

  const saveContent = async (docId, content) => {
    setSaving(true);
    try {
      await ax().patch(`${API}/documents/${docId}`, { content });
    } catch { /* silent save failure */ }
    finally { setSaving(false); }
  };

  const loadDoc = async (docId) => {
    setSelectedId(docId);
    setDocLoading(true);
    try {
      const res = await ax().get(`${API}/documents/${docId}`);
      setSelectedDoc(res.data);
      setTitle(res.data.title);
      if (editor && res.data.content) {
        editor.commands.setContent(res.data.content);
      } else if (editor) {
        editor.commands.setContent('');
      }
      fetchDocFiles(docId);
    } catch { toast.error('Failed to load document'); }
    finally { setDocLoading(false); }
  };

  const createDoc = async (parentId = null) => {
    try {
      const res = await ax().post(`${API}/documents`, { title: 'Untitled', parent_id: parentId });
      fetchDocs();
      loadDoc(res.data.id);
    } catch { toast.error('Failed to create document'); }
  };

  const saveTitle = async () => {
    if (!selectedId || !title.trim()) return;
    setEditTitle(false);
    try {
      await ax().patch(`${API}/documents/${selectedId}`, { title: title.trim() });
      setSelectedDoc(prev => prev ? { ...prev, title: title.trim() } : prev);
      fetchDocs();
    } catch { toast.error('Failed to update title'); }
  };

  const bulkDeleteDocs = async () => {
    if (!window.confirm(`Archive ${selectedDocIds.length} pages?`)) return;
    try {
      await Promise.all(selectedDocIds.map(id => ax().delete(`${API}/documents/${id}`)));
      toast.success(`Archived ${selectedDocIds.length} pages`);
      setSelectedDocIds([]);
      fetchDocs();
    } catch { toast.error('Failed to archive'); }
  };

  const fetchDocFiles = async (docId) => {
    try {
      const res = await ax().get(`${API}/files`, { params: { context_type: 'document', context_id: docId } });
      setDocFiles(res.data || []);
    } catch { setDocFiles([]); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    if (file.size > 25 * 1024 * 1024) { toast.error('File must be under 25MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('context_type', 'document');
      fd.append('context_id', selectedId);
      await ax().post(`${API}/files/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Uploaded ${file.name}`);
      fetchDocFiles(selectedId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteDocFile = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await ax().delete(`${API}/files/${fileId}`);
      toast.success('File deleted');
      fetchDocFiles(selectedId);
    } catch { toast.error('Failed to delete'); }
  };

  const archiveDoc = async () => {
    if (!selectedId || !window.confirm('Archive this page? It can be restored later.')) return;
    try {
      await ax().delete(`${API}/documents/${selectedId}`);
      setSelectedId(null);
      setSelectedDoc(null);
      if (editor) editor.commands.setContent('');
      fetchDocs();
      toast.success('Page archived');
    } catch { toast.error('Failed to archive'); }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar — page tree */}
      <div style={{ width: 260, minWidth: 260, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Pages</span>
          </div>
          <button onClick={() => createDoc()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', padding: '3px 6px', display: 'flex' }}>
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 10px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pages..."
              style={{ width: '100%', paddingLeft: 28, padding: '6px 8px 6px 28px', fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--tx-1)', outline: 'none' }} />
          </div>
        </div>

        {/* Page list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={16} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
          ) : docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--tx-3)' }}>
              {search ? 'No pages match your search' : 'No pages yet. Create one!'}
            </div>
          ) : (
            docs.map(d => <PageTreeItem key={d.id} doc={d} selected={selectedId} onSelect={loadDoc}
              checkedIds={selectedDocIds} onToggleCheck={(id, checked) => setSelectedDocIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id))} />)
          )}
        </div>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedDoc ? (
          <>
            {/* Doc header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <button onClick={() => { setSelectedId(null); setSelectedDoc(null); if (editor) editor.commands.setContent(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, display: 'flex' }}>
                <ArrowLeft size={16} />
              </button>
              <span style={{ fontSize: 18 }}>{selectedDoc.icon || '📄'}</span>
              {editTitle ? (
                <input value={title} onChange={e => setTitle(e.target.value)}
                  onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); }}
                  autoFocus style={{ flex: 1, fontSize: 16, fontWeight: 700, background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx-1)' }} />
              ) : (
                <span onClick={() => setEditTitle(true)} style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', cursor: 'pointer' }}>
                  {selectedDoc.title}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving && <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>Saving...</span>}
                {uploading && <Loader2 size={13} className="spin" style={{ color: 'var(--tx-3)' }} />}
                <button onClick={() => fileInputRef.current?.click()} className="btn-ghost btn-xs" style={{ gap: 4 }}>
                  <Upload size={12} /> Upload
                </button>
                <input ref={fileInputRef} type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                <button onClick={() => createDoc(selectedId)} className="btn-ghost btn-xs" style={{ gap: 4 }}>
                  <Plus size={12} /> Subpage
                </button>
                <button onClick={archiveDoc} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, display: 'flex' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <EditorToolbar editor={editor} />

            {/* Editor */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
              {docLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
              ) : (
                <EditorContent editor={editor} style={{ minHeight: 400 }} />
              )}

              {/* Attached Files */}
              {docFiles.length > 0 && (
                <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)', marginTop: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <File size={12} /> Attachments ({docFiles.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {docFiles.map(f => {
                      const isImg = f.content_type?.startsWith('image/');
                      return (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}
                          onMouseEnter={e => { const d = e.currentTarget.querySelector('[data-fdel]'); if (d) d.style.opacity = 1; }}
                          onMouseLeave={e => { const d = e.currentTarget.querySelector('[data-fdel]'); if (d) d.style.opacity = 0; }}>
                          {isImg ? <Image size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : <File size={16} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />}
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.original_filename || f.filename || 'File'}</span>
                          <span style={{ fontSize: 10, color: 'var(--tx-3)', flexShrink: 0 }}>{f.size ? `${(f.size / 1024).toFixed(0)}KB` : ''}</span>
                          {f.download_url && (
                            <a href={f.download_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>
                              <Download size={14} />
                            </a>
                          )}
                          <button data-fdel onClick={() => deleteDocFile(f.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, opacity: 0, transition: 'opacity .1s', flexShrink: 0 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <FileText size={40} style={{ color: 'var(--tx-3)', opacity: 0.4 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)' }}>Select or create a page</h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', maxWidth: 300, textAlign: 'center' }}>
              Pages are your team's wiki — SOPs, playbooks, meeting notes. Rich text with headings, lists, and task checklists.
            </p>
            <button onClick={() => createDoc()} className="btn-primary" style={{ gap: 6 }}>
              <Plus size={14} /> New Page
            </button>
          </div>
        )}
      </div>

      <BulkActionBar
        count={selectedDocIds.length}
        onClear={() => setSelectedDocIds([])}
        actions={[
          { label: 'Archive', danger: true, onClick: bulkDeleteDocs },
        ]}
      />
    </div>
  );
}

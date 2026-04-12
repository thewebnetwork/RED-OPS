/**
 * DocEditor — full-screen tiptap editor overlay for a single document.
 *
 * Props:
 *   docId: string          — the document to open
 *   onClose: () => void    — fired when user closes the overlay
 *   onChange?: () => void  — optional callback after title/content saves
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  X, Loader2, Bold, Italic, List, ListOrdered, Heading1, Heading2, Code,
  CheckSquare, Minus, Star,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

function EditorToolbar({ editor }) {
  if (!editor) return null;
  const btn = (active, onClick, children, title) => (
    <button onClick={onClick} title={title} style={{
      padding: '6px 8px', background: active ? 'var(--accent-soft)' : 'none',
      border: 'none', borderRadius: 6, cursor: 'pointer',
      color: active ? 'var(--accent)' : 'var(--tx-2)',
      display: 'flex', alignItems: 'center',
    }}>{children}</button>
  );
  return (
    <div style={{
      display: 'flex', gap: 2, padding: '8px 16px', borderBottom: '1px solid var(--border)',
      flexWrap: 'wrap', background: 'var(--surface)',
    }}>
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 size={15} />, 'Heading 1')}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 size={15} />, 'Heading 2')}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold size={15} />, 'Bold')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic size={15} />, 'Italic')}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), <Code size={15} />, 'Code')}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List size={15} />, 'Bulleted list')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={15} />, 'Numbered list')}
      {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), <CheckSquare size={15} />, 'Checklist')}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), <Minus size={15} />, 'Divider')}
    </div>
  );
}

export default function DocEditor({ docId, onClose, onChange }) {
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [editTitle, setEditTitle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: '',
    onUpdate: ({ editor: ed }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (docId) {
          setSaving(true);
          ax().patch(`${API}/documents/${docId}`, { content: ed.getJSON() })
            .catch(() => {}).finally(() => setSaving(false));
        }
      }, 800);
    },
  });

  useEffect(() => {
    if (!docId) return;
    setLoading(true);
    ax().get(`${API}/documents/${docId}`).then(r => {
      setDoc(r.data);
      setTitle(r.data.title || 'Untitled');
      if (editor) {
        if (r.data.content) editor.commands.setContent(r.data.content);
        else editor.commands.setContent('');
      }
    }).catch(() => toast.error('Failed to load document'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, editor]);

  const saveTitle = useCallback(async () => {
    if (!title.trim() || !docId) { setEditTitle(false); return; }
    setEditTitle(false);
    try {
      await ax().patch(`${API}/documents/${docId}`, { title: title.trim() });
      setDoc(prev => prev ? { ...prev, title: title.trim() } : prev);
      onChange?.();
    } catch { toast.error('Failed to rename'); }
  }, [title, docId, onChange]);

  const toggleStar = async () => {
    if (!docId) return;
    try {
      const r = await ax().post(`${API}/documents/${docId}/star`);
      setDoc(prev => prev ? { ...prev, starred_by_me: r.data?.starred ?? !prev.starred_by_me } : prev);
      onChange?.();
    } catch { /* ignore */ }
  };

  const isStarred = doc?.starred_by_me;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(920px, 94vw)', height: 'min(90vh, 1000px)',
          background: 'var(--surface)', border: '1px solid var(--border-hi)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          animation: 'modalEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: 'var(--surface)',
        }}>
          <span style={{ fontSize: 20 }}>{doc?.icon || '📄'}</span>
          {editTitle ? (
            <input value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(doc?.title || ''); setEditTitle(false); } }}
              autoFocus
              style={{
                flex: 1, fontSize: 18, fontWeight: 700, background: 'transparent',
                border: 'none', outline: 'none', color: 'var(--tx-1)', fontFamily: 'inherit',
              }} />
          ) : (
            <span onClick={() => setEditTitle(true)} style={{
              flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--tx-1)', cursor: 'pointer',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {doc?.title || 'Untitled'}
            </span>
          )}
          {saving && <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Saving…</span>}
          <button onClick={toggleStar}
            title={isStarred ? 'Unstar' : 'Star'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: isStarred ? '#f59e0b' : 'var(--tx-3)', display: 'flex' }}>
            <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onClose} title="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 6,
            color: 'var(--tx-2)', display: 'flex', borderRadius: 6,
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <EditorToolbar editor={editor} />

        {/* Editor body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 56px', background: 'var(--surface)' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} />
            </div>
          ) : (
            <EditorContent editor={editor} style={{ minHeight: 400, maxWidth: 740, margin: '0 auto' }} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Files & Docs — Universal File + Knowledge Base Management
 *
 * Google-Drive-style file browser with:
 *   • Folder hierarchy (create, nest, rename, delete)
 *   • File upload with drag-and-drop zone
 *   • Context filtering (all / order / project / standalone / knowledge_base)
 *   • Knowledge Base articles inline (create, edit, view, star, version history)
 *   • Deliverable tagging
 *   • Search, grid/list view toggle
 *   • Breadcrumb navigation
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Folder, FolderPlus, Upload, FileText, Image, FileSpreadsheet, FileVideo,
  FileAudio, File as FileIcon, Download, MoreVertical, Trash2, Pencil,
  Star, Grid3X3, List, Search, ChevronRight, Home, X, Plus, ArrowLeft,
  Tag, Filter, HardDrive, Clock, Eye, Check, BookOpen, Globe, Lock,
  Edit2, History, Loader
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });
const getUserId = () => { try { return JSON.parse(atob(tok().split('.')[1])).sub; } catch { return null; } };

// ── file icon by MIME type ──
function fileIcon(contentType, size = 20) {
  if (!contentType) return <FileIcon size={size} />;
  if (contentType.startsWith('image/')) return <Image size={size} style={{ color: 'var(--purple)' }} />;
  if (contentType.includes('spreadsheet') || contentType.includes('csv') || contentType.includes('excel'))
    return <FileSpreadsheet size={size} style={{ color: 'var(--green)' }} />;
  if (contentType.startsWith('video/')) return <FileVideo size={size} style={{ color: 'var(--red)' }} />;
  if (contentType.startsWith('audio/')) return <FileAudio size={size} style={{ color: 'var(--yellow)' }} />;
  if (contentType.includes('pdf')) return <FileText size={size} style={{ color: 'var(--red)' }} />;
  if (contentType.includes('word') || contentType.includes('document'))
    return <FileText size={size} style={{ color: 'var(--blue)' }} />;
  return <FileIcon size={size} style={{ color: 'var(--tx-2)' }} />;
}

function humanSize(bytes) {
  if (!bytes) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let s = bytes;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return `${s.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function timeAgo(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

// ── KB Folder config ──
const KB_FOLDERS = [
  { key: 'playbook',  label: 'Playbook',  icon: BookOpen },
  { key: 'template',  label: 'Template',  icon: FileText },
  { key: 'reference', label: 'Reference', icon: Folder },
  { key: 'training',  label: 'Training',  icon: Globe },
  { key: 'general',   label: 'General',   icon: Folder },
];
const KB_FOLDER_MAP = Object.fromEntries(KB_FOLDERS.map(f => [f.key, f]));

const ACCESS_STYLES = {
  internal: { background: '#a855f718', color: '#a855f7' },
  shared:   { background: '#3b82f618', color: '#3b82f6' },
};

// ── Context tab config ──
const CONTEXT_TABS = [
  { key: 'all',            label: 'All',            icon: HardDrive },
  { key: 'order',          label: 'Orders',         icon: Tag },
  { key: 'project',        label: 'Projects',       icon: Folder },
  { key: 'standalone',     label: 'Standalone',     icon: FileIcon },
  { key: 'knowledge_base', label: 'Knowledge Base', icon: BookOpen },
];

export default function Files({ defaultContext }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = useMemo(() => getUserId(), []);

  // State
  const [view, setView] = useState(() => localStorage.getItem('files_view') || 'grid');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Navigation
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [contextFilter, setContextFilter] = useState(defaultContext || searchParams.get('context') || 'all');

  // Search
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchTimer = useRef(null);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Deliverable filter
  const [deliverableOnly, setDeliverableOnly] = useState(false);

  // ── Knowledge Base state ──
  const [kbDocs, setKbDocs] = useState([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbFolderStats, setKbFolderStats] = useState({});
  const [kbActiveFolder, setKbActiveFolder] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showKbEditor, setShowKbEditor] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [kbSaving, setKbSaving] = useState(false);
  const [kbForm, setKbForm] = useState({ title: '', folder: 'playbook', access: 'internal', body: '' });
  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);

  const isKB = contextFilter === 'knowledge_base';

  // ── Load file data ──
  const loadFolders = useCallback(async () => {
    if (isKB) return;
    try {
      const params = { parent_folder_id: currentFolderId || undefined };
      if (contextFilter !== 'all') params.context_type = contextFilter;
      const { data } = await ax().get(`${API}/files/folders`, { params });
      setFolders(data);
    } catch { setFolders([]); }
  }, [currentFolderId, contextFilter, isKB]);

  const loadFiles = useCallback(async () => {
    if (isKB) return;
    try {
      const params = {};
      if (currentFolderId) params.folder_id = currentFolderId;
      else if (!searchDebounced) params.folder_id = 'root';
      if (contextFilter !== 'all') params.context_type = contextFilter;
      if (deliverableOnly) params.is_deliverable = true;
      if (searchDebounced) params.search = searchDebounced;
      const { data } = await ax().get(`${API}/files`, { params });
      setFiles(data);
    } catch { setFiles([]); }
  }, [currentFolderId, contextFilter, deliverableOnly, searchDebounced, isKB]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await ax().get(`${API}/files/stats/summary`);
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  // ── Load KB data ──
  const loadKbDocs = useCallback(async () => {
    if (!isKB) return;
    try {
      setKbLoading(true);
      const params = {};
      if (kbActiveFolder) params.folder = kbActiveFolder;
      if (searchDebounced) params.search = searchDebounced;
      const { data } = await ax().get(`${API}/knowledge-base/documents`, { params });
      setKbDocs(data);
    } catch (err) {
      console.error('Failed to load KB documents', err);
      if (err.response?.status !== 401) toast.error('Failed to load documents');
      setKbDocs([]);
    } finally {
      setKbLoading(false);
    }
  }, [isKB, kbActiveFolder, searchDebounced]);

  const loadKbFolderStats = useCallback(async () => {
    if (!isKB) return;
    try {
      const { data } = await ax().get(`${API}/knowledge-base/folders/stats`);
      setKbFolderStats(data);
    } catch { /* silent */ }
  }, [isKB]);

  // ── Effects ──
  useEffect(() => {
    if (isKB) {
      setKbLoading(true);
      Promise.all([loadKbDocs(), loadKbFolderStats()]).finally(() => setKbLoading(false));
    } else {
      setLoading(true);
      Promise.all([loadFolders(), loadFiles(), loadStats()]).finally(() => setLoading(false));
    }
  }, [isKB, loadFolders, loadFiles, loadStats, loadKbDocs, loadKbFolderStats]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // View persistence
  useEffect(() => { localStorage.setItem('files_view', view); }, [view]);

  // Sync context from URL params
  useEffect(() => {
    const ctx = searchParams.get('context');
    if (ctx && CONTEXT_TABS.some(t => t.key === ctx)) {
      setContextFilter(ctx);
    }
  }, [searchParams]);

  // ── Breadcrumb builder ──
  const navigateToFolder = useCallback(async (folderId) => {
    if (!folderId) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
      return;
    }
    try {
      const target = folders.find(f => f.id === folderId);
      if (target) {
        setBreadcrumbs(prev => {
          const existingIdx = prev.findIndex(b => b.id === folderId);
          if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
          return [...prev, { id: folderId, name: target.name }];
        });
      }
    } catch { /* ignore */ }
    setCurrentFolderId(folderId);
  }, [folders]);

  // ── File Actions ──
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await ax().post(`${API}/files/folders`, {
        name: newFolderName.trim(),
        parent_folder_id: currentFolderId,
        context_type: contextFilter !== 'all' ? contextFilter : 'standalone',
      });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFolders();
    } catch (e) {
      toast.error('Failed to create folder');
    }
  };

  const handleUpload = async (fileList) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const f of fileList) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('context_type', contextFilter !== 'all' ? contextFilter : 'standalone');
        if (currentFolderId) fd.append('folder_id', currentFolderId);
        await ax().post(`${API}/files/upload`, fd);
      }
      loadFiles();
      loadStats();
      toast.success('Upload complete');
    } catch (e) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (file) => {
    try {
      const { data } = await ax().get(`${API}/files/${file.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename || file.label;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await ax().delete(`${API}/files/${fileId}`);
      loadFiles();
      loadStats();
      toast.success('File deleted');
    } catch { toast.error('Delete failed'); }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder? Files will be moved to parent.')) return;
    try {
      await ax().delete(`${API}/files/folders/${folderId}`);
      loadFolders();
      loadFiles();
      toast.success('Folder deleted');
    } catch { toast.error('Delete failed'); }
  };

  const toggleDeliverable = async (file) => {
    try {
      await ax().patch(`${API}/files/${file.id}`, { is_deliverable: !file.is_deliverable });
      loadFiles();
    } catch { /* ignore */ }
  };

  const renameItem = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      if (renameTarget.type === 'folder') {
        await ax().patch(`${API}/files/folders/${renameTarget.id}`, { name: renameValue.trim() });
        loadFolders();
      } else {
        await ax().patch(`${API}/files/${renameTarget.id}`, { label: renameValue.trim() });
        loadFiles();
      }
      setRenameTarget(null);
      setRenameValue('');
    } catch { toast.error('Rename failed'); }
  };

  // ── KB Actions ──
  const openKbCreate = () => {
    setEditingDoc(null);
    setKbForm({ title: '', folder: kbActiveFolder || 'playbook', access: 'internal', body: '' });
    setShowKbEditor(true);
  };

  const openKbEdit = (doc, e) => {
    e?.stopPropagation();
    setEditingDoc(doc);
    setKbForm({ title: doc.title, folder: doc.folder, access: doc.access, body: doc.body || '' });
    setShowKbEditor(true);
    setSelectedDoc(null);
  };

  const saveKbDoc = async () => {
    if (!kbForm.title.trim()) { toast.error('Title is required'); return; }
    if (!kbForm.body.trim()) { toast.error('Body cannot be empty'); return; }
    setKbSaving(true);
    try {
      if (editingDoc) {
        await ax().patch(`${API}/knowledge-base/documents/${editingDoc.id}`, kbForm);
        toast.success('Document updated');
      } else {
        await ax().post(`${API}/knowledge-base/documents`, kbForm);
        toast.success('Document created');
      }
      setShowKbEditor(false);
      loadKbDocs();
      loadKbFolderStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setKbSaving(false);
    }
  };

  const deleteKbDoc = (doc, e) => {
    e?.stopPropagation();
    toast(`Delete "${doc.title}"?`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await ax().delete(`${API}/knowledge-base/documents/${doc.id}`);
            if (selectedDoc?.id === doc.id) setSelectedDoc(null);
            toast.success('Document deleted');
            loadKbDocs();
            loadKbFolderStats();
          } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to delete');
          }
        },
      },
      cancel: { label: 'Cancel' },
    });
  };

  const toggleKbStar = async (doc, e) => {
    e?.stopPropagation();
    try {
      const { data } = await ax().post(`${API}/knowledge-base/documents/${doc.id}/star`, {});
      setKbDocs(prev => prev.map(d => {
        if (d.id !== doc.id) return d;
        const sb = [...(d.starred_by || [])];
        if (data.status === 'starred') { if (!sb.includes(userId)) sb.push(userId); }
        else { const idx = sb.indexOf(userId); if (idx >= 0) sb.splice(idx, 1); }
        return { ...d, starred_by: sb };
      }));
      if (selectedDoc?.id === doc.id) {
        setSelectedDoc(prev => {
          const sb = [...(prev.starred_by || [])];
          if (data.status === 'starred') { if (!sb.includes(userId)) sb.push(userId); }
          else { const idx = sb.indexOf(userId); if (idx >= 0) sb.splice(idx, 1); }
          return { ...prev, starred_by: sb };
        });
      }
      loadKbFolderStats();
    } catch { /* silent */ }
  };

  const loadKbVersions = async (docId) => {
    try {
      const { data } = await ax().get(`${API}/knowledge-base/documents/${docId}/versions`);
      setVersions(data);
      setShowVersions(true);
    } catch {
      toast.error('Failed to load version history');
    }
  };

  const selectKbDoc = async (doc) => {
    try {
      const { data } = await ax().get(`${API}/knowledge-base/documents/${doc.id}`);
      setSelectedDoc(data);
    } catch {
      setSelectedDoc(doc);
    }
  };

  const isStarred = (doc) => (doc.starred_by || []).includes(userId);

  // ── Drag & Drop ──
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleUpload(Array.from(e.dataTransfer.files));
  };

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // ── Derived ──
  const kbFiltered = useMemo(() => kbDocs, [kbDocs]);
  const kbStarred = useMemo(() => kbDocs.filter(d => (d.starred_by || []).includes(userId)), [kbDocs, userId]);
  const kbFolderCount = (key) => kbFolderStats?.folders?.[key] || 0;
  const isEmpty = folders.length === 0 && files.length === 0;

  // ── Switch context handler ──
  const switchContext = (ctx) => {
    setContextFilter(ctx);
    setCurrentFolderId(null);
    setBreadcrumbs([]);
    setSearch('');
    setSearchDebounced('');
    setSelectedDoc(null);
    setKbActiveFolder(null);
    setSearchParams(ctx !== 'all' ? { context: ctx } : {});
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>
            {isKB ? 'Knowledge Base' : 'Files & Docs'}
          </h1>
          {!isKB && stats && (
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>
              {stats.total_files} files · {stats.total_folders} folders · {humanSize(stats.total_size_bytes)}
              {stats.deliverables > 0 && ` · ${stats.deliverables} deliverables`}
            </p>
          )}
          {isKB && (
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>
              {kbFolderStats?.total || 0} documents · SOPs, playbooks, templates & training
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isKB ? (
            <button onClick={openKbCreate} style={btnPrimary}>
              <Plus size={16} /> New Document
            </button>
          ) : (
            <>
              <button onClick={() => setShowNewFolder(true)} style={btnSecondary}>
                <FolderPlus size={16} /> New Folder
              </button>
              <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}>
                <Upload size={16} /> Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleUpload(Array.from(e.target.files))}
              />
            </>
          )}
        </div>
      </div>

      {/* Context Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Context filter tabs */}
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
          {CONTEXT_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => switchContext(key)}
              style={{
                ...chipStyle,
                background: contextFilter === key ? (key === 'knowledge_base' ? 'var(--purple)' : 'var(--accent)') : 'var(--card)',
                color: contextFilter === key ? '#fff' : 'var(--tx-2)',
                border: `1px solid ${contextFilter === key ? (key === 'knowledge_base' ? 'var(--purple)' : 'var(--accent)') : 'var(--border)'}`,
                gap: 6,
              }}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* File-specific controls (not shown in KB mode) */}
        {!isKB && (
          <>
            {/* Deliverable toggle */}
            <button
              onClick={() => setDeliverableOnly(!deliverableOnly)}
              style={{
                ...chipStyle,
                background: deliverableOnly ? 'var(--green)' : 'var(--card)',
                color: deliverableOnly ? '#fff' : 'var(--tx-2)',
                border: `1px solid ${deliverableOnly ? 'var(--green)' : 'var(--border)'}`,
              }}
            >
              <Star size={14} /> Deliverables
            </button>
          </>
        )}

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isKB ? 'Search documents…' : 'Search files…'}
            style={{ ...inputStyle, paddingLeft: 32, width: 200 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('grid')} style={{ ...viewBtn, background: view === 'grid' ? 'var(--accent)' : 'var(--card)', color: view === 'grid' ? '#fff' : 'var(--tx-3)' }}>
            <Grid3X3 size={16} />
          </button>
          <button onClick={() => setView('list')} style={{ ...viewBtn, background: view === 'list' ? 'var(--accent)' : 'var(--card)', color: view === 'list' ? '#fff' : 'var(--tx-3)' }}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════ */}
      {/* KNOWLEDGE BASE MODE */}
      {/* ═══════════════════════════════════ */}
      {isKB ? (
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minHeight: 500, background: 'var(--card)' }}>

          {/* ── KB Sidebar ── */}
          <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 20, overflowY: 'auto', flexShrink: 0, background: 'var(--bg)' }}>
            {/* Folders */}
            <div>
              <span style={sidebarLabel}>Folders</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* All */}
                <button
                  onClick={() => setKbActiveFolder(null)}
                  style={kbSidebarBtn(!kbActiveFolder)}
                >
                  <Folder size={14} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>All Documents</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{kbFolderStats?.total || 0}</span>
                </button>

                {KB_FOLDERS.map(({ key, label, icon: Icon }) => {
                  const active = kbActiveFolder === key;
                  return (
                    <button key={key}
                      onClick={() => setKbActiveFolder(active ? null : key)}
                      style={kbSidebarBtn(active)}
                    >
                      <Icon size={14} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                      <span style={{ fontSize: 11, color: 'var(--tx-3)', flexShrink: 0 }}>{kbFolderCount(key)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Starred */}
            {kbStarred.length > 0 && (
              <div>
                <span style={sidebarLabel}>Starred</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {kbStarred.slice(0, 5).map(doc => (
                    <button key={doc.id} onClick={() => selectKbDoc(doc)}
                      style={{ padding: '7px 10px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'all .12s' }}
                      title={doc.title}>
                      <Star size={11} style={{ marginRight: 5, display: 'inline', color: '#f59e0b' }} />
                      {doc.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── KB Main Area ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedDoc ? (
              <>
                {/* Doc count */}
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                    {kbFiltered.length} doc{kbFiltered.length !== 1 ? 's' : ''}{kbActiveFolder ? ` in ${KB_FOLDER_MAP[kbActiveFolder]?.label || kbActiveFolder}` : ''}
                  </span>
                </div>

                {/* Doc list */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {kbLoading ? (
                    <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--tx-3)' }}>
                      <Loader size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                      <p style={{ margin: 0, fontSize: 13 }}>Loading documents...</p>
                    </div>
                  ) : kbFiltered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--tx-3)' }}>
                      <BookOpen size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--tx-2)' }}>No documents found</p>
                      <p style={{ margin: '6px 0 0', fontSize: 12 }}>Create SOPs, playbooks, and training docs</p>
                      <button onClick={openKbCreate} style={{ ...btnPrimary, margin: '16px auto 0', display: 'inline-flex' }}>
                        <Plus size={13} /> New Document
                      </button>
                    </div>
                  ) : view === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, padding: 16 }}>
                      {kbFiltered.map(doc => (
                        <KBDocCard
                          key={doc.id}
                          doc={doc}
                          isStarred={isStarred(doc)}
                          onSelect={() => selectKbDoc(doc)}
                          onStar={(e) => toggleKbStar(doc, e)}
                          onEdit={(e) => openKbEdit(doc, e)}
                          onDelete={(e) => deleteKbDoc(doc, e)}
                        />
                      ))}
                    </div>
                  ) : (
                    kbFiltered.map(doc => (
                      <KBDocRow
                        key={doc.id}
                        doc={doc}
                        isStarred={isStarred(doc)}
                        onSelect={() => selectKbDoc(doc)}
                        onStar={(e) => toggleKbStar(doc, e)}
                        onEdit={(e) => openKbEdit(doc, e)}
                        onDelete={(e) => deleteKbDoc(doc, e)}
                      />
                    ))
                  )}
                </div>
              </>
            ) : (
              /* ── Doc Viewer ── */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => { setSelectedDoc(null); setShowVersions(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--tx-2)' }}><ArrowLeft size={18} /></button>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--tx-1)' }}>{selectedDoc.title}</h2>
                  <button onClick={e => toggleKbStar(selectedDoc, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isStarred(selectedDoc) ? '#f59e0b' : 'var(--tx-3)', padding: 4 }}>
                    <Star size={16} fill={isStarred(selectedDoc) ? 'currentColor' : 'none'} />
                  </button>
                  <button style={ghostBtn} onClick={() => loadKbVersions(selectedDoc.id)}><History size={13} /> History</button>
                  <button style={ghostBtn} onClick={e => openKbEdit(selectedDoc, e)}><Edit2 size={13} /> Edit</button>
                  <button style={{ ...ghostBtn, color: '#ef4444' }} onClick={e => deleteKbDoc(selectedDoc, e)}><Trash2 size={13} /> Delete</button>
                </div>

                {/* Meta */}
                <div style={{ padding: '12px 20px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    ['Author', selectedDoc.created_by_name || 'Unknown'],
                    ['Updated', timeAgo(selectedDoc.updated_at)],
                    ['Folder', KB_FOLDER_MAP[selectedDoc.folder]?.label || selectedDoc.folder],
                    ['Version', `v${selectedDoc.version || 1}`],
                  ].map(([lbl, val]) => (
                    <div key={lbl}>
                      <span style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>{lbl}</span>
                      <span style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{val}</span>
                    </div>
                  ))}
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 2 }}>Access</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, ...ACCESS_STYLES[selectedDoc.access] }}>{selectedDoc.access}</span>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
                  <div style={{ color: 'var(--tx-1)', lineHeight: 1.75, fontSize: 14, maxWidth: 740 }} dangerouslySetInnerHTML={{ __html: selectedDoc.body }} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════ */
        /* FILE MODE */
        /* ═══════════════════════════════════ */
        <>
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
            <button
              onClick={() => navigateToFolder(null)}
              style={{ ...chipStyle, background: !currentFolderId ? 'var(--accent)' : 'transparent', color: !currentFolderId ? '#fff' : 'var(--tx-2)' }}
            >
              <Home size={14} /> All Files
            </button>
            {breadcrumbs.map((bc, i) => (
              <span key={bc.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronRight size={14} style={{ color: 'var(--tx-3)' }} />
                <button
                  onClick={() => {
                    setBreadcrumbs(prev => prev.slice(0, i + 1));
                    setCurrentFolderId(bc.id);
                  }}
                  style={{ ...chipStyle, background: currentFolderId === bc.id ? 'var(--accent)' : 'transparent', color: currentFolderId === bc.id ? '#fff' : 'var(--tx-2)' }}
                >
                  <Folder size={14} /> {bc.name}
                </button>
              </span>
            ))}
          </div>

          {/* Drag-and-drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: dragOver ? '2px dashed var(--accent)' : '2px dashed transparent',
              borderRadius: 12,
              background: dragOver ? 'rgba(99,102,241,0.05)' : 'transparent',
              transition: 'all 0.2s',
              minHeight: 200,
              position: 'relative',
            }}
          >
            {/* Upload overlay */}
            {dragOver && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.08)', borderRadius: 12, zIndex: 10,
              }}>
                <div style={{ textAlign: 'center', color: 'var(--accent)' }}>
                  <Upload size={40} />
                  <p style={{ fontSize: 16, fontWeight: 600, marginTop: 8 }}>Drop files to upload</p>
                </div>
              </div>
            )}

            {uploading && (
              <div style={{ padding: '12px 16px', background: 'var(--card)', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)' }}>
                <div className="spinner-ring" style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>Uploading…</span>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div className="spinner-ring" />
              </div>
            ) : isEmpty && !searchDebounced ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px', color: 'var(--tx-3)',
              }}>
                <HardDrive size={48} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>No files yet</p>
                <p style={{ fontSize: 13, marginBottom: 16 }}>Upload files or create folders to get started</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => setShowNewFolder(true)} style={btnSecondary}>
                    <FolderPlus size={16} /> New Folder
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}>
                    <Upload size={16} /> Upload Files
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Folders */}
                {folders.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx-3)', marginBottom: 8 }}>Folders</p>
                    <div style={view === 'grid'
                      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }
                      : { display: 'flex', flexDirection: 'column', gap: 2 }
                    }>
                      {folders.map(folder => (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          view={view}
                          onOpen={() => navigateToFolder(folder.id)}
                          onContext={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ type: 'folder', item: folder, x: e.clientX, y: e.clientY }); }}
                          onRename={() => { setRenameTarget({ type: 'folder', id: folder.id, currentName: folder.name }); setRenameValue(folder.name); }}
                          onDelete={() => deleteFolder(folder.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Files */}
                {files.length > 0 && (
                  <div>
                    {folders.length > 0 && (
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--tx-3)', marginBottom: 8 }}>Files</p>
                    )}
                    {view === 'grid' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {files.map(file => (
                          <FileCardGrid
                            key={file.id}
                            file={file}
                            onDownload={() => downloadFile(file)}
                            onContext={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ type: 'file', item: file, x: e.clientX, y: e.clientY }); }}
                            onToggleDeliverable={() => toggleDeliverable(file)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                              <th style={thStyle}>Name</th>
                              <th style={{ ...thStyle, width: 100 }}>Size</th>
                              <th style={{ ...thStyle, width: 120 }}>Type</th>
                              <th style={{ ...thStyle, width: 100 }}>Modified</th>
                              <th style={{ ...thStyle, width: 100 }}>Uploaded by</th>
                              <th style={{ ...thStyle, width: 60 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {files.map(file => (
                              <FileRowList
                                key={file.id}
                                file={file}
                                onDownload={() => downloadFile(file)}
                                onContext={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ type: 'file', item: file, x: e.clientX, y: e.clientY }); }}
                                onToggleDeliverable={() => toggleDeliverable(file)}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {files.length === 0 && folders.length === 0 && searchDebounced && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--tx-3)' }}>
                    <Search size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p style={{ fontSize: 14 }}>No results for "{searchDebounced}"</p>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════ */}

      {/* New Folder Modal */}
      {showNewFolder && (
        <Modal onClose={() => setShowNewFolder(false)}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--tx-1)' }}>New Folder</h3>
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            placeholder="Folder name"
            style={{ ...inputStyle, width: '100%', marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowNewFolder(false)} style={btnSecondary}>Cancel</button>
            <button onClick={createFolder} style={btnPrimary}>Create</button>
          </div>
        </Modal>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <Modal onClose={() => setRenameTarget(null)}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--tx-1)' }}>
            Rename {renameTarget.type}
          </h3>
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && renameItem()}
            placeholder="New name"
            style={{ ...inputStyle, width: '100%', marginBottom: 16 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setRenameTarget(null)} style={btnSecondary}>Cancel</button>
            <button onClick={renameItem} style={btnPrimary}>Rename</button>
          </div>
        </Modal>
      )}

      {/* KB Create/Edit Modal */}
      {showKbEditor && (
        <Modal onClose={() => setShowKbEditor(false)} wide>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>{editingDoc ? 'Edit Document' : 'New Document'}</h3>
            <button onClick={() => setShowKbEditor(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={fieldLabel}>Title *</label>
              <input style={{ ...inputStyle, width: '100%' }} placeholder="Document title..." value={kbForm.title} onChange={e => setKbForm(p => ({ ...p, title: e.target.value }))} autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={fieldLabel}>Folder</label>
                <select style={{ ...inputStyle, width: '100%' }} value={kbForm.folder} onChange={e => setKbForm(p => ({ ...p, folder: e.target.value }))}>
                  {KB_FOLDERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Access</label>
                <select style={{ ...inputStyle, width: '100%' }} value={kbForm.access} onChange={e => setKbForm(p => ({ ...p, access: e.target.value }))}>
                  <option value="internal">Internal</option>
                  <option value="shared">Shared (clients can see)</option>
                </select>
              </div>
            </div>
            <div>
              <label style={fieldLabel}>Body * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(HTML supported)</span></label>
              <textarea
                rows={12}
                placeholder="Write the document content here... HTML tags like <h3>, <p>, <ul>, <li>, <strong> are supported."
                value={kbForm.body}
                onChange={e => setKbForm(p => ({ ...p, body: e.target.value }))}
                style={{ ...inputStyle, width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 200 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button style={btnSecondary} onClick={() => setShowKbEditor(false)}>Cancel</button>
              <button style={btnPrimary} onClick={saveKbDoc} disabled={kbSaving}>{kbSaving ? 'Saving...' : editingDoc ? 'Save Changes' : 'Create Document'}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Version History Modal */}
      {showVersions && (
        <Modal onClose={() => setShowVersions(false)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}><History size={16} style={{ marginRight: 6, display: 'inline' }} />Version History</h3>
            <button onClick={() => setShowVersions(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)' }}><X size={18} /></button>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {versions.length === 0 ? (
              <p style={{ color: 'var(--tx-3)', fontSize: 13, textAlign: 'center', padding: 24 }}>No version history available</p>
            ) : versions.map(v => (
              <div key={v.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--tx-2)', flexShrink: 0 }}>v{v.version}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', display: 'block' }}>{v.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{v.edited_by_name || 'Unknown'} · {timeAgo(v.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000,
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 180, padding: '6px 0',
        }}>
          {contextMenu.type === 'folder' ? (
            <>
              <CtxItem icon={<Folder size={14} />} label="Open" onClick={() => { navigateToFolder(contextMenu.item.id); setContextMenu(null); }} />
              <CtxItem icon={<Pencil size={14} />} label="Rename" onClick={() => { setRenameTarget({ type: 'folder', id: contextMenu.item.id, currentName: contextMenu.item.name }); setRenameValue(contextMenu.item.name); setContextMenu(null); }} />
              <CtxDivider />
              <CtxItem icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { deleteFolder(contextMenu.item.id); setContextMenu(null); }} />
            </>
          ) : (
            <>
              <CtxItem icon={<Download size={14} />} label="Download" onClick={() => { downloadFile(contextMenu.item); setContextMenu(null); }} />
              <CtxItem icon={<Pencil size={14} />} label="Rename" onClick={() => { setRenameTarget({ type: 'file', id: contextMenu.item.id, currentName: contextMenu.item.label }); setRenameValue(contextMenu.item.label); setContextMenu(null); }} />
              <CtxItem
                icon={<Star size={14} />}
                label={contextMenu.item.is_deliverable ? 'Unmark deliverable' : 'Mark as deliverable'}
                onClick={() => { toggleDeliverable(contextMenu.item); setContextMenu(null); }}
              />
              <CtxDivider />
              <CtxItem icon={<Trash2 size={14} />} label="Delete" danger onClick={() => { deleteFile(contextMenu.item.id); setContextMenu(null); }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════

/* ── KB Doc Card (grid view) ── */
function KBDocCard({ doc, isStarred, onSelect, onStar, onEdit, onDelete }) {
  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
        padding: 16, cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
        borderLeft: `3px solid ${doc.access === 'shared' ? 'var(--blue)' : 'var(--purple)'}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderLeftColor = doc.access === 'shared' ? 'var(--blue)' : 'var(--purple)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderLeftColor = doc.access === 'shared' ? 'var(--blue)' : 'var(--purple)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <BookOpen size={18} style={{ color: 'var(--purple)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--card)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>
              {KB_FOLDER_MAP[doc.folder]?.label || doc.folder}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, ...ACCESS_STYLES[doc.access] }}>
              {doc.access === 'internal' ? <><Lock size={9} style={{ marginRight: 3, display: 'inline' }} />Internal</> : <><Globe size={9} style={{ marginRight: 3, display: 'inline' }} />Shared</>}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={11} /> {timeAgo(doc.updated_at)}
          {doc.version > 1 && <> · v{doc.version}</>}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={onStar} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: isStarred ? '#f59e0b' : 'var(--tx-3)' }} title="Star">
            <Star size={13} fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onEdit} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--tx-3)' }} title="Edit">
            <Edit2 size={12} />
          </button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--tx-3)' }} title="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── KB Doc Row (list view) ── */
function KBDocRow({ doc, isStarred, onSelect, onStar, onEdit, onDelete }) {
  return (
    <div
      onClick={onSelect}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .12s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <BookOpen size={16} style={{ color: 'var(--purple)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx-1)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
        <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--bg)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>{KB_FOLDER_MAP[doc.folder]?.label || doc.folder}</span>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{timeAgo(doc.updated_at)}</span>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{doc.created_by_name || 'Unknown'}</span>
          {doc.version > 1 && <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>v{doc.version}</span>}
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, ...ACCESS_STYLES[doc.access] }}>{doc.access === 'internal' ? <><Lock size={9} style={{ marginRight: 3, display: 'inline' }} />Internal</> : <><Globe size={9} style={{ marginRight: 3, display: 'inline' }} />Shared</>}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onStar} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: isStarred ? '#f59e0b' : 'var(--tx-3)' }} title="Star">
          <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
        </button>
        <button onClick={onEdit} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: 'var(--tx-3)' }} title="Edit">
          <Edit2 size={13} />
        </button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: 'var(--tx-3)' }} title="Delete">
          <Trash2 size={13} />
        </button>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
    </div>
  );
}

/* ── File components ── */
function FolderCard({ folder, view, onOpen, onContext, onRename, onDelete }) {
  if (view === 'list') {
    return (
      <div
        onClick={onOpen}
        onContextMenu={onContext}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Folder size={18} style={{ color: folder.color || 'var(--yellow)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, color: 'var(--tx-1)', fontWeight: 500, flex: 1 }}>{folder.name}</span>
        <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{timeAgo(folder.created_at)}</span>
        <button onClick={(e) => { e.stopPropagation(); onContext(e); }} style={iconBtn}>
          <MoreVertical size={14} />
        </button>
      </div>
    );
  }
  return (
    <div
      onClick={onOpen}
      onContextMenu={onContext}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 10,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
    >
      <Folder size={22} style={{ color: folder.color || 'var(--yellow)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {folder.name}
      </span>
      <button onClick={(e) => { e.stopPropagation(); onContext(e); }} style={iconBtn}>
        <MoreVertical size={14} />
      </button>
    </div>
  );
}

function FileCardGrid({ file, onDownload, onContext, onToggleDeliverable }) {
  return (
    <div
      onContextMenu={onContext}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '16px', transition: 'all 0.15s', position: 'relative',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
    >
      {file.is_deliverable && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <Star size={14} fill="var(--yellow)" style={{ color: 'var(--yellow)' }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, marginBottom: 10 }}>
        {fileIcon(file.content_type, 32)}
      </div>
      <p style={{
        fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: '0 0 4px',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={file.label}>
        {file.label}
      </p>
      <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>
        {humanSize(file.file_size)} · {timeAgo(file.updated_at || file.created_at)}
      </p>
      <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
        <button onClick={onDownload} style={{ ...iconBtn, flex: 1, justifyContent: 'center' }} title="Download">
          <Download size={14} />
        </button>
        <button onClick={onContext} style={iconBtn} title="More">
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  );
}

function FileRowList({ file, onDownload, onContext, onToggleDeliverable }) {
  return (
    <tr
      onContextMenu={onContext}
      style={{ borderBottom: '1px solid var(--border)', cursor: 'default' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <td style={{ ...tdStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        {fileIcon(file.content_type, 18)}
        <span style={{ fontWeight: 500 }}>{file.label}</span>
        {file.is_deliverable && <Star size={12} fill="var(--yellow)" style={{ color: 'var(--yellow)', flexShrink: 0 }} />}
      </td>
      <td style={tdStyle}>{humanSize(file.file_size)}</td>
      <td style={tdStyle}>
        <span style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-2)', borderRadius: 4 }}>
          {file.content_type?.split('/').pop()?.toUpperCase() || 'FILE'}
        </span>
      </td>
      <td style={tdStyle}>{timeAgo(file.updated_at || file.created_at)}</td>
      <td style={tdStyle}>{file.uploaded_by_name || '—'}</td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onDownload} style={iconBtn} title="Download"><Download size={14} /></button>
          <button onClick={onContext} style={iconBtn} title="More"><MoreVertical size={14} /></button>
        </div>
      </td>
    </tr>
  );
}

function Modal({ children, onClose, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '24px', minWidth: 360, maxWidth: wide ? 640 : 480, width: wide ? '90%' : undefined,
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function CtxItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 14px',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
        color: danger ? 'var(--red)' : 'var(--tx-1)', textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      {icon} {label}
    </button>
  );
}

function CtxDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
}

// ═══════════════════════════════════════
// STYLES
// ═══════════════════════════════════════
const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
};
const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
  background: 'var(--card)', color: 'var(--tx-1)', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const ghostBtn = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px',
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 12, fontWeight: 500, color: 'var(--tx-2)', cursor: 'pointer',
};
const chipStyle = {
  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
  borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
  background: 'none', border: 'none', whiteSpace: 'nowrap',
};
const inputStyle = {
  padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--tx-1)', fontSize: 13, outline: 'none',
};
const viewBtn = {
  padding: '6px 10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
};
const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
  background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6,
  color: 'var(--tx-3)', transition: 'all 0.15s',
};
const thStyle = {
  padding: '10px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)',
  textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left',
};
const tdStyle = {
  padding: '10px 12px', fontSize: 13, color: 'var(--tx-2)',
};
const sidebarLabel = {
  fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase',
  letterSpacing: '0.06em', display: 'block', marginBottom: 10,
};
const fieldLabel = {
  fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 6,
};

const kbSidebarBtn = (active) => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6,
  border: 'none', cursor: 'pointer',
  background: active ? 'var(--card)' : 'transparent',
  color: active ? 'var(--tx-1)' : 'var(--tx-2)',
  fontSize: 13, fontWeight: active ? 600 : 400,
  transition: 'all .12s', width: '100%', textAlign: 'left',
});

/**
 * Drive — unified Google Drive-style docs + files experience
 *
 * Left sidebar:
 *   + New (menu: New Document / New Folder / Upload)
 *   My Drive | Shared | Starred | Recent | Trash
 *
 * Top bar:
 *   breadcrumbs  ·  search  ·  view toggle  ·  sort
 *
 * Main:
 *   Folder grid + File/Doc grid in same card style
 *   Click folder → navigate in (breadcrumb updates)
 *   Click doc → opens DocEditor overlay
 *   Click file → download
 *   Right-click any item → context menu
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Folder, FolderPlus, Upload, FileText, Search, Grid3X3, List as ListIcon,
  Home, ChevronRight, ChevronDown, Star, Clock, Trash2,
  Download, MoreVertical, HardDrive, Users as UsersIcon,
  File as FileIcon, Image as ImageIcon, FileSpreadsheet, FileVideo, FileAudio,
  Loader2, X, Edit2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DocEditor from '../components/DocEditor';
import EmptyState from '../components/EmptyState';
import { SkeletonCardList } from '../components/Skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

// ── Helpers ──────────────────────────────────────────────────────
function fileIcon(contentType, size = 24) {
  if (!contentType) return <FileIcon size={size} style={{ color: 'var(--tx-2)' }} />;
  if (contentType.startsWith('image/')) return <ImageIcon size={size} style={{ color: '#a855f7' }} />;
  if (contentType.includes('spreadsheet') || contentType.includes('csv') || contentType.includes('excel'))
    return <FileSpreadsheet size={size} style={{ color: '#22c55e' }} />;
  if (contentType.startsWith('video/')) return <FileVideo size={size} style={{ color: 'var(--accent)' }} />;
  if (contentType.startsWith('audio/')) return <FileAudio size={size} style={{ color: '#f59e0b' }} />;
  if (contentType.includes('pdf')) return <FileText size={size} style={{ color: 'var(--accent)' }} />;
  return <FileIcon size={size} style={{ color: 'var(--tx-2)' }} />;
}

function humanSize(bytes) {
  if (!bytes) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, s = bytes;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return `${s.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function timeAgo(dt) {
  if (!dt) return '';
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Sidebar ──────────────────────────────────────────────────────
function SidebarButton({ icon: Icon, label, active, onClick, count, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
      background: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--tx-2)',
      border: 'none', fontSize: 13.5, fontWeight: active ? 600 : 500,
      transition: 'all 0.15s var(--apple-spring, ease)',
      textAlign: 'left',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} />
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>{count}</span>
      )}
      {children}
    </button>
  );
}

// ── Item Card (folder / file / doc) ──────────────────────────────
function ItemCard({ item, view, onOpen, onContext, onStar }) {
  const isFolder = item.kind === 'folder';
  const isDoc = item.kind === 'doc';
  const isStarred = item.starred_by_me || item.is_starred;

  const icon = isFolder
    ? <Folder size={32} style={{ color: '#f59e0b' }} />
    : isDoc
      ? <span style={{ fontSize: 28 }}>{item.icon || '📄'}</span>
      : fileIcon(item.content_type, 32);

  const name = item.name || item.title || item.label || item.original_filename || 'Untitled';
  const subtitle = isFolder
    ? `${item.item_count || 0} items`
    : isDoc
      ? (item.updated_at ? timeAgo(item.updated_at) : 'New')
      : `${humanSize(item.file_size)} · ${timeAgo(item.updated_at || item.created_at)}`;

  if (view === 'list') {
    return (
      <div
        onClick={onOpen}
        onContextMenu={e => { e.preventDefault(); onContext(e); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{subtitle}</div>
        </div>
        {isStarred && <Star size={14} fill="#f59e0b" style={{ color: '#f59e0b', flexShrink: 0 }} />}
        <button onClick={e => { e.stopPropagation(); onContext(e); }} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)',
          padding: 6, borderRadius: 6, display: 'flex', flexShrink: 0,
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <MoreVertical size={14} />
        </button>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={onOpen}
      onContextMenu={e => { e.preventDefault(); onContext(e); }}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 16, cursor: 'pointer',
        transition: 'all 0.2s var(--apple-spring, ease)',
        display: 'flex', flexDirection: 'column', gap: 10,
        position: 'relative', minHeight: 140,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-hi)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.12)';
        const moreBtn = e.currentTarget.querySelector('[data-more]');
        if (moreBtn) moreBtn.style.opacity = 1;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.1)';
        const moreBtn = e.currentTarget.querySelector('[data-more]');
        if (moreBtn) moreBtn.style.opacity = 0;
      }}
    >
      {/* Top: icon + star + more */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {isStarred && <Star size={14} fill="#f59e0b" style={{ color: '#f59e0b' }} />}
          <button data-more onClick={e => { e.stopPropagation(); onContext(e); }} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)',
            padding: 4, borderRadius: 6, display: 'flex', opacity: 0, transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <MoreVertical size={14} />
          </button>
        </div>
      </div>

      {/* Name + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div title={name} style={{
          fontSize: 13.5, fontWeight: 600, color: 'var(--tx-1)', lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', marginBottom: 4,
        }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{subtitle}</div>
      </div>
    </div>
  );
}

// ── Context Menu ─────────────────────────────────────────────────
function ContextMenu({ menu, onClose, onAction }) {
  if (!menu) return null;
  const { item, x, y } = menu;
  const isFolder = item.kind === 'folder';
  const isDoc = item.kind === 'doc';
  const isFile = item.kind === 'file';

  const actions = [
    { id: 'open', label: isFolder ? 'Open' : isDoc ? 'Edit' : 'Download', icon: isFile ? Download : Edit2 },
    ...(isFile ? [{ id: 'download', label: 'Download', icon: Download }] : []),
    { id: 'rename', label: 'Rename', icon: Edit2 },
    { id: 'star', label: item.starred_by_me || item.is_starred ? 'Unstar' : 'Star', icon: Star },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div style={{
        position: 'fixed', top: y, left: x, zIndex: 901,
        background: 'var(--surface)', border: '1px solid var(--border-hi)',
        borderRadius: 10, padding: 4, minWidth: 180,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.1s ease',
      }}>
        {actions.map(a => (
          <button key={a.id} onClick={() => { onAction(a.id, item); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 12px', borderRadius: 7, cursor: 'pointer',
              background: 'none', border: 'none', textAlign: 'left',
              fontSize: 13, color: a.danger ? 'var(--color-red)' : 'var(--tx-1)',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = a.danger ? 'var(--color-red-soft)' : 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <a.icon size={14} />
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── New Menu ─────────────────────────────────────────────────────
function NewMenu({ open, onClose, onNewDoc, onNewFolder, onUpload }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div style={{
        position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 901,
        background: 'var(--surface)', border: '1px solid var(--border-hi)',
        borderRadius: 12, padding: 6, minWidth: 200,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.15s ease',
      }}>
        {[
          { icon: FileText, label: 'New Document', onClick: onNewDoc, desc: 'Rich text doc' },
          { icon: FolderPlus, label: 'New Folder', onClick: onNewFolder, desc: 'Organize files' },
          { icon: Upload, label: 'Upload File', onClick: onUpload, desc: 'From your computer' },
        ].map((i, idx) => (
          <button key={idx} onClick={() => { i.onClick(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'none', border: 'none', textAlign: 'left',
              color: 'var(--tx-1)', transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <i.icon size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{i.label}</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{i.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function Drive() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin' || user?.role === 'Operator';
  const [section, setSection] = useState('my-drive'); // my-drive | shared | starred | recent | trash
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]); // [{id, name}]
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('drive_view') || 'grid');
  const [sortBy, setSortBy] = useState('modified'); // modified | name | size

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [openingDoc, setOpeningDoc] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null); // {kind, id, name}
  const [renameValue, setRenameValue] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('drive_view', view); }, [view]);

  // ── Load data ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (section === 'starred') {
        const r = await ax().get(`${API}/documents`, { params: { starred: true } });
        setDocs((r.data || []).map(d => ({ ...d, kind: 'doc' })));
        setFolders([]); setFiles([]);
      } else if (section === 'recent') {
        const [dRes, fRes] = await Promise.allSettled([
          ax().get(`${API}/documents`, { params: { limit: 20 } }),
          ax().get(`${API}/files`, { params: { limit: 20 } }),
        ]);
        setDocs(dRes.status === 'fulfilled' ? (dRes.value.data || []).map(d => ({ ...d, kind: 'doc' })) : []);
        setFiles(fRes.status === 'fulfilled' ? (fRes.value.data || []).map(f => ({ ...f, kind: 'file' })) : []);
        setFolders([]);
      } else if (section === 'trash') {
        // Trash: not yet implemented on backend — show empty for now
        setDocs([]); setFiles([]); setFolders([]);
      } else if (section === 'shared') {
        const r = await ax().get(`${API}/documents`, { params: { access: 'shared' } });
        setDocs((r.data || []).map(d => ({ ...d, kind: 'doc' })));
        setFolders([]); setFiles([]);
      } else {
        // my-drive
        const folderParam = currentFolderId ? { folder_id: currentFolderId } : {};
        const [fdrRes, fRes, dRes] = await Promise.allSettled([
          ax().get(`${API}/files/folders`, { params: folderParam }),
          ax().get(`${API}/files`, { params: folderParam }),
          // docs are only shown at root for now
          currentFolderId ? null : ax().get(`${API}/documents`),
        ].filter(Boolean));
        setFolders(fdrRes.status === 'fulfilled' ? (fdrRes.value.data || []).map(f => ({ ...f, kind: 'folder' })) : []);
        setFiles(fRes.status === 'fulfilled' ? (fRes.value.data || []).map(f => ({ ...f, kind: 'file' })) : []);
        setDocs(!currentFolderId && dRes && dRes.status === 'fulfilled'
          ? (dRes.value.data || []).map(d => ({ ...d, kind: 'doc' })) : []);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Drive fetchData error', err);
    } finally { setLoading(false); }
  }, [section, currentFolderId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived: combined + sorted + searched ────────────────────
  const items = useMemo(() => {
    const all = [...folders, ...docs, ...files];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter(i => {
          const name = (i.name || i.title || i.label || i.original_filename || '').toLowerCase();
          return name.includes(q);
        })
      : all;

    const sorted = [...filtered].sort((a, b) => {
      // folders always first
      if (a.kind === 'folder' && b.kind !== 'folder') return -1;
      if (b.kind === 'folder' && a.kind !== 'folder') return 1;

      if (sortBy === 'name') {
        const na = (a.name || a.title || a.label || '').toLowerCase();
        const nb = (b.name || b.title || b.label || '').toLowerCase();
        return na.localeCompare(nb);
      }
      if (sortBy === 'size') {
        return (b.file_size || 0) - (a.file_size || 0);
      }
      // modified (default)
      const da = new Date(a.updated_at || a.created_at || 0).getTime();
      const db = new Date(b.updated_at || b.created_at || 0).getTime();
      return db - da;
    });

    return sorted;
  }, [folders, docs, files, search, sortBy]);

  const folderItems = items.filter(i => i.kind === 'folder');
  const fileItems = items.filter(i => i.kind !== 'folder');

  // ── Actions ──────────────────────────────────────────────────
  const openItem = async (item) => {
    if (item.kind === 'folder') {
      setCurrentFolderId(item.id);
      setBreadcrumbs(prev => [...prev, { id: item.id, name: item.name }]);
    } else if (item.kind === 'doc') {
      setOpeningDoc(item.id);
    } else {
      // file — download
      downloadFile(item);
    }
  };

  const downloadFile = async (file) => {
    try {
      const { data } = await ax().get(`${API}/files/${file.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename || file.label || 'file';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const navigateToBreadcrumb = (index) => {
    if (index === -1) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    } else {
      const crumb = breadcrumbs[index];
      setCurrentFolderId(crumb.id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

  const createDoc = async () => {
    try {
      const r = await ax().post(`${API}/documents`, { title: 'Untitled' });
      setOpeningDoc(r.data.id);
      fetchData();
    } catch { toast.error('Failed to create document'); }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await ax().post(`${API}/files/folders`, {
        name: newFolderName.trim(),
        parent_folder_id: currentFolderId,
      });
      setShowNewFolder(false);
      setNewFolderName('');
      fetchData();
      toast.success('Folder created');
    } catch { toast.error('Failed to create folder'); }
  };

  const handleUpload = async (fileList) => {
    if (!fileList?.length) return;
    for (const f of fileList) {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('context_type', 'standalone');
      if (currentFolderId) fd.append('folder_id', currentFolderId);
      try {
        await ax().post(`${API}/files/upload`, fd);
      } catch (err) {
        toast.error(err.response?.data?.detail || `Failed to upload ${f.name}`);
      }
    }
    toast.success(`Uploaded ${fileList.length} file${fileList.length > 1 ? 's' : ''}`);
    fetchData();
  };

  const handleContextAction = async (action, item) => {
    if (action === 'open') return openItem(item);
    if (action === 'download' && item.kind === 'file') return downloadFile(item);
    if (action === 'rename') {
      setRenameTarget({ kind: item.kind, id: item.id });
      setRenameValue(item.name || item.title || item.label || '');
      return;
    }
    if (action === 'star' && item.kind === 'doc') {
      try {
        await ax().post(`${API}/documents/${item.id}/star`);
        fetchData();
      } catch { /* ignore */ }
      return;
    }
    if (action === 'delete') {
      if (!window.confirm(`Delete "${item.name || item.title || item.label}"?`)) return;
      try {
        if (item.kind === 'folder') await ax().delete(`${API}/files/folders/${item.id}`);
        else if (item.kind === 'file') await ax().delete(`${API}/files/${item.id}`);
        else if (item.kind === 'doc') await ax().delete(`${API}/documents/${item.id}`);
        toast.success('Deleted');
        fetchData();
      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete'); }
    }
  };

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) { setRenameTarget(null); return; }
    const { kind, id } = renameTarget;
    const newName = renameValue.trim();
    try {
      if (kind === 'folder') await ax().patch(`${API}/files/folders/${id}`, { name: newName });
      else if (kind === 'doc') await ax().patch(`${API}/documents/${id}`, { title: newName });
      else if (kind === 'file') await ax().patch(`${API}/files/${id}`, { label: newName });
      setRenameTarget(null);
      setRenameValue('');
      fetchData();
    } catch { toast.error('Rename failed'); }
  };

  const sectionTitle = {
    'my-drive': breadcrumbs.length === 0 ? 'My Drive' : breadcrumbs[breadcrumbs.length - 1].name,
    'shared': 'Shared with me',
    'starred': 'Starred',
    'recent': 'Recent',
    'trash': 'Trash',
  }[section];

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 240, minWidth: 240, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 16,
      }}>
        {/* + New button */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setNewMenuOpen(true)} className="btn-primary" style={{
            width: '100%', justifyContent: 'center', gap: 6, padding: '10px 14px',
          }}>
            <Plus size={16} /> New
            <ChevronDown size={13} style={{ marginLeft: 'auto' }} />
          </button>
          <NewMenu
            open={newMenuOpen}
            onClose={() => setNewMenuOpen(false)}
            onNewDoc={createDoc}
            onNewFolder={() => setShowNewFolder(true)}
            onUpload={() => fileInputRef.current?.click()}
          />
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SidebarButton icon={HardDrive} label="My Drive" active={section === 'my-drive'}
            onClick={() => { setSection('my-drive'); setCurrentFolderId(null); setBreadcrumbs([]); }} />
          <SidebarButton icon={UsersIcon} label="Shared" active={section === 'shared'}
            onClick={() => setSection('shared')} />
          <SidebarButton icon={Star} label="Starred" active={section === 'starred'}
            onClick={() => setSection('starred')} />
          <SidebarButton icon={Clock} label="Recent" active={section === 'recent'}
            onClick={() => setSection('recent')} />
          <SidebarButton icon={Trash2} label="Trash" active={section === 'trash'}
            onClick={() => setSection('trash')} />
        </div>

        {/* NAS link (admin/operator only) */}
        {isAdmin && (
          <a
            href="https://ops.redribbongroup.ca/login?redirect_url=/apps/dashboard/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 'auto', marginBottom: 10, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
              border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--surface-2)', color: 'var(--tx-1)',
              textDecoration: 'none', fontSize: 13, fontWeight: 500,
            }}
            title="Open Nextcloud NAS for large video files"
          >
            <HardDrive size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ flex: 1 }}>Open NAS</span>
            <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>↗</span>
          </a>
        )}

        {/* Storage (placeholder — could wire to real quota later) */}
        <div style={{ marginTop: isAdmin ? 0 : 'auto', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Storage</div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: '14%', background: 'var(--accent)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>1.4 GB of 10 GB used</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0,
          background: 'var(--surface)',
        }}>
          {/* Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: 'var(--tx-1)' }}>
            {section === 'my-drive' && breadcrumbs.length > 0 ? (
              <>
                <button onClick={() => navigateToBreadcrumb(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)', display: 'flex', padding: 0 }}>
                  <Home size={15} />
                </button>
                {breadcrumbs.map((c, i) => (
                  <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ChevronRight size={13} style={{ color: 'var(--tx-3)' }} />
                    <button onClick={() => navigateToBreadcrumb(i)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: i === breadcrumbs.length - 1 ? 'var(--tx-1)' : 'var(--tx-2)',
                      fontSize: 15, fontWeight: 600, padding: 0,
                    }}>{c.name}</button>
                  </span>
                ))}
              </>
            ) : (
              <span>{sectionTitle}</span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search in Drive…"
              style={{
                padding: '8px 10px 8px 32px', fontSize: 13,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--tx-1)', outline: 'none', width: 220,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, display: 'flex',
              }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            padding: '8px 10px', fontSize: 13,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--tx-1)', outline: 'none', cursor: 'pointer',
          }}>
            <option value="modified">Sort: Modified</option>
            <option value="name">Sort: Name</option>
            <option value="size">Sort: Size</option>
          </select>

          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('grid')} style={{
              padding: '8px 10px', background: view === 'grid' ? 'var(--accent-soft)' : 'none',
              border: 'none', cursor: 'pointer', color: view === 'grid' ? 'var(--accent)' : 'var(--tx-3)', display: 'flex',
            }} title="Grid view"><Grid3X3 size={14} /></button>
            <button onClick={() => setView('list')} style={{
              padding: '8px 10px', background: view === 'list' ? 'var(--accent-soft)' : 'none',
              border: 'none', cursor: 'pointer', color: view === 'list' ? 'var(--accent)' : 'var(--tx-3)', display: 'flex',
            }} title="List view"><ListIcon size={14} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <SkeletonCardList count={4} />
          ) : items.length === 0 ? (
            section === 'trash' ? (
              <EmptyState icon="files" title="Trash is empty" description="Deleted items will appear here." />
            ) : section === 'starred' ? (
              <EmptyState icon="files" title="Nothing starred yet" description="Star items to quickly find them later." />
            ) : section === 'recent' ? (
              <EmptyState icon="inbox" title="No recent items" description="Recently modified files and docs will appear here." />
            ) : section === 'shared' ? (
              <EmptyState icon="files" title="Nothing shared with you" description="Shared docs will appear here." />
            ) : (
              <EmptyState icon="files" title="This folder is empty"
                description="Click + New above to create a document, folder, or upload a file."
                action={{ label: 'New Document', onClick: createDoc }} />
            )
          ) : (
            <>
              {/* Folders */}
              {folderItems.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                    Folders
                  </div>
                  <div style={view === 'grid'
                    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }
                    : { display: 'flex', flexDirection: 'column', gap: 2 }
                  }>
                    {folderItems.map(item => (
                      <ItemCard key={`fdr-${item.id}`} item={item} view={view}
                        onOpen={() => openItem(item)}
                        onContext={e => setContextMenu({ item, x: e.clientX, y: e.clientY })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files + Docs */}
              {fileItems.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                    Files & Documents
                  </div>
                  <div style={view === 'grid'
                    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }
                    : { display: 'flex', flexDirection: 'column', gap: 2 }
                  }>
                    {fileItems.map(item => (
                      <ItemCard key={`${item.kind}-${item.id}`} item={item} view={view}
                        onOpen={() => openItem(item)}
                        onContext={e => setContextMenu({ item, x: e.clientX, y: e.clientY })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden file input for upload */}
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => { handleUpload(Array.from(e.target.files)); e.target.value = ''; }} />
      </main>

      {/* ── Context menu ── */}
      <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onAction={handleContextAction} />

      {/* ── Doc editor overlay ── */}
      {openingDoc && (
        <DocEditor docId={openingDoc} onClose={() => { setOpeningDoc(null); fetchData(); }}
          onChange={fetchData} />
      )}

      {/* ── New folder modal ── */}
      {showNewFolder && (
        <div onClick={() => setShowNewFolder(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} className="modal-box" style={{ width: 400, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>New Folder</h3>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              placeholder="Folder name" className="input-field" style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewFolder(false)} className="btn-ghost">Cancel</button>
              <button onClick={createFolder} className="btn-primary" disabled={!newFolderName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename modal ── */}
      {renameTarget && (
        <div onClick={() => setRenameTarget(null)} style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} className="modal-box" style={{ width: 400, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Rename</h3>
            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitRename()}
              className="input-field" style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameTarget(null)} className="btn-ghost">Cancel</button>
              <button onClick={submitRename} className="btn-primary" disabled={!renameValue.trim()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {loading && docs.length === 0 && files.length === 0 && folders.length === 0 && (
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--tx-3)' }}>
          <Loader2 size={12} className="spin" /> Loading…
        </div>
      )}
    </div>
  );
}

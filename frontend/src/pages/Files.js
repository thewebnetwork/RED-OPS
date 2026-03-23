/**
 * Files — Universal File Management
 *
 * Google-Drive-style file browser with:
 *   • Folder hierarchy (create, nest, rename, delete)
 *   • File upload with drag-and-drop zone
 *   • Context filtering (all / order / project / standalone)
 *   • Deliverable tagging
 *   • Search, grid/list view toggle
 *   • Breadcrumb navigation
 *   • Bulk select (future)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Folder, FolderPlus, Upload, FileText, Image, FileSpreadsheet, FileVideo,
  FileAudio, File as FileIcon, Download, MoreVertical, Trash2, Pencil,
  Star, Grid3X3, List, Search, ChevronRight, Home, X, Plus, ArrowLeft,
  Tag, Filter, HardDrive, Clock, Eye, Check
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

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

// ── Context label helper ──
function contextLabel(type, id) {
  if (!type || type === 'standalone') return 'Standalone';
  return `${type.charAt(0).toUpperCase() + type.slice(1)} ${id ? `#${id.slice(0, 6)}` : ''}`;
}

export default function Files() {
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [view, setView] = useState(() => localStorage.getItem('files_view') || 'grid');
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Navigation
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [contextFilter, setContextFilter] = useState(searchParams.get('context') || 'all');

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
  const [contextMenu, setContextMenu] = useState(null); // { type, item, x, y }
  const [renameTarget, setRenameTarget] = useState(null); // { type, id, currentName }
  const [renameValue, setRenameValue] = useState('');

  // Deliverable filter
  const [deliverableOnly, setDeliverableOnly] = useState(false);

  // ── Load data ──
  const loadFolders = useCallback(async () => {
    try {
      const params = { parent_folder_id: currentFolderId || undefined };
      if (contextFilter !== 'all') params.context_type = contextFilter;
      const { data } = await ax().get(`${API}/files/folders`, { params });
      setFolders(data);
    } catch { setFolders([]); }
  }, [currentFolderId, contextFilter]);

  const loadFiles = useCallback(async () => {
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
  }, [currentFolderId, contextFilter, deliverableOnly, searchDebounced]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await ax().get(`${API}/files/stats/summary`);
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadFolders(), loadFiles(), loadStats()]).finally(() => setLoading(false));
  }, [loadFolders, loadFiles, loadStats]);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // View persistence
  useEffect(() => { localStorage.setItem('files_view', view); }, [view]);

  // ── Breadcrumb builder ──
  const navigateToFolder = useCallback(async (folderId) => {
    if (!folderId) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
      return;
    }
    // Build breadcrumb chain by walking up
    try {
      const chain = [];
      let fid = folderId;
      while (fid) {
        const params = {};
        const { data: allFolders } = await ax().get(`${API}/files/folders`, { params: { parent_folder_id: undefined } });
        // Just get the target folder info from the list — simpler approach
        // We'll use a flat approach: fetch all folders and walk up
        break;
      }
      // Simplified: just set the folder name
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

  // ── Actions ──
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
      alert('Failed to create folder');
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
    } catch (e) {
      alert('Upload failed');
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
    } catch { alert('Download failed'); }
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await ax().delete(`${API}/files/${fileId}`);
      loadFiles();
      loadStats();
    } catch { alert('Delete failed'); }
  };

  const deleteFolder = async (folderId) => {
    if (!window.confirm('Delete this folder? Files will be moved to parent.')) return;
    try {
      await ax().delete(`${API}/files/folders/${folderId}`);
      loadFolders();
      loadFiles();
    } catch { alert('Delete failed'); }
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
    } catch { alert('Rename failed'); }
  };

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

  // ── Render ──
  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Files</h1>
          {stats && (
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>
              {stats.total_files} files · {stats.total_folders} folders · {humanSize(stats.total_size_bytes)}
              {stats.deliverables > 0 && ` · ${stats.deliverables} deliverables`}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 200 }}>
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

        {/* Context filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'order', 'project', 'standalone'].map(ctx => (
            <button
              key={ctx}
              onClick={() => { setContextFilter(ctx); setCurrentFolderId(null); setBreadcrumbs([]); }}
              style={{
                ...chipStyle,
                background: contextFilter === ctx ? 'var(--accent)' : 'var(--card)',
                color: contextFilter === ctx ? '#fff' : 'var(--tx-2)',
                border: `1px solid ${contextFilter === ctx ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {ctx === 'all' ? 'All' : ctx.charAt(0).toUpperCase() + ctx.slice(1)}
            </button>
          ))}
        </div>

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

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files…"
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
          /* Empty state */
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

// ── Sub-components ──

function FolderCard({ folder, view, onOpen, onContext, onRename, onDelete }) {
  if (view === 'list') {
    return (
      <div
        onClick={onOpen}
        onContextMenu={onContext}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          cursor: 'pointer', borderRadius: 8,
          transition: 'background 0.15s',
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

function Modal({ children, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '24px', minWidth: 360, maxWidth: 480, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
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

// ── Styles ──
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

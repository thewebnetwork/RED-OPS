import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { SkeletonCardList } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { toast } from 'sonner';
import axios from 'axios';
import {
  BookOpen, Plus, Search, ChevronRight, FileText, Edit2, Clock,
  Globe, Folder, Star, ArrowLeft, Trash2, X, Lock, History, Loader,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ── Folder config ────────────────────────────────────────────────────────────
const FOLDERS = [
  { key: 'playbook',  label: 'Playbook',  icon: BookOpen },
  { key: 'template',  label: 'Template',  icon: FileText },
  { key: 'reference', label: 'Reference', icon: Folder },
  { key: 'training',  label: 'Training',  icon: Globe },
  { key: 'general',   label: 'General',   icon: Folder },
];

const FOLDER_MAP = Object.fromEntries(FOLDERS.map(f => [f.key, f]));

const ACCESS_STYLES = {
  internal: { background: '#a855f718', color: '#a855f7' },
  shared:   { background: '#3b82f618', color: '#3b82f6' },
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Component ────────────────────────────────────────────────────────────────
export default function SOPs() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', folder: 'playbook', access: 'internal', body: '' });
  const [folderStats, setFolderStats] = useState({});
  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const userId = (() => { try { return JSON.parse(atob(token.split('.')[1])).sub; } catch { return null; } })();

  // ── Data fetching ──
  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeFolder) params.folder = activeFolder;
      if (searchQuery) params.search = searchQuery;
      const { data } = await axios.get(`${API}/knowledge-base/documents`, { headers, params });
      setDocs(data);
    } catch (err) {
      console.error('Failed to load documents', err);
      if (err.response?.status !== 401) toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [activeFolder, searchQuery]);

  const fetchFolderStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/knowledge-base/folders/stats`, { headers });
      setFolderStats(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { fetchFolderStats(); }, [fetchFolderStats]);

  const filtered = useMemo(() => docs, [docs]); // Already filtered server-side

  const starred = useMemo(() => docs.filter(d => (d.starred_by || []).includes(userId)), [docs, userId]);

  const folderCount = (key) => folderStats?.folders?.[key] || 0;

  // ── Handlers ──
  const openCreate = () => {
    setEditingDoc(null);
    setForm({ title: '', folder: 'playbook', access: 'internal', body: '' });
    setShowEditor(true);
  };

  const openEdit = (doc, e) => {
    e?.stopPropagation();
    setEditingDoc(doc);
    setForm({ title: doc.title, folder: doc.folder, access: doc.access, body: doc.body || '' });
    setShowEditor(true);
    setSelectedDoc(null);
  };

  const saveDoc = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.body.trim()) { toast.error('Body cannot be empty'); return; }
    setSaving(true);
    try {
      if (editingDoc) {
        await axios.patch(`${API}/knowledge-base/documents/${editingDoc.id}`, form, { headers });
        toast.success('Document updated');
      } else {
        await axios.post(`${API}/knowledge-base/documents`, form, { headers });
        toast.success('Document created');
      }
      setShowEditor(false);
      fetchDocs();
      fetchFolderStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteDoc = (doc, e) => {
    e?.stopPropagation();
    toast(`Delete "${doc.title}"?`, {
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await axios.delete(`${API}/knowledge-base/documents/${doc.id}`, { headers });
            if (selectedDoc?.id === doc.id) setSelectedDoc(null);
            toast.success('Document deleted');
            fetchDocs();
            fetchFolderStats();
          } catch (err) {
            toast.error(err.response?.data?.detail || 'Failed to delete');
          }
        },
      },
      cancel: { label: 'Cancel' },
    });
  };

  const toggleStar = async (doc, e) => {
    e?.stopPropagation();
    try {
      const { data } = await axios.post(`${API}/knowledge-base/documents/${doc.id}/star`, {}, { headers });
      // Update local state
      setDocs(prev => prev.map(d => {
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
      fetchFolderStats();
    } catch { /* silent */ }
  };

  const loadVersions = async (docId) => {
    try {
      const { data } = await axios.get(`${API}/knowledge-base/documents/${docId}/versions`, { headers });
      setVersions(data);
      setShowVersions(true);
    } catch {
      toast.error('Failed to load version history');
    }
  };

  const selectDoc = async (doc) => {
    try {
      const { data } = await axios.get(`${API}/knowledge-base/documents/${doc.id}`, { headers });
      setSelectedDoc(data);
    } catch {
      setSelectedDoc(doc);
    }
  };

  const isStarred = (doc) => (doc.starred_by || []).includes(userId);

  // ── Render ──
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Left Sidebar ── */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 20, overflowY: 'auto', flexShrink: 0, background: 'var(--bg-card)' }}>
        <button className="btn-primary btn-sm" style={{ width: '100%' }} onClick={openCreate}>
          <Plus size={14} /> New Document
        </button>

        {/* Folders */}
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Folders</span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* All */}
            <button
              onClick={() => setActiveFolder(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: !activeFolder ? 'var(--bg-elevated)' : 'transparent', color: !activeFolder ? 'var(--tx-1)' : 'var(--tx-2)', fontSize: 13, fontWeight: !activeFolder ? 600 : 400, transition: 'all .12s', width: '100%', textAlign: 'left' }}>
              <Folder size={14} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>All Documents</span>
              <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{folderStats?.total || 0}</span>
            </button>

            {FOLDERS.map(({ key, label, icon: Icon }) => {
              const active = activeFolder === key;
              return (
                <button key={key}
                  onClick={() => setActiveFolder(active ? null : key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? 'var(--bg-elevated)' : 'transparent', color: active ? 'var(--tx-1)' : 'var(--tx-2)', fontSize: 13, fontWeight: active ? 600 : 400, transition: 'all .12s', width: '100%', textAlign: 'left' }}>
                  <Icon size={14} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)', flexShrink: 0 }}>{folderCount(key)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Starred */}
        {starred.length > 0 && (
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Starred</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {starred.slice(0, 5).map(doc => (
                <button key={doc.id} onClick={() => selectDoc(doc)}
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

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedDoc ? (
          <>
            {/* Search bar */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
                <input className="input-field" placeholder="Search documents..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 30, height: 32, fontSize: 12 }} />
              </div>
              <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{filtered.length} doc{filtered.length !== 1 ? 's' : ''}{activeFolder ? ` in ${FOLDER_MAP[activeFolder]?.label || activeFolder}` : ''}</span>
            </div>

            {/* Doc list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '20px 24px' }}>
                  <SkeletonCardList count={5} />
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState icon="files" title="No documents found" description="Create SOPs, playbooks, and training docs." action={{ label: 'New Document', onClick: openCreate }} />
              ) : (
                filtered.map(doc => (
                  <div key={doc.id}
                    onClick={() => selectDoc(doc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <FileText size={16} style={{ color: 'var(--tx-2)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx-1)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>{FOLDER_MAP[doc.folder]?.label || doc.folder}</span>
                        <span style={{ fontSize: 11, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{fmtDate(doc.updated_at)}</span>
                        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{doc.created_by_name || 'Unknown'}</span>
                        {doc.version > 1 && <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>v{doc.version}</span>}
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, ...ACCESS_STYLES[doc.access] }}>{doc.access === 'internal' ? <><Lock size={9} style={{ marginRight: 3, display: 'inline' }} />Internal</> : <><Globe size={9} style={{ marginRight: 3, display: 'inline' }} />Shared</>}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={e => toggleStar(doc, e)} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: isStarred(doc) ? '#f59e0b' : 'var(--tx-3)' }} title="Star">
                        <Star size={14} fill={isStarred(doc) ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={e => openEdit(doc, e)} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: 'var(--tx-3)' }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={e => deleteDoc(doc, e)} style={{ background: 'none', border: 'none', padding: 5, cursor: 'pointer', color: 'var(--tx-3)' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          // ── Doc Viewer ──
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => { setSelectedDoc(null); setShowVersions(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--tx-2)' }}><ArrowLeft size={18} /></button>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedDoc.title}</h2>
              <button onClick={e => toggleStar(selectedDoc, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isStarred(selectedDoc) ? '#f59e0b' : 'var(--tx-3)', padding: 4 }}>
                <Star size={16} fill={isStarred(selectedDoc) ? 'currentColor' : 'none'} />
              </button>
              <button className="btn-ghost btn-sm" onClick={() => loadVersions(selectedDoc.id)}><History size={13} /> History</button>
              <button className="btn-ghost btn-sm" onClick={e => openEdit(selectedDoc, e)}><Edit2 size={13} /> Edit</button>
              <button className="btn-ghost btn-sm" onClick={e => deleteDoc(selectedDoc, e)} style={{ color: '#ef4444' }}><Trash2 size={13} /> Delete</button>
            </div>

            {/* Meta */}
            <div style={{ padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                ['Author', selectedDoc.created_by_name || 'Unknown'],
                ['Updated', fmtDate(selectedDoc.updated_at)],
                ['Folder', FOLDER_MAP[selectedDoc.folder]?.label || selectedDoc.folder],
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

      {/* ── Create / Edit Modal ── */}
      {showEditor && (
        <div className="modal-overlay" onClick={() => setShowEditor(false)}>
          <div className="modal-box" style={{ width: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingDoc ? 'Edit Document' : 'New Document'}</h3>
              <button onClick={() => setShowEditor(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Title *</label>
                <input className="input-field" placeholder="Document title..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Folder</label>
                  <select className="input-field" value={form.folder} onChange={e => setForm(p => ({ ...p, folder: e.target.value }))}>
                    {FOLDERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Access</label>
                  <select className="input-field" value={form.access} onChange={e => setForm(p => ({ ...p, access: e.target.value }))}>
                    <option value="internal">Internal</option>
                    <option value="shared">Shared (clients can see)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Body * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(HTML supported)</span></label>
                <textarea
                  className="input-field"
                  rows={12}
                  placeholder="Write the document content here... HTML tags like <h3>, <p>, <ul>, <li>, <strong> are supported."
                  value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button className="btn-ghost" onClick={() => setShowEditor(false)}>Cancel</button>
                <button className="btn-primary" onClick={saveDoc} disabled={saving}>{saving ? 'Saving...' : editingDoc ? 'Save Changes' : 'Create Document'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Version History Modal ── */}
      {showVersions && (
        <div className="modal-overlay" onClick={() => setShowVersions(false)}>
          <div className="modal-box" style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}><History size={16} style={{ marginRight: 6, display: 'inline' }} />Version History</h3>
              <button onClick={() => setShowVersions(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {versions.length === 0 ? (
                <p style={{ color: 'var(--tx-3)', fontSize: 13, textAlign: 'center', padding: 24 }}>No version history available</p>
              ) : versions.map(v => (
                <div key={v.id} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--tx-2)', flexShrink: 0 }}>v{v.version}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', display: 'block' }}>{v.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{v.edited_by_name || 'Unknown'} · {fmtDate(v.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Conversations — In-platform messaging
 *
 * Three thread types: channels, DMs, request threads
 * Two-column layout: thread list sidebar | message view
 * Polls for new messages every 10 seconds
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageSquare, Plus, X, Send, Hash, FileText, Search,
  Loader2, Pencil, Trash2, Check, Paperclip, Download, Image as ImageIcon,
} from 'lucide-react';
import MentionHashtagInput from '../components/MentionHashtagInput';
import EmptyState from '../components/EmptyState';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
const AVATAR_COLORS = ['#c92a3e','#7c3aed','#2563eb','#059669','#d97706','#0891b2','#db2777'];
const avatarBg = (id) => AVATAR_COLORS[(typeof id === 'string' ? id.charCodeAt(0) + (id.charCodeAt(1) || 0) : 0) % AVATAR_COLORS.length];

function timeAgo(dt) {
  if (!dt) return '';
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/* ── New Thread Modal ── */
function NewThreadModal({ type, onClose, onCreate, users }) {
  const [name, setName] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [search, setSearch] = useState('');

  const toggleMember = (id) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (type === 'channel') {
      if (!name.trim()) { toast.error('Channel name required'); return; }
      onCreate({ type: 'channel', name: `#${name.trim().toLowerCase().replace(/\s+/g, '-')}`, members: Array.from(selectedMembers) });
    } else {
      if (!selectedUser) { toast.error('Select a user'); return; }
      onCreate({ type: 'dm', name: null, members: [selectedUser] });
    }
    onClose();
  };

  const filtered = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 24, width: 400, maxWidth: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--tx-1)' }}>
            {type === 'channel' ? 'New Channel' : 'New Message'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={18} /></button>
        </div>
        {type === 'channel' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 4 }}>Channel Name</label>
              <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. general" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 4 }}>Members ({selectedMembers.size})</label>
              <input className="input-field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." style={{ marginBottom: 6 }} />
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                {filtered.map(u => {
                  const sel = selectedMembers.has(u.id);
                  return (
                    <div key={u.id} onClick={() => toggleMember(u.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', cursor: 'pointer', background: sel ? 'var(--accent-soft)' : 'transparent', fontSize: 13 }}
                      onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { if (!sel) e.currentTarget.style.background = sel ? 'var(--accent-soft)' : 'transparent'; }}>
                      <input type="checkbox" checked={sel} readOnly style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarBg(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {initials(u.name)}
                      </div>
                      <span style={{ color: 'var(--tx-1)' }}>{u.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 4 }}>Send to</label>
            <input className="input-field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." style={{ marginBottom: 8 }} />
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
              {filtered.map(u => (
                <div key={u.id} onClick={() => setSelectedUser(u.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', background: selectedUser === u.id ? 'var(--accent-soft)' : 'transparent', fontSize: 13 }}
                  onMouseEnter={e => { if (selectedUser !== u.id) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { if (selectedUser !== u.id) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarBg(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {initials(u.name)}
                  </div>
                  <span style={{ color: 'var(--tx-1)' }}>{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleCreate} className="btn-primary">Create</button>
        </div>
      </div>
    </div>
  );
}

/* ── Render @mentions highlighted ── */
function renderMsgBody(body) {
  if (!body) return null;
  const parts = body.split(/(@\w[\w\s]*?)(?=\s|$|@|#)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} style={{ color: 'var(--accent)', fontWeight: 600, background: 'var(--accent)12', borderRadius: 3, padding: '0 2px' }}>
        {part}
      </span>
    ) : part
  );
}

/* ── Conversation row (iMessage-style) ── */
function ConversationRow({ thread, active, onClick, displayName, subtitle, timestamp, unreadCount, type }) {
  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderRadius: 10, cursor: 'pointer',
        background: active ? 'var(--accent-soft)' : 'transparent',
        transition: 'background 0.15s var(--apple-spring, ease)',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: type === 'channel' ? 'var(--surface-3)' : avatarBg(thread.id),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
      }}>
        {type === 'channel' ? <Hash size={18} style={{ color: 'var(--tx-2)' }} /> :
         type === 'request' ? <FileText size={18} style={{ color: 'var(--tx-2)' }} /> :
         initials(displayName)}
      </div>

      {/* Name + preview */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            flex: 1, fontSize: 14, fontWeight: unreadCount > 0 ? 700 : 600,
            color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName}
          </span>
          {timestamp && (
            <span style={{ fontSize: 11, color: unreadCount > 0 ? 'var(--accent)' : 'var(--tx-3)', fontWeight: unreadCount > 0 ? 600 : 400, flexShrink: 0 }}>
              {timestamp}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            flex: 1, fontSize: 12.5, color: unreadCount > 0 ? 'var(--tx-1)' : 'var(--tx-3)',
            fontWeight: unreadCount > 0 ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {subtitle || 'No messages yet'}
          </span>
          {unreadCount > 0 && (
            <span style={{
              minWidth: 18, height: 18, padding: '0 6px', borderRadius: 9,
              background: 'var(--accent)', color: '#fff', fontSize: 10.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Time helper for sidebar ── */
function conversationTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Main Page ── */
export default function Conversations() {
  const { user } = useAuth();
  const chatBubbleColor = localStorage.getItem('redops-chat-bubble-color') || '#c92a3e';
  const chatBg = localStorage.getItem('redops-chat-bg') || 'default';
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [showNewModal, setShowNewModal] = useState(null); // 'channel' | 'dm' | null
  const [showMembers, setShowMembers] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const isClient = user?.account_type === 'Media Client' || user?.role === 'Media Client';

  const fetchThreads = useCallback(async () => {
    try {
      const res = await ax().get(`${API}/messages/threads`);
      setThreads(res.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    ax().get(`${API}/users`).then(r => {
      const arr = Array.isArray(r.data) ? r.data : r.data?.users || [];
      setUsers(arr.filter(u => u.id !== user?.id && u.active !== false));
    }).catch(() => {});
  }, [user?.id]);

  const loadMessages = useCallback(async (threadId, { scroll = true } = {}) => {
    try {
      const res = await ax().get(`${API}/messages/threads/${threadId}/messages?limit=100`);
      const serverMessages = res.data || [];
      // Merge: keep any optimistic messages not yet in server response
      setMessages(prev => {
        const serverIds = new Set(serverMessages.map(m => m.id));
        const localOnly = prev.filter(m => !serverIds.has(m.id));
        return [...serverMessages, ...localOnly];
      });
      if (scroll) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch { toast.error('Failed to load messages'); }
  }, []);

  const selectThread = (thread) => {
    setActiveThread(thread);
    loadMessages(thread.id);
    // Update thread unread count locally
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread_count: 0 } : t));
  };

  // Poll for new messages every 10 seconds — no auto-scroll (keeps user's scroll position)
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeThread) {
      pollRef.current = setInterval(() => loadMessages(activeThread.id, { scroll: false }), 10000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeThread, loadMessages]);

  const sendMessage = async () => {
    if (!activeThread) return;
    if (!newMsg.trim() && pendingAttachments.length === 0) return;
    setSending(true);
    const mentionedIds = inputRef.current?.getMentionedUserIds() || [];
    const metadata = inputRef.current?.getMetadata() || {};
    const payload = { body: newMsg };
    if (pendingAttachments.length > 0) {
      payload.attachment_ids = pendingAttachments.map(a => a.id);
    }
    if (mentionedIds.length > 0) payload.mentions = mentionedIds;
    if (metadata.urgent) payload.metadata = metadata;
    try {
      const res = await ax().post(`${API}/messages/threads/${activeThread.id}/messages`, payload);
      setMessages(prev => [...prev, res.data]);
      const preview = newMsg.trim()
        ? newMsg.slice(0, 80)
        : `📎 ${pendingAttachments.length} attachment${pendingAttachments.length !== 1 ? 's' : ''}`;
      setNewMsg('');
      setPendingAttachments([]);
      inputRef.current?.resetState();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, last_message_preview: preview, last_message_at: new Date().toISOString() } : t));
    } catch (err) {
      console.error('sendMessage failed', err.response?.status, err.response?.data, err); // eslint-disable-line no-console
      const detail = err.response?.data?.detail;
      toast.error(
        typeof detail === 'string'
          ? detail
          : err.response?.status
            ? `Failed to send (${err.response.status})`
            : err.message || 'Failed to send'
      );
    } finally { setSending(false); }
  };

  const handleCommandExecute = async (command, args) => {
    if (command === 'createtask') {
      const title = args || 'Task from chat';
      try {
        await ax().post(`${API}/tasks`, {
          title,
          ...(activeThread?.type === 'request' && activeThread?.reference_id
            ? { request_id: activeThread.reference_id }
            : {}),
        });
        toast.success(`Task created: "${title}"`);
      } catch {
        toast.error('Failed to create task');
      }
    } else if (command === 'status') {
      if (activeThread?.type === 'request') {
        toast.info(`Request status: ${activeThread.status || 'Open'}`);
      }
    }
  };

  const handleAttachFiles = async (fileList) => {
    if (!fileList?.length || !activeThread) return;
    setUploadingAttachment(true);
    try {
      const uploaded = [];
      for (const f of fileList) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('context_type', 'message');
        fd.append('context_id', activeThread.id);
        const res = await ax().post(`${API}/files/upload`, fd);
        uploaded.push({
          id: res.data.file_id || res.data.id,
          filename: res.data.filename || res.data.original_filename || f.name,
          content_type: res.data.content_type || f.type,
          file_size: res.data.file_size || f.size,
        });
      }
      setPendingAttachments(prev => [...prev, ...uploaded]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removePendingAttachment = (id) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Member management
  const addMember = async (userId) => {
    if (!activeThread) return;
    try {
      const res = await ax().patch(`${API}/messages/threads/${activeThread.id}/members`, { add: [userId] });
      setActiveThread(res.data);
      fetchThreads();
    } catch { toast.error('Failed to add member'); }
  };

  const removeMember = async (userId) => {
    if (!activeThread) return;
    try {
      const res = await ax().patch(`${API}/messages/threads/${activeThread.id}/members`, { remove: [userId] });
      setActiveThread(res.data);
      fetchThreads();
    } catch { toast.error('Failed to remove member'); }
  };

  // Message edit/delete
  const saveEditMsg = async () => {
    if (!editingMsg || !editText.trim() || !activeThread) return;
    try {
      await ax().patch(`${API}/messages/threads/${activeThread.id}/messages/${editingMsg}`, { body: editText.trim() });
      setMessages(prev => prev.map(m => m.id === editingMsg ? { ...m, body: editText.trim() } : m));
      setEditingMsg(null);
      setEditText('');
    } catch { toast.error('Failed to edit message'); }
  };

  const deleteMsg = async (msgId) => {
    if (!activeThread || !window.confirm('Delete this message?')) return;
    try {
      await ax().delete(`${API}/messages/threads/${activeThread.id}/messages/${msgId}`);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch { toast.error('Failed to delete message'); }
  };

  const createThread = async (data) => {
    try {
      const res = await ax().post(`${API}/messages/threads`, data);
      fetchThreads();
      selectThread(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create'); }
  };

  // Old typed filters removed — sidebar uses unified sorted list (see render below)

  const getThreadDisplayName = (thread) => {
    if (thread.type === 'channel') return thread.name || '#general';
    if (thread.type === 'request') return thread.name || 'Request Thread';
    // DM: show the other person's name
    const otherId = (thread.members || []).find(m => m !== user?.id);
    const other = users.find(u => u.id === otherId);
    return other?.name || 'Direct Message';
  };


  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Thread Sidebar (iMessage-style) ── */}
      <div style={{ width: 320, minWidth: 320, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-0.02em' }}>Messages</span>
            {!isClient && (
              <button onClick={() => setShowNewModal('dm')}
                title="New message"
                style={{
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 28, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(139,21,56,0.4)',
                }}>
                <Plus size={15} />
              </button>
            )}
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
            <input
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search"
              style={{
                width: '100%', padding: '8px 10px 8px 30px', fontSize: 13,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--tx-1)', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {sidebarSearch && (
              <button onClick={() => setSidebarSearch('')}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)',
                  padding: 4, display: 'flex',
                }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Thread list (unified, search-filtered) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={16} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
          ) : (() => {
            const q = sidebarSearch.trim().toLowerCase();
            // Unified sorted list: most recent first
            const allSorted = [...threads].sort((a, b) => {
              const ta = new Date(a.last_message_at || a.created_at || 0).getTime();
              const tb = new Date(b.last_message_at || b.created_at || 0).getTime();
              return tb - ta;
            });
            const filtered = q
              ? allSorted.filter(t => getThreadDisplayName(t).toLowerCase().includes(q) || (t.last_message_preview || '').toLowerCase().includes(q))
              : allSorted;

            if (filtered.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--tx-3)', fontSize: 13 }}>
                  {q ? 'No conversations match your search' : 'No conversations yet.'}
                  {!q && !isClient && (
                    <button onClick={() => setShowNewModal('dm')}
                      style={{ display: 'block', margin: '12px auto 0', background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                      Start a new message
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filtered.map(t => (
                  <ConversationRow key={t.id}
                    thread={t}
                    type={t.type}
                    active={activeThread?.id === t.id}
                    onClick={() => selectThread(t)}
                    displayName={getThreadDisplayName(t)}
                    subtitle={t.last_message_preview || ''}
                    timestamp={conversationTime(t.last_message_at || t.created_at)}
                    unreadCount={t.unread_count || 0}
                  />
                ))}

                {!isClient && (
                  <button onClick={() => setShowNewModal('channel')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                      marginTop: 8, borderRadius: 10, cursor: 'pointer', background: 'transparent',
                      border: '1px dashed var(--border)', color: 'var(--tx-3)', fontSize: 12.5,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <Hash size={13} />
                    <span>New Channel</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Message View ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeThread ? (
          <>
            {/* Thread header (iMessage-style) */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, position: 'relative', background: 'var(--surface)' }}>
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                background: activeThread.type === 'channel' ? 'var(--surface-3)' : avatarBg(activeThread.id),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff',
              }}>
                {activeThread.type === 'channel' ? <Hash size={16} style={{ color: 'var(--tx-2)' }} /> :
                 activeThread.type === 'request' ? <FileText size={16} style={{ color: 'var(--tx-2)' }} /> :
                 initials(getThreadDisplayName(activeThread))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getThreadDisplayName(activeThread)}
                </div>
                {activeThread.type !== 'dm' && (
                  <button onClick={() => setShowMembers(!showMembers)}
                    style={{ fontSize: 11, color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1 }}>
                    {activeThread.members?.length || 0} {activeThread.members?.length === 1 ? 'member' : 'members'}
                  </button>
                )}
              </div>

              {/* Members panel */}
              {showMembers && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 450 }} onClick={() => setShowMembers(false)} />
                  <div style={{
                    position: 'absolute', right: 20, top: '100%', marginTop: 4, width: 260, zIndex: 451,
                    background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,.4)', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>Members</div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {(activeThread.members || []).map(mid => {
                        const mu = users.find(u => u.id === mid);
                        return (
                          <div key={mid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 12 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: avatarBg(mid), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {initials(mu?.name || '?')}
                            </div>
                            <span style={{ flex: 1, color: 'var(--tx-1)' }}>{mu?.name || mid.slice(0, 8)}</span>
                            {mid !== user?.id && activeThread.type === 'channel' && (
                              <button onClick={() => removeMember(mid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}><X size={12} /></button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {activeThread.type === 'channel' && (
                      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                        <select className="input-field" value="" onChange={e => { if (e.target.value) addMember(e.target.value); }}
                          style={{ fontSize: 11, padding: '4px 8px' }}>
                          <option value="">Add member...</option>
                          {users.filter(u => !(activeThread.members || []).includes(u.id)).map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2,
              ...(chatBg !== 'default' ? { background: chatBg, backgroundSize: 'cover' } : {}),
            }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState icon="chat" title="No messages yet" description="Start the conversation!" />
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMine = msg.sender_id === user?.id;
                const showAvatar = idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id;
                const isEditing = editingMsg === msg.id;
                return (
                  <div key={msg.id} style={{
                    display: 'flex', gap: 10, padding: showAvatar ? '6px 0 2px' : '1px 0',
                    alignItems: 'flex-end', position: 'relative',
                    flexDirection: isMine ? 'row-reverse' : 'row',
                  }}
                    onMouseEnter={e => { const a = e.currentTarget.querySelector('[data-actions]'); if (a) a.style.opacity = 1; }}
                    onMouseLeave={e => { const a = e.currentTarget.querySelector('[data-actions]'); if (a) a.style.opacity = 0; }}>
                    {showAvatar && !isMine ? (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarBg(msg.sender_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {initials(msg.sender_name)}
                      </div>
                    ) : !isMine ? <div style={{ width: 28, flexShrink: 0 }} /> : null}
                    <div style={{
                      maxWidth: '75%', minWidth: 0,
                      background: isMine ? chatBubbleColor : 'var(--surface-2)',
                      borderRadius: isMine
                        ? (showAvatar ? '18px 18px 4px 18px' : '18px 18px 4px 18px')
                        : (showAvatar ? '18px 18px 18px 4px' : '18px 18px 18px 4px'),
                      padding: '8px 14px',
                      color: isMine ? '#fff' : 'var(--tx-1)',
                    }}>
                      {showAvatar && !isMine && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{msg.sender_name}</span>
                          <span style={{ fontSize: 9, opacity: 0.5 }}>{timeAgo(msg.created_at)}</span>
                        </div>
                      )}
                      {showAvatar && isMine && (
                        <div style={{ textAlign: 'right', marginBottom: 2 }}>
                          <span style={{ fontSize: 9, opacity: 0.6 }}>{timeAgo(msg.created_at)}</span>
                        </div>
                      )}
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                          <textarea value={editText} onChange={e => setEditText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditMsg(); } if (e.key === 'Escape') { setEditingMsg(null); } }}
                            autoFocus rows={2}
                            style={{ flex: 1, resize: 'none', background: 'var(--surface-2)', border: '1px solid var(--accent)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--tx-1)', outline: 'none', fontFamily: 'inherit' }} />
                          <button onClick={saveEditMsg} style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', padding: '5px 8px', display: 'flex' }}><Check size={14} /></button>
                          <button onClick={() => setEditingMsg(null)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--tx-3)', cursor: 'pointer', padding: '5px 8px', display: 'flex' }}><X size={14} /></button>
                        </div>
                      ) : (
                        <>
                          {msg.metadata?.urgent && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red-status, #ef4444)', background: 'var(--red-status, #ef4444)15', padding: '2px 8px', borderRadius: 4, marginBottom: 4, display: 'inline-block' }}>
                              {'\u26A1'} URGENT
                            </span>
                          )}
                          {msg.body && (
                            <p style={{ margin: 0, fontSize: 13.5, color: isMine ? '#fff' : 'var(--tx-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {renderMsgBody(msg.body)}
                            </p>
                          )}
                          {(msg.attachments || []).length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: msg.body ? 6 : 0 }}>
                              {msg.attachments.map(att => {
                                const isImg = (att.content_type || '').startsWith('image/');
                                const url = `${API}/files/${att.id}/download`;
                                if (isImg) {
                                  return (
                                    <a key={att.id} href={url} target="_blank" rel="noreferrer"
                                      style={{ display: 'inline-block', maxWidth: 320 }}>
                                      <img src={url} alt={att.filename}
                                        style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, border: '1px solid var(--border)' }} />
                                    </a>
                                  );
                                }
                                return (
                                  <a key={att.id} href={url} target="_blank" rel="noreferrer"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                      background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
                                      textDecoration: 'none', color: 'var(--tx-1)', maxWidth: 320,
                                    }}>
                                    <FileText size={16} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                                    <Download size={13} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Hover action bar — only for own messages; positioned next to the bubble */}
                    {isMine && !isEditing && (
                      <div data-actions style={{
                        display: 'flex', gap: 2, opacity: 0, transition: 'opacity .1s',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: 3, alignSelf: 'center', flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      }}>
                        <button onClick={() => { setEditingMsg(msg.id); setEditText(msg.body); }}
                          title="Edit message"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)', padding: 4, display: 'flex', borderRadius: 5 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteMsg(msg.id)}
                          title="Delete message"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-red)', padding: 4, display: 'flex', borderRadius: 5 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-red-soft)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              {/* Pending attachment chips */}
              {(pendingAttachments.length > 0 || uploadingAttachment) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {pendingAttachments.map(att => {
                    const isImg = (att.content_type || '').startsWith('image/');
                    return (
                      <div key={att.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 5px 10px',
                        background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6,
                        fontSize: 11.5, color: 'var(--tx-1)', maxWidth: 220,
                      }}>
                        {isImg ? <ImageIcon size={12} style={{ color: 'var(--tx-3)' }} /> : <FileText size={12} style={{ color: 'var(--tx-3)' }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                        <button onClick={() => removePendingAttachment(att.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 2, display: 'flex' }}>
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                  {uploadingAttachment && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11.5, color: 'var(--tx-3)' }}>
                      <Loader2 size={12} className="spin" /> Uploading…
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <label title="Attach files" style={{
                  width: 38, height: 38, borderRadius: 8, cursor: uploadingAttachment ? 'not-allowed' : 'pointer',
                  background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
                  color: 'var(--tx-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  opacity: uploadingAttachment ? 0.6 : 1,
                }}>
                  <Paperclip size={16} />
                  <input
                    type="file" multiple style={{ display: 'none' }}
                    disabled={uploadingAttachment}
                    onChange={e => { handleAttachFiles(Array.from(e.target.files)); e.target.value = ''; }}
                  />
                </label>
                <MentionHashtagInput
                  ref={inputRef}
                  value={newMsg}
                  onChange={setNewMsg}
                  onSend={sendMessage}
                  users={users}
                  threadType={activeThread?.type}
                  onCommandExecute={handleCommandExecute}
                  placeholder="Type a message... Use @ to mention, # for commands"
                />
                <button onClick={sendMessage} disabled={sending || (!newMsg.trim() && pendingAttachments.length === 0)}
                  style={{
                    width: 38, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: (newMsg.trim() || pendingAttachments.length > 0) ? 'var(--accent)' : 'var(--surface-2)',
                    color: (newMsg.trim() || pendingAttachments.length > 0) ? '#fff' : 'var(--tx-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s', flexShrink: 0,
                  }}>
                  {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <MessageSquare size={40} style={{ color: 'var(--tx-3)', opacity: 0.3 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)' }}>Select a conversation</h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', maxWidth: 300, textAlign: 'center' }}>
              Choose a channel, direct message, or request thread from the sidebar to start messaging.
            </p>
          </div>
        )}
      </div>

      {/* New Thread Modal */}
      {showNewModal && (
        <NewThreadModal type={showNewModal} onClose={() => setShowNewModal(null)} onCreate={createThread} users={users} />
      )}
    </div>
  );
}

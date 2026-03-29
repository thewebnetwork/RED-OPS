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
  MessageSquare, Plus, X, Send, Hash, User, FileText,
  Loader2, Pencil, Trash2, Users, Check,
} from 'lucide-react';

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

/* ── Main Page ── */
export default function Conversations() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [showNewModal, setShowNewModal] = useState(null); // 'channel' | 'dm' | null
  const [showMembers, setShowMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
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

  const loadMessages = useCallback(async (threadId) => {
    try {
      const res = await ax().get(`${API}/messages/threads/${threadId}/messages`);
      setMessages(res.data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('Failed to load messages'); }
  }, []);

  const selectThread = (thread) => {
    setActiveThread(thread);
    loadMessages(thread.id);
    // Update thread unread count locally
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread_count: 0 } : t));
  };

  // Poll for new messages every 10 seconds
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeThread) {
      pollRef.current = setInterval(() => loadMessages(activeThread.id), 10000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeThread, loadMessages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeThread) return;
    setSending(true);
    try {
      const res = await ax().post(`${API}/messages/threads/${activeThread.id}/messages`, { body: newMsg });
      setMessages(prev => [...prev, res.data]);
      setNewMsg('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      // Update thread preview
      setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, last_message_preview: newMsg.slice(0, 80), last_message_at: new Date().toISOString() } : t));
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  // Member management
  const addMember = async (userId) => {
    if (!activeThread) return;
    try {
      const res = await ax().patch(`${API}/messages/threads/${activeThread.id}/members`, { add: [userId] });
      setActiveThread(res.data);
      setMemberSearch('');
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
    if (!editingMsg || !editText.trim()) return;
    try {
      await ax().patch(`${API}/messages/threads/${activeThread.id}/messages/${editingMsg}`, { body: editText.trim() });
      setMessages(prev => prev.map(m => m.id === editingMsg ? { ...m, body: editText.trim() } : m));
      setEditingMsg(null);
      setEditText('');
    } catch { toast.error('Failed to edit message'); }
  };

  const deleteMsg = async (msgId) => {
    if (!window.confirm('Delete this message?')) return;
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

  const channels = threads.filter(t => t.type === 'channel');
  const dms = threads.filter(t => t.type === 'dm');
  const requestThreads = threads.filter(t => t.type === 'request');

  const getThreadDisplayName = (thread) => {
    if (thread.type === 'channel') return thread.name || '#general';
    if (thread.type === 'request') return thread.name || 'Request Thread';
    // DM: show the other person's name
    const otherId = (thread.members || []).find(m => m !== user?.id);
    const other = users.find(u => u.id === otherId);
    return other?.name || 'Direct Message';
  };

  const ThreadIcon = ({ type }) => {
    if (type === 'channel') return <Hash size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />;
    if (type === 'request') return <FileText size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />;
    return <User size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />;
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Thread Sidebar ── */}
      <div style={{ width: 280, minWidth: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ padding: '14px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Messages</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={16} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
          ) : (
            <>
              {/* Channels (admin/operator only) */}
              {!isClient && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px 4px', fontSize: 10.5, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Channels
                    <button onClick={() => setShowNewModal('channel')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex' }}><Plus size={13} /></button>
                  </div>
                  {channels.map(t => (
                    <div key={t.id} onClick={() => selectThread(t)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, cursor: 'pointer', background: activeThread?.id === t.id ? 'var(--accent-soft)' : 'transparent', color: activeThread?.id === t.id ? 'var(--accent)' : 'var(--tx-2)', fontSize: 13, fontWeight: 500 }}
                      onMouseEnter={e => { if (activeThread?.id !== t.id) e.currentTarget.style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { if (activeThread?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}>
                      <Hash size={13} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(t.name || '').replace('#', '')}</span>
                      {(t.unread_count || 0) > 0 && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                    </div>
                  ))}
                </>
              )}

              {/* Direct Messages */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px 4px', fontSize: 10.5, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Direct Messages
                <button onClick={() => setShowNewModal('dm')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex' }}><Plus size={13} /></button>
              </div>
              {dms.map(t => (
                <div key={t.id} onClick={() => selectThread(t)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, cursor: 'pointer', background: activeThread?.id === t.id ? 'var(--accent-soft)' : 'transparent', color: activeThread?.id === t.id ? 'var(--accent)' : 'var(--tx-2)', fontSize: 13, fontWeight: 500 }}
                  onMouseEnter={e => { if (activeThread?.id !== t.id) e.currentTarget.style.background = 'var(--surface-3)'; }}
                  onMouseLeave={e => { if (activeThread?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}>
                  <User size={13} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getThreadDisplayName(t)}</span>
                  {(t.unread_count || 0) > 0 && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                </div>
              ))}

              {/* Request Threads */}
              {requestThreads.length > 0 && (
                <>
                  <div style={{ padding: '10px 8px 4px', fontSize: 10.5, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Request Threads
                  </div>
                  {requestThreads.map(t => (
                    <div key={t.id} onClick={() => selectThread(t)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, cursor: 'pointer', background: activeThread?.id === t.id ? 'var(--accent-soft)' : 'transparent', color: activeThread?.id === t.id ? 'var(--accent)' : 'var(--tx-2)', fontSize: 13, fontWeight: 500 }}
                      onMouseEnter={e => { if (activeThread?.id !== t.id) e.currentTarget.style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { if (activeThread?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}>
                      <FileText size={13} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || 'Request'}</span>
                      {(t.unread_count || 0) > 0 && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Message View ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeThread ? (
          <>
            {/* Thread header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, position: 'relative' }}>
              <ThreadIcon type={activeThread.type} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{getThreadDisplayName(activeThread)}</span>
              <button onClick={() => setShowMembers(!showMembers)}
                style={{ fontSize: 11, color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={12} /> {activeThread.members?.length || 0} members
              </button>

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
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>No messages yet. Start the conversation!</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMine = msg.sender_id === user?.id;
                const showAvatar = idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id;
                const isEditing = editingMsg === msg.id;
                return (
                  <div key={msg.id} style={{ display: 'flex', gap: 10, padding: showAvatar ? '8px 0 2px' : '1px 0', alignItems: 'flex-start', position: 'relative' }}
                    onMouseEnter={e => { const a = e.currentTarget.querySelector('[data-actions]'); if (a) a.style.opacity = 1; }}
                    onMouseLeave={e => { const a = e.currentTarget.querySelector('[data-actions]'); if (a) a.style.opacity = 0; }}>
                    {showAvatar ? (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarBg(msg.sender_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 2 }}>
                        {initials(msg.sender_name)}
                      </div>
                    ) : <div style={{ width: 28, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {showAvatar && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>{msg.sender_name}</span>
                          <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{timeAgo(msg.created_at)}</span>
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
                        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--tx-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</p>
                      )}
                    </div>
                    {/* Hover action bar — only for own messages */}
                    {isMine && !isEditing && (
                      <div data-actions style={{ position: 'absolute', right: 0, top: showAvatar ? 6 : 0, display: 'flex', gap: 2, opacity: 0, transition: 'opacity .1s', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: 2 }}>
                        <button onClick={() => { setEditingMsg(msg.id); setEditText(msg.body); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 3, display: 'flex' }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => deleteMsg(msg.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 3, display: 'flex' }}>
                          <Trash2 size={12} />
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a message..."
                  rows={1}
                  style={{
                    flex: 1, resize: 'none', background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
                    borderRadius: 8, padding: '10px 12px', fontSize: 13.5, color: 'var(--tx-1)', outline: 'none',
                    fontFamily: 'inherit', minHeight: 40, maxHeight: 120,
                  }}
                />
                <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
                  style={{
                    width: 38, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: newMsg.trim() ? 'var(--accent)' : 'var(--surface-2)',
                    color: newMsg.trim() ? '#fff' : 'var(--tx-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
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

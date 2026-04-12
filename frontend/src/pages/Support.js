/**
 * Support Tickets — client bug reports + admin support dashboard
 *
 * Clients: submit tickets, chat with admins, track status
 * Admins: see all tickets, assign, respond, resolve
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import EmptyState from '../components/EmptyState';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  LifeBuoy, Plus, X, Send, Loader2, AlertCircle, CheckCircle2,
  Clock, ChevronRight, Bug, MessageSquare, Zap,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STATUS_CONFIG = {
  open: { label: 'Open', color: '#3b82f6', bg: '#3b82f618' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#f59e0b18' },
  waiting: { label: 'Waiting', color: '#a855f7', bg: '#a855f718' },
  resolved: { label: 'Resolved', color: '#22c55e', bg: '#22c55e18' },
  closed: { label: 'Closed', color: '#606060', bg: '#60606018' },
};

const CATEGORY_CONFIG = {
  general: { label: 'General', icon: MessageSquare },
  bug: { label: 'Bug Report', icon: Bug },
  feature: { label: 'Feature Request', icon: Zap },
  billing: { label: 'Billing', icon: AlertCircle },
  other: { label: 'Other', icon: LifeBuoy },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: '#606060' },
  normal: { label: 'Normal', color: '#3b82f6' },
  high: { label: 'High', color: '#f59e0b' },
  urgent: { label: 'Urgent', color: '#ef4444' },
};

function timeAgo(dt) {
  if (!dt) return '';
  const diff = (Date.now() - new Date(dt).getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Support() {
  const { user } = useAuth();
  const isClient = user?.account_type === 'Media Client' || user?.role === 'Media Client';
  const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin' || user?.role === 'Operator';

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState(null);
  const messagesEndRef = useRef(null);

  // Create form
  const [createForm, setCreateForm] = useState({ subject: '', category: 'general', description: '', priority: 'normal' });
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {};
      const res = await ax().get(`${API}/support/tickets`, { params });
      setTickets(res.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (isAdmin) {
      ax().get(`${API}/support/stats`).then(r => setStats(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  const loadMessages = async (ticketId) => {
    try {
      const res = await ax().get(`${API}/support/tickets/${ticketId}/messages`);
      setMessages(res.data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { toast.error('Failed to load messages'); }
  };

  const selectTicket = (ticket) => {
    setSelected(ticket);
    loadMessages(ticket.id);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selected) return;
    setSending(true);
    try {
      const res = await ax().post(`${API}/support/tickets/${selected.id}/messages`, { body: newMsg });
      setMessages(prev => [...prev, res.data]);
      setNewMsg('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      fetchTickets();
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  const createTicket = async () => {
    if (!createForm.subject.trim()) { toast.error('Subject is required'); return; }
    if (!createForm.description.trim()) { toast.error('Description is required'); return; }
    setCreating(true);
    try {
      const res = await ax().post(`${API}/support/tickets`, createForm);
      toast.success('Ticket submitted');
      setShowCreate(false);
      setCreateForm({ subject: '', category: 'general', description: '', priority: 'normal' });
      fetchTickets();
      selectTicket(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create ticket'); }
    finally { setCreating(false); }
  };

  const updateTicketStatus = async (ticketId, status) => {
    try {
      await ax().patch(`${API}/support/tickets/${ticketId}`, { status });
      toast.success(`Ticket ${status}`);
      fetchTickets();
      if (selected?.id === ticketId) setSelected(prev => ({ ...prev, status }));
    } catch { toast.error('Failed to update'); }
  };

  const inpStyle = { width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Ticket List Sidebar ── */}
      <div style={{ width: 340, minWidth: 340, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LifeBuoy size={18} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>Support</span>
            </div>
            <button onClick={() => setShowCreate(true)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '5px 10px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Plus size={13} /> New Ticket
            </button>
          </div>

          {/* Admin stats */}
          {isAdmin && stats && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {[
                { label: 'Open', val: stats.open, color: '#3b82f6' },
                { label: 'Active', val: stats.in_progress, color: '#f59e0b' },
                { label: 'Resolved', val: stats.resolved, color: '#22c55e' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: `${s.color}12`, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: 'var(--tx-3)', fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {['all', 'open', 'in_progress', 'resolved'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{
                  padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid', textTransform: 'capitalize',
                  background: filterStatus === s ? 'var(--accent)' : 'transparent',
                  color: filterStatus === s ? '#fff' : 'var(--tx-3)',
                  borderColor: filterStatus === s ? 'var(--accent)' : 'var(--border)',
                }}>
                {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 30 }}><Loader2 size={18} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon="inbox"
              title={filterStatus !== 'all' ? 'No tickets with this status' : 'No support tickets'}
              description={filterStatus !== 'all' ? 'Try changing your filter.' : 'Tickets will appear here once submitted.'}
            />
          ) : (
            tickets.map(t => {
              const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
              const cc = CATEGORY_CONFIG[t.category] || CATEGORY_CONFIG.general;
              const CatIcon = cc.icon;
              return (
                <div key={t.id} onClick={() => selectTicket(t)}
                  style={{
                    padding: '12px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: selected?.id === t.id ? 'var(--accent-soft)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (selected?.id !== t.id) e.currentTarget.style.background = 'var(--surface-3)'; }}
                  onMouseLeave={e => { if (selected?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <CatIcon size={13} style={{ color: sc.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0 }}>{sc.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--tx-3)' }}>
                    <span>{t.created_by_name}</span>
                    <span>·</span>
                    <span>{timeAgo(t.updated_at)}</span>
                    {t.message_count > 1 && <span>· {t.message_count} msgs</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat / Detail View ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <>
            {/* Header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{selected.subject}</h3>
                <div style={{ display: 'flex', gap: 4 }}>
                  {isAdmin && selected.status !== 'resolved' && (
                    <button onClick={() => updateTicketStatus(selected.id, 'resolved')} className="btn-ghost btn-xs" style={{ gap: 4, color: '#22c55e', borderColor: '#22c55e40' }}>
                      <CheckCircle2 size={12} /> Resolve
                    </button>
                  )}
                  {isAdmin && selected.status === 'open' && (
                    <button onClick={() => updateTicketStatus(selected.id, 'in_progress')} className="btn-ghost btn-xs" style={{ gap: 4 }}>
                      <Clock size={12} /> In Progress
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--tx-3)' }}>
                <span style={{ padding: '1px 6px', borderRadius: 4, background: STATUS_CONFIG[selected.status]?.bg, color: STATUS_CONFIG[selected.status]?.color, fontWeight: 600 }}>
                  {STATUS_CONFIG[selected.status]?.label}
                </span>
                <span style={{ padding: '1px 6px', borderRadius: 4, background: `${PRIORITY_CONFIG[selected.priority]?.color}18`, color: PRIORITY_CONFIG[selected.priority]?.color, fontWeight: 600 }}>
                  {PRIORITY_CONFIG[selected.priority]?.label}
                </span>
                <span>by {selected.created_by_name}</span>
                <span>· {new Date(selected.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {messages.map(msg => {
                const isMine = msg.sender_id === user?.id;
                const isStaff = msg.sender_role === 'Administrator' || msg.sender_role === 'Operator';
                return (
                  <div key={msg.id} style={{ display: 'flex', gap: 10, padding: '6px 0' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isStaff ? 'var(--accent)' : '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 2 }}>
                      {(msg.sender_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>{msg.sender_name}</span>
                        {isStaff && <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>Staff</span>}
                        <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{timeAgo(msg.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--tx-1)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{msg.body}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Type a reply..." rows={1}
                  style={{ flex: 1, resize: 'none', background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, color: 'var(--tx-1)', outline: 'none', fontFamily: 'inherit', minHeight: 40, maxHeight: 120 }} />
                <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
                  style={{ width: 38, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer', background: newMsg.trim() ? 'var(--accent)' : 'var(--surface-2)', color: newMsg.trim() ? '#fff' : 'var(--tx-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <LifeBuoy size={40} style={{ color: 'var(--tx-3)', opacity: 0.3 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)' }}>
              {isClient ? 'Need help?' : 'Support Dashboard'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', maxWidth: 300, textAlign: 'center' }}>
              {isClient ? 'Submit a ticket and our team will respond.' : 'Select a ticket to view the conversation.'}
            </p>
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ gap: 6 }}>
              <Plus size={14} /> New Ticket
            </button>
          </div>
        )}
      </div>

      {/* ── Create Ticket Modal ── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowCreate(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'relative', width: 480, maxHeight: '85vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Submit Support Ticket</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>Subject *</label>
                <input style={inpStyle} value={createForm.subject} onChange={e => setCreateForm(p => ({ ...p, subject: e.target.value }))} placeholder="Brief summary of the issue" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>Category</label>
                  <select style={inpStyle} value={createForm.category} onChange={e => setCreateForm(p => ({ ...p, category: e.target.value }))}>
                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>Priority</label>
                  <select style={inpStyle} value={createForm.priority} onChange={e => setCreateForm(p => ({ ...p, priority: e.target.value }))}>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>Description *</label>
                <textarea style={{ ...inpStyle, minHeight: 100, resize: 'vertical' }} value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the issue, what you expected, and what happened instead..." />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreate(false)} className="btn-ghost">Cancel</button>
                <button onClick={createTicket} className="btn-primary" disabled={creating} style={{ gap: 5 }}>
                  {creating ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                  {creating ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import {
  Plus, Search, X, AlertCircle, ArrowUp, Minus, ArrowDown,
  MessageSquare, Loader2, Clock, Shield, User, Users, ChevronDown,
  ExternalLink, Filter, LayoutGrid, List, RefreshCw, UserPlus,
  CheckCircle2, Truck, AlertTriangle, Eye, MoreHorizontal, Trash2,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const hdrs = () => ({ Authorization: `Bearer ${tok()}` });
const jhdrs = () => ({ ...hdrs(), 'Content-Type': 'application/json' });

const STAGES = ['Open', 'In Progress', 'Pending', 'Delivered', 'Closed'];
const STAGE_COLORS = {
  Open: '#3b82f6', 'In Progress': '#f59e0b', Pending: '#a855f7',
  Delivered: '#22c55e', Closed: '#606060', Canceled: '#ef4444', Draft: '#64748b',
};

const PRI = { urgent: '#c92a3e', high: '#f97316', medium: '#3b82f6', low: '#606060' };
const PRI_ICON = { urgent: AlertCircle, high: ArrowUp, medium: Minus, low: ArrowDown };
const PRI_LABELS = ['urgent', 'high', 'medium', 'low'];

const fmt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const timeAgo = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

function slaCountdown(deadline) {
  if (!deadline) return null;
  const diff = new Date(deadline) - Date.now();
  if (diff < 0) return { label: 'OVERDUE', color: '#ef4444', urgent: true };
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 4) return { label: `${hrs}h left`, color: '#ef4444', urgent: true };
  if (hrs < 24) return { label: `${hrs}h left`, color: '#f59e0b', urgent: false };
  const days = Math.floor(hrs / 24);
  return { label: `${days}d left`, color: '#22c55e', urgent: false };
}

// ── Sub-components ──────────────────────────────────────────

function PriorityDot({ priority, size = 7 }) {
  return <span style={{ width: size, height: size, borderRadius: '50%', background: PRI[priority] || '#606060', display: 'inline-block', flexShrink: 0 }} />;
}

function StagePill({ stage }) {
  const color = STAGE_COLORS[stage] || '#606060';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: `${color}18`, color }}>
      {stage}
    </span>
  );
}

function Avatar({ name, size = 22, color }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#c92a3e', '#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899'];
  const bg = color || colors[Math.abs(hash) % colors.length];
  return (
    <div title={name} style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function SlaTag({ deadline }) {
  const sla = slaCountdown(deadline);
  if (!sla) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
      background: sla.color + '18', color: sla.color,
      animation: sla.urgent ? 'pulse 2s infinite' : 'none',
    }}>
      <Clock size={9} /> {sla.label}
    </span>
  );
}

// Kanban card for orders
function OrderCard({ order, onClick, ghost = false }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '10px 12px', cursor: ghost ? 'grabbing' : 'pointer',
        boxShadow: ghost ? '0 12px 40px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.12)',
        opacity: ghost ? 0.5 : 1, transition: 'box-shadow .15s, transform .15s',
        borderLeft: `3px solid ${PRI[order.priority] || '#606060'}`,
        transform: ghost ? 'rotate(1.5deg)' : 'none',
      }}
      onMouseEnter={e => { if (!ghost) { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
      onMouseLeave={e => { if (!ghost) { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'none'; }}}
    >
      {/* Top: code + SLA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', letterSpacing: '.02em' }}>{order.order_code}</span>
        <SlaTag deadline={order.sla_deadline} />
      </div>
      {/* Title */}
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx-1)', lineHeight: 1.35, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
        {order.title}
      </div>
      {/* Service + Client */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {order.service_name && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg)', color: 'var(--tx-3)', fontWeight: 500, border: '1px solid var(--border)' }}>
            {order.service_name}
          </span>
        )}
      </div>
      {/* Bottom: client + assignee */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Avatar name={order.requester_name} size={18} />
          <span style={{ fontSize: 11, color: 'var(--tx-2)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {order.requester_name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {order.editor_name ? (
            <>
              <Avatar name={order.editor_name} size={18} color="#22c55e" />
              <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{order.editor_name?.split(' ')[0]}</span>
            </>
          ) : (
            <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              <UserPlus size={10} /> Unassigned
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableOrder({ order, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0 : 1, touchAction: 'none', marginBottom: 8 }}>
      <OrderCard order={order} onClick={onOpen} />
    </div>
  );
}

function DroppableColumn({ stage, children, isEmpty }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const color = STAGE_COLORS[stage];
  return (
    <div ref={setNodeRef} style={{
      flex: 1, minHeight: 80, padding: 4, borderRadius: 6, transition: 'background .15s',
      background: isOver ? `${color}0d` : undefined, outline: isOver ? `1px dashed ${color}60` : '1px dashed transparent',
    }}>
      {children}
      {isEmpty && !isOver && <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--tx-3)', fontSize: 11.5 }}>No orders</div>}
      {isEmpty && isOver && <div style={{ textAlign: 'center', padding: '20px 8px', color, fontSize: 11.5, fontWeight: 500 }}>Drop here</div>}
    </div>
  );
}

// Assignment dropdown
function AssignDropdown({ orderId, currentEditorId, teamMembers, onAssign }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = teamMembers.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="btn-ghost btn-sm" style={{ fontSize: 11, gap: 4, padding: '5px 8px' }}>
        <UserPlus size={12} /> Assign <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 450 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4, width: 240,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 451, overflow: 'hidden',
          }}>
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search team..."
                autoFocus
                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--tx-1)', fontSize: 12, padding: '4px 0' }}
              />
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {filtered.map(m => (
                <div
                  key={m.id}
                  onClick={() => { onAssign(orderId, m.id, m.name); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer',
                    background: m.id === currentEditorId ? 'var(--accent)12' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = m.id === currentEditorId ? 'var(--accent)12' : 'transparent'}
                >
                  <Avatar name={m.name} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx-1)' }}>{m.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>{m.role} · {m.active_orders || 0} active</div>
                  </div>
                  {m.id === currentEditorId && <CheckCircle2 size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                </div>
              ))}
              {filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--tx-3)', fontSize: 12 }}>No team members found</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Comments (reuse existing pattern)
function OrderComments({ orderId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    fetch(`${API}/orders/${orderId}/messages`, { headers: hdrs() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setComments(Array.isArray(d) ? d : []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [orderId]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/orders/${orderId}/messages`, { method: 'POST', headers: jhdrs(), body: JSON.stringify({ message_body: text.trim() }) });
      if (!res.ok) throw new Error();
      const msg = await res.json();
      setComments(prev => [...prev, msg]);
      setText('');
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <MessageSquare size={13} /> Messages ({comments.length})
      </h4>
      {loading && <div style={{ textAlign: 'center', padding: 12, color: 'var(--tx-3)' }}><Loader2 size={14} className="spin" /></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comments.map((c, i) => (
          <div key={c.id || i} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 7, borderLeft: `2px solid ${c.author_role === 'Administrator' ? 'var(--accent)' : '#3b82f6'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx-1)' }}>{c.author_name}</span>
              <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{timeAgo(c.created_at)}</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.5 }}>{c.message_body}</p>
          </div>
        ))}
        {!loading && comments.length === 0 && <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--tx-3)', fontSize: 11.5 }}>No messages yet</div>}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
        <input className="input-field" placeholder="Type a message..." value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }} style={{ flex: 1, fontSize: 12 }} />
        <button className="btn-ghost btn-sm" onClick={send} disabled={!text.trim() || sending}>
          {sending ? <Loader2 size={13} className="spin" /> : <MessageSquare size={13} />}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Requests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem('requests_view') || 'kanban');
  const [search, setSearch] = useState('');
  const [priFilter, setPriFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showModal, setShowModal] = useState(() => searchParams.get('new') === '1');
  const [selected, setSelected] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', service_template_id: '', client_id: '', priority: 'medium', description: '' });
  const [services, setServices] = useState([]);
  const [clients, setClients] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, usersRes, servicesRes] = await Promise.all([
        fetch(`${API}/orders`, { headers: hdrs() }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/users`, { headers: hdrs() }).then(r => r.ok ? r.json() : []),
        fetch(`${API}/service-templates?active_only=true`, { headers: hdrs() }).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      const orderList = Array.isArray(ordersRes) ? ordersRes : ordersRes?.orders || [];
      setOrders(orderList);

      const userList = Array.isArray(usersRes) ? usersRes : usersRes?.items || [];
      // Team = non-media-client active users
      const team = userList.filter(u => u.account_type !== 'Media Client' && u.active !== false);
      // Count active orders per team member
      const editorCounts = {};
      orderList.forEach(o => { if (o.editor_id && !['Delivered', 'Closed', 'Canceled'].includes(o.status)) editorCounts[o.editor_id] = (editorCounts[o.editor_id] || 0) + 1; });
      setTeamMembers(team.map(u => ({ ...u, active_orders: editorCounts[u.id] || 0 })));

      // Clients = Media Client users
      const clientList = userList.filter(u => u.account_type === 'Media Client' && u.active !== false);
      setClients(clientList);

      const svcList = Array.isArray(servicesRes) ? servicesRes : servicesRes?.services || [];
      setServices(svcList);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (searchParams.get('new') === '1') setShowModal(true); }, [searchParams]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Filter
  const filtered = useMemo(() => {
    let list = orders.filter(o => o.status !== 'Draft' && o.status !== 'Canceled');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o => (o.title || '').toLowerCase().includes(q) || (o.order_code || '').toLowerCase().includes(q) || (o.requester_name || '').toLowerCase().includes(q) || (o.service_name || '').toLowerCase().includes(q));
    }
    if (priFilter) list = list.filter(o => o.priority === priFilter);
    if (stageFilter) list = list.filter(o => o.status === stageFilter);
    return list;
  }, [orders, search, priFilter, stageFilter]);

  const byStage = useMemo(() => STAGES.reduce((a, s) => { a[s] = filtered.filter(o => o.status === s); return a; }, {}), [filtered]);
  const unassigned = orders.filter(o => o.status === 'Open' && !o.editor_id).length;
  const openCount = orders.filter(o => !['Delivered', 'Closed', 'Canceled', 'Draft'].includes(o.status)).length;
  const breachedCount = orders.filter(o => o.is_sla_breached && !['Delivered', 'Closed', 'Canceled'].includes(o.status)).length;
  const activeDrag = orders.find(o => o.id === activeId) || null;

  // Actions
  const updateStatus = async (id, newStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status: newStatus }));

    // Map to backend endpoints
    const statusEndpoints = {
      'In Progress': null, // handled by pick
      'Pending': 'submit-for-review',
      'Delivered': 'deliver',
      'Closed': 'close',
    };

    try {
      if (newStatus === 'In Progress' && orders.find(o => o.id === id)?.status === 'Open') {
        // Pick the order
        await fetch(`${API}/orders/${id}/pick`, { method: 'POST', headers: jhdrs() });
      } else if (statusEndpoints[newStatus]) {
        const body = newStatus === 'Delivered' ? { resolution_notes: 'Delivered via kanban' } : newStatus === 'Closed' ? { reason: 'Completed' } : {};
        await fetch(`${API}/orders/${id}/${statusEndpoints[newStatus]}`, { method: 'POST', headers: jhdrs(), body: JSON.stringify(body) });
      }
    } catch { toast.error('Failed to update status'); fetchData(); }
  };

  const assignOrder = async (orderId, userId, userName) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, editor_id: userId, editor_name: userName, status: o.status === 'Open' ? 'In Progress' : o.status } : o));
    try {
      await fetch(`${API}/orders/${orderId}/reassign`, {
        method: 'POST', headers: jhdrs(),
        body: JSON.stringify({ reassign_type: 'user', target_id: userId, reason: 'Assigned from operations board' }),
      });
      toast.success(`Assigned to ${userName}`);
    } catch { toast.error('Failed to assign'); fetchData(); }
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || !active) return;
    const order = orders.find(o => o.id === active.id);
    if (!order || order.status === over.id) return;
    updateStatus(active.id, over.id);
  };

  const createRequest = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    setCreating(true);
    try {
      const selectedService = services.find(s => s.id === form.service_template_id);
      const res = await fetch(`${API}/orders`, {
        method: 'POST', headers: jhdrs(),
        body: JSON.stringify({
          title: form.title,
          request_type: 'service_request',
          description: form.description || '',
          priority: form.priority,
          service_template_id: form.service_template_id || null,
          service_name: selectedService?.name || null,
          client_id: form.client_id || null,
          status: 'Open',
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Request created');
      setShowModal(false);
      setForm({ title: '', service_template_id: '', client_id: '', priority: 'medium', description: '' });
      fetchData();
    } catch { toast.error('Failed to create'); }
    finally { setCreating(false); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <RefreshCw size={18} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Toolbar ── */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ marginRight: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)' }}>Operations Board</span>
          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{filtered.length} total</span>
            <span style={{ fontSize: 11, color: '#3b82f6' }}>{openCount} active</span>
            {unassigned > 0 && <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>{unassigned} unassigned</span>}
            {breachedCount > 0 && <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{breachedCount} SLA breached</span>}
          </div>
        </div>
        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input className="input-field" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28, width: 220, height: 32, fontSize: 12 }} />
        </div>

        {/* Priority filter */}
        <div style={{ display: 'flex', gap: 3 }}>
          {PRI_LABELS.map(p => (
            <button key={p} onClick={() => setPriFilter(priFilter === p ? '' : p)}
              style={{
                padding: '3px 8px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                border: '1px solid', textTransform: 'capitalize',
                borderColor: priFilter === p ? PRI[p] : 'var(--border)',
                background: priFilter === p ? `${PRI[p]}18` : 'transparent',
                color: priFilter === p ? PRI[p] : 'var(--tx-3)',
              }}>
              {p}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {[{ v: 'kanban', icon: LayoutGrid, label: 'Board' }, { v: 'table', icon: List, label: 'Table' }].map(({ v, icon: Icon, label }, i) => (
            <button key={v} onClick={() => { setView(v); localStorage.setItem('requests_view', v); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12, fontWeight: 600,
                background: view === v ? 'var(--red)' : 'var(--bg-elevated)',
                color: view === v ? '#fff' : 'var(--tx-3)',
                border: 'none', cursor: 'pointer',
                borderRight: i === 0 ? '1px solid var(--border)' : 'none',
              }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <button onClick={() => fetchData()} className="btn-ghost btn-sm" style={{ gap: 4 }}>
          <RefreshCw size={12} /> Refresh
        </button>
        <button className="btn-primary btn-sm" onClick={() => setShowModal(true)} style={{ gap: 4 }}>
          <Plus size={13} /> New
        </button>
      </div>

      {/* ── Incoming Unassigned Banner ── */}
      {unassigned > 0 && (
        <div style={{
          padding: '10px 24px', background: '#f59e0b0d', borderBottom: '1px solid #f59e0b30',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: '#f59e0b', fontWeight: 600, flex: 1 }}>
            {unassigned} incoming request{unassigned > 1 ? 's' : ''} need{unassigned === 1 ? 's' : ''} assignment
          </span>
          <button onClick={() => { setPriFilter(''); setStageFilter('Open'); setView('table'); localStorage.setItem('requests_view', 'table'); }} className="btn-ghost btn-sm" style={{ fontSize: 11, color: '#f59e0b', borderColor: '#f59e0b40' }}>
            View unassigned
          </button>
        </div>
      )}

      {/* ── Board / Table ── */}
      <div style={{ flex: 1, overflow: view === 'kanban' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {orders.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 32, opacity: 0.4 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)' }}>No requests yet</div>
            <div style={{ fontSize: 13, color: 'var(--tx-3)', maxWidth: 380, textAlign: 'center' }}>
              Client service requests and internal orders will appear here. Create one manually or wait for clients to submit theirs.
            </div>
            <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> New Request</button>
          </div>
        ) : view === 'kanban' ? (
          <DndContext sensors={sensors} onDragStart={({ active }) => setActiveId(active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '14px 20px', display: 'flex', gap: 10 }}>
              {STAGES.map(stage => {
                const stageOrders = byStage[stage] || [];
                return (
                  <div key={stage} style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
                    {/* Column header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px', marginBottom: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLORS[stage], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>{stage}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--tx-3)', background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                        {stageOrders.length}
                      </span>
                    </div>
                    {/* Column body */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                      <DroppableColumn stage={stage} isEmpty={stageOrders.length === 0}>
                        {stageOrders.map(o => (
                          <DraggableOrder key={o.id} order={o} onOpen={() => setSelected(o)} />
                        ))}
                      </DroppableColumn>
                    </div>
                  </div>
                );
              })}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeDrag && <OrderCard order={activeDrag} ghost />}
            </DragOverlay>
          </DndContext>
        ) : (
          /* Table view */
          <div style={{ padding: 16, overflow: 'auto' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Code', 'Title', 'Client', 'Service', 'Status', 'Priority', 'Assignee', 'SLA', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--tx-3)' }}>No orders match your filters</td></tr>
                  ) : filtered.map(o => (
                    <tr key={o.id} onClick={() => setSelected(o)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{o.order_code}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 500, color: 'var(--tx-1)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={o.requester_name} size={20} />
                          <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{o.requester_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {o.service_name && <span style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 4, background: 'var(--bg)', color: 'var(--tx-3)', border: '1px solid var(--border)' }}>{o.service_name}</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}><StagePill stage={o.status} /></td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <PriorityDot priority={o.priority} />
                          <span style={{ fontSize: 11.5, color: 'var(--tx-2)', textTransform: 'capitalize' }}>{o.priority}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {o.editor_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar name={o.editor_name} size={20} />
                            <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{o.editor_name}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}><SlaTag deadline={o.sla_deadline} /></td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <AssignDropdown orderId={o.id} currentEditorId={o.editor_id} teamMembers={teamMembers} onAssign={assignOrder} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── New Request Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 460, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>New Request</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Title *</label>
                <input className="input-field" placeholder="Request title..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Client</label>
                <select className="input-field" value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name || c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Service</label>
                <select className="input-field" value={form.service_template_id} onChange={e => setForm(p => ({ ...p, service_template_id: e.target.value }))}>
                  <option value="">Select service...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Priority</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PRI_LABELS.map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, priority: p }))}
                      style={{
                        flex: 1, padding: '6px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                        border: '1px solid', textTransform: 'capitalize',
                        borderColor: form.priority === p ? PRI[p] : 'var(--border)',
                        background: form.priority === p ? `${PRI[p]}18` : 'transparent',
                        color: form.priority === p ? PRI[p] : 'var(--tx-3)',
                      }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Description</label>
                <textarea className="input-field" rows={3} placeholder="Describe the request..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={createRequest} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Panel ── */}
      {selected && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }} onClick={() => setSelected(null)} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: 400, height: '100vh',
            background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
            overflowY: 'auto', zIndex: 401, animation: 'slideRight 0.2s ease both',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{selected.order_code}</span>
                  <StagePill stage={selected.status} />
                  <SlaTag deadline={selected.sla_deadline} />
                </div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: 'var(--tx-1)' }}>{selected.title}</h3>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)', padding: 4 }}><X size={16} /></button>
            </div>

            {/* Body */}
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Status selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Status</label>
                <select className="input-field" value={selected.status} onChange={e => updateStatus(selected.id, e.target.value)}>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Client + Service */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Client</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Avatar name={selected.requester_name} size={22} />
                    <span style={{ fontSize: 12.5, color: 'var(--tx-1)' }}>{selected.requester_name}</span>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Service</label>
                  <span style={{ fontSize: 12.5, color: 'var(--tx-1)' }}>{selected.service_name || '—'}</span>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Priority</label>
                <div style={{ display: 'flex', gap: 5 }}>
                  {PRI_LABELS.map(p => (
                    <button key={p} onClick={() => {
                      setSelected(prev => ({ ...prev, priority: p }));
                      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, priority: p } : o));
                    }} style={{
                      padding: '3px 9px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: '1px solid', textTransform: 'capitalize',
                      borderColor: selected.priority === p ? PRI[p] : 'var(--border)',
                      background: selected.priority === p ? `${PRI[p]}18` : 'transparent',
                      color: selected.priority === p ? PRI[p] : 'var(--tx-3)',
                    }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Assignee</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selected.editor_name ? (
                    <>
                      <Avatar name={selected.editor_name} size={28} />
                      <span style={{ fontSize: 13, color: 'var(--tx-1)', flex: 1 }}>{selected.editor_name}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, flex: 1 }}>Unassigned</span>
                  )}
                  <AssignDropdown orderId={selected.id} currentEditorId={selected.editor_id} teamMembers={teamMembers} onAssign={(id, uid, name) => {
                    assignOrder(id, uid, name);
                    setSelected(prev => ({ ...prev, editor_id: uid, editor_name: name }));
                  }} />
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  ['Created', selected.created_at],
                  ['Picked', selected.picked_at],
                  ['Delivered', selected.delivered_at],
                ].map(([lbl, val]) => (
                  <div key={lbl}>
                    <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{lbl}</label>
                    <span style={{ fontSize: 12, color: 'var(--tx-1)' }}>{fmt(val)}</span>
                  </div>
                ))}
              </div>

              {/* Linked project */}
              {selected.project_id && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>Linked Project</label>
                  <button onClick={() => navigate(`/projects/${selected.project_id}`)} className="btn-ghost btn-sm" style={{ fontSize: 11, gap: 4 }}>
                    <ExternalLink size={11} /> View Project
                  </button>
                </div>
              )}

              {/* Description */}
              {selected.description && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Description</label>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.6, background: 'var(--bg)', padding: '10px 12px', borderRadius: 7 }}>
                    {selected.description}
                  </p>
                </div>
              )}

              {/* Cancel button */}
              {selected.status !== 'Canceled' && selected.status !== 'Closed' && selected.status !== 'Delivered' && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button onClick={async () => {
                    if (!window.confirm('Are you sure you want to cancel this request?')) return;
                    try {
                      await fetch(`${API}/orders/${selected.id}/cancel`, {
                        method: 'POST', headers: jhdrs(),
                        body: JSON.stringify({ reason: 'Canceled by admin' }),
                      });
                      toast.success('Request canceled');
                      setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'Canceled' } : o));
                      setSelected(null);
                      fetchData();
                    } catch { toast.error('Failed to cancel request'); }
                  }} style={{
                    width: '100%', padding: '8px 0', borderRadius: 7, border: '1px solid #ef444440',
                    background: '#ef444410', color: '#ef4444', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <X size={13} /> Cancel Request
                  </button>
                  <button onClick={async () => {
                    if (!window.confirm('Permanently delete this request? This cannot be undone.')) return;
                    try {
                      await fetch(`${API}/orders/${selected.id}`, {
                        method: 'DELETE', headers: jhdrs(),
                      });
                      toast.success('Request deleted');
                      setOrders(prev => prev.filter(o => o.id !== selected.id));
                      setSelected(null);
                      fetchData();
                    } catch { toast.error('Failed to delete request'); }
                  }} style={{
                    width: '100%', padding: '8px 0', borderRadius: 7, border: '1px solid #ef4444',
                    background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <Trash2 size={13} /> Delete Request
                  </button>
                </div>
              )}

              {/* Messages */}
              <OrderComments orderId={selected.id} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

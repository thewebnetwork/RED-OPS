/**
 * Orders.js — Operator Queue View
 *
 * Simple table view of orders for operators monitoring their queue.
 * NOT the same as Requests.js (admin kanban with full CRUD) or
 * MyRequests.js (client portal view). All three are role-based views
 * of the same backend entity (orders.py).
 *
 * Routes: /queue, /all-requests
 * Roles: Administrator, Operator (via ModeRoute gate)
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, X, Inbox, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const jhdrs = () => ({ Authorization: `Bearer ${tok()}`, 'Content-Type': 'application/json' });

// Canonical order status set (see SettingsHub → Statuses section).
// Matches OrderDetail.js and Requests.js kanban stages.
const STATUS_OPTIONS = ['Open', 'In Progress', 'Pending', 'Delivered', 'Closed', 'Canceled'];

const QUEUE_OPTIONS = [
  { value: 'ACCOUNT_MANAGER', label: 'Account Manager' },
  { value: 'VIDEO_EDITING', label: 'Video Editing' },
  { value: 'LONG_FORM_EDITING', label: 'Long Form Editing' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'COPYWRITING', label: 'Copywriting' },
  { value: 'EMAIL_MARKETING', label: 'Email Marketing' },
  { value: 'WEB_UPDATES', label: 'Web Updates' },
];

const STATUS_COLORS = {
  'Open':         { color: '#3b82f6', bg: '#3b82f618' },
  'In Progress':  { color: '#f59e0b', bg: '#f59e0b18' },
  'Pending':      { color: '#a855f7', bg: '#a855f718' },
  'Delivered':    { color: '#22c55e', bg: '#22c55e18' },
  'Closed':       { color: '#606060', bg: '#60606020' },
  'Canceled':     { color: '#ef4444', bg: '#ef444418' },
};

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || { color: 'var(--tx-3)', bg: 'var(--bg-elevated)' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 6,
      background: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

// Valid next-status transitions (no self-transitions, no backward jumps)
const NEXT_STATUSES = {
  'Open':        ['In Progress'],
  'In Progress': ['Pending', 'Delivered'],
  'Pending':     ['In Progress', 'Delivered'],
  'Delivered':   ['Closed'],
};

// Status → action endpoint mapping (matches Requests.js L492)
const STATUS_ENDPOINTS = {
  'In Progress': { endpoint: 'pick',              body: {} },
  'Pending':     { endpoint: 'submit-for-review', body: {} },
  'Delivered':   { endpoint: 'deliver',            body: { resolution_notes: '' } },
  'Closed':      { endpoint: 'close',              body: { reason: 'Completed' } },
};

function StatusSelect({ orderId, currentStatus, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const ref = useRef(null);
  const c = STATUS_COLORS[currentStatus] || { color: 'var(--tx-3)', bg: 'var(--bg-elevated)' };
  const nextOptions = NEXT_STATUSES[currentStatus] || [];

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleSelect = async (newStatus) => {
    setOpen(false);
    const mapping = STATUS_ENDPOINTS[newStatus];
    if (!mapping) return;
    setUpdating(true);
    try {
      await fetch(`${API}/orders/${orderId}/${mapping.endpoint}`, {
        method: 'POST', headers: jhdrs(), body: JSON.stringify(mapping.body),
      });
      toast.success(`Status → ${newStatus}`);
      onUpdate();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  if (nextOptions.length === 0) return <StatusPill status={currentStatus} />;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        disabled={updating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 600, padding: '3px 8px 3px 9px', borderRadius: 6,
          background: c.bg, color: c.color, border: `1px solid ${c.color}44`,
          cursor: updating ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          opacity: updating ? 0.6 : 1, transition: 'opacity .15s, box-shadow .15s',
        }}
      >
        {currentStatus} <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 500,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.35)', minWidth: 150, padding: 4,
        }}>
          {nextOptions.map(s => {
            const sc = STATUS_COLORS[s] || { color: 'var(--tx-2)', bg: 'var(--bg-elevated)' };
            return (
              <div key={s}
                onClick={e => { e.preventDefault(); e.stopPropagation(); handleSelect(s); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                  borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: sc.color,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = sc.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color }} />
                {s}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const queueLabel = (key) => {
  if (!key) return '—';
  const found = QUEUE_OPTIONS.find(q => q.value === key);
  return found ? found.label : key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export default function Orders() {
  const { user } = useAuth();
  const isOperator = ['Administrator', 'Admin', 'Operator'].includes(user?.role);
  const location = useLocation();
  const isAllRequests = location.pathname === '/all-requests';
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', assigned_queue_key: '', q: '' });

  useEffect(() => { fetchOrders(); }, [filters]); // eslint-disable-line

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.assigned_queue_key && filters.assigned_queue_key !== 'all') params.append('assigned_queue_key', filters.assigned_queue_key);
      if (filters.q) params.append('q', filters.q);
      const res = await axios.get(`${API}/orders?${params.toString()}`);
      setOrders(res.data);
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => setFilters({ status: '', assigned_queue_key: '', q: '' });
  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0, letterSpacing: '-0.03em' }}>
          {isAllRequests ? 'All Requests' : 'My Queue'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--tx-3)', marginTop: 4 }}>
          {orders.length} request{orders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
        padding: '14px 16px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 10,
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
          <input
            placeholder="Search by code, title, or service..."
            value={filters.q}
            onChange={e => setFilters(p => ({ ...p, q: e.target.value }))}
            style={{
              width: '100%', padding: '7px 10px 7px 30px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-1)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
          style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-2)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Queue filter */}
        <select
          value={filters.assigned_queue_key}
          onChange={e => setFilters(p => ({ ...p, assigned_queue_key: e.target.value }))}
          style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-2)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">All Queues</option>
          {QUEUE_OPTIONS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-3)', fontSize: 13, cursor: 'pointer' }}
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div className="spinner-ring" />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <Inbox size={36} style={{ color: 'var(--tx-3)', marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: 'var(--tx-3)', margin: '0 0 12px' }}>No requests found</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="btn btn-ghost btn-sm">Clear filters</button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Request', 'Service', 'Status', 'Queue', 'Client', 'Assigned', 'Created'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left', fontSize: 10.5,
                      fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase',
                      letterSpacing: '.06em', whiteSpace: 'nowrap',
                      background: 'var(--bg-elevated)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={order.id}
                    style={{ borderBottom: idx < orders.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={`/requests/${order.id}`} style={{ textDecoration: 'none' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--tx-3)', display: 'block' }}>
                          {order.order_code}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>
                          {order.title}
                        </span>
                      </Link>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: order.service_name ? 'var(--tx-2)' : 'var(--tx-3)' }}>
                      {order.service_name || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isOperator ? (
                        <StatusSelect orderId={order.id} currentStatus={order.status} onUpdate={fetchOrders} />
                      ) : (
                        <StatusPill status={order.status} />
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {order.assigned_queue_key ? (
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 6,
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                          color: 'var(--tx-2)', whiteSpace: 'nowrap',
                        }}>
                          {queueLabel(order.assigned_queue_key)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--tx-3)', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--tx-2)' }}>
                      {order.client_name || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: order.editor_name ? 'var(--tx-2)' : 'var(--tx-3)' }}>
                      {order.editor_name || 'Unassigned'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>
                      {order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

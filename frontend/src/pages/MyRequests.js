import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import {
  Inbox,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Filter,
  ArrowUpRight,
  X,
  Plus,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CANCELLABLE_STATUSES = ['New', 'Open', 'Submitted', 'In Progress', 'Pending', 'Pending Review'];

const STATUS_CONFIG = {
  'New':            { color: '#3b82f6', bg: '#3b82f618', label: 'New' },
  'Open':           { color: '#3b82f6', bg: '#3b82f618', label: 'Open' },
  'Submitted':      { color: '#3b82f6', bg: '#3b82f618', label: 'Submitted' },
  'In Progress':    { color: '#a855f7', bg: '#a855f718', label: 'In Progress' },
  'Pending':        { color: '#f97316', bg: '#f9731618', label: 'Pending' },
  'Pending Review': { color: '#f59e0b', bg: '#f59e0b18', label: 'Pending Review' },
  'Delivered':      { color: '#22c55e', bg: '#22c55e18', label: 'Delivered' },
  'Closed':         { color: '#606060', bg: '#60606018', label: 'Closed' },
  'Canceled':       { color: '#ef4444', bg: '#ef444418', label: 'Canceled' },
};

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['New'];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function StatCard({ value, label, color = 'var(--tx-1)' }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 5 }}>{label}</div>
    </div>
  );
}

export default function MyRequests() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Cancel state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNotes, setCancelNotes] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [cancelReasons, setCancelReasons] = useState([]);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMyRequests();
    fetchCancelReasons();
  }, []); // eslint-disable-line

  const fetchMyRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await axios.get(`${API}/orders/my-requests`);
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.items || data?.orders || [];
      setOrders(list);
    } catch {
      toast.error('Failed to load your requests');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCancelReasons = async () => {
    try {
      const res = await axios.get(`${API}/orders/cancellation-reasons`);
      setCancelReasons(res.data.reasons || []);
    } catch {
      setCancelReasons(['No longer needed', 'Changed my mind', 'Found another solution', 'Other']);
    }
  };

  const openCancel = (order) => {
    setCancelTarget(order);
    setCancelReason('');
    setCancelNotes('');
    setCancelOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelReason) { toast.error('Please select a reason'); return; }
    if (cancelReason === 'Other' && !cancelNotes.trim()) {
      toast.error('Please add a note for "Other"');
      return;
    }
    setCanceling(true);
    const tid = cancelTarget._id || cancelTarget.id;
    try {
      await axios.post(`${API}/orders/${tid}/cancel`, {
        reason: cancelReason,
        notes: cancelNotes.trim() || null,
      });
      toast.success('Request canceled');
      setCancelOpen(false);
      setOrders(prev => prev.map(o =>
        (o._id || o.id) === tid ? { ...o, status: 'Canceled' } : o
      ));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel request');
    } finally {
      setCanceling(false);
    }
  };

  const q = search.toLowerCase();
  const filtered = orders.filter(o => {
    const matchSearch = !q ||
      o.order_code?.toLowerCase().includes(q) ||
      o.title?.toLowerCase().includes(q) ||
      o.service_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: orders.length,
    open: orders.filter(o => ['New', 'Open', 'Submitted'].includes(o.status)).length,
    inProgress: orders.filter(o => ['In Progress', 'Pending', 'Pending Review'].includes(o.status)).length,
    done: orders.filter(o => ['Delivered', 'Closed'].includes(o.status)).length,
  };

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner-ring" />
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0, letterSpacing: '-0.03em' }}>My Requests</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>Track all your submitted service requests</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => fetchMyRequests(true)} className="btn-ghost btn-sm" style={{ gap: 5 }} disabled={refreshing}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <Link to="/services" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} />
            New Request
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard value={counts.total}      label="Total Requests" />
        <StatCard value={counts.open}       label="Open"           color="#3b82f6" />
        <StatCard value={counts.inProgress} label="In Progress"    color="#a855f7" />
        <StatCard value={counts.done}       label="Completed"      color="#22c55e" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by code or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px 7px 30px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-1)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Status filter */}
        <div style={{ position: 'relative' }}>
          <Filter size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 30px 7px 28px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-2)',
              fontSize: 13, cursor: 'pointer', outline: 'none', appearance: 'none',
            }}
          >
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_CONFIG).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '64px 24px', textAlign: 'center',
        }}>
          <Inbox size={40} style={{ color: 'var(--tx-3)', marginBottom: 14 }} />
          <p style={{ fontSize: 14, color: 'var(--tx-3)', margin: '0 0 16px' }}>
            {orders.length === 0
              ? "You haven't submitted any requests yet."
              : 'No requests match your filters.'}
          </p>
          {orders.length === 0 && (
            <Link to="/services" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} />
              Submit Your First Request
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(order => {
            const oid = order._id || order.id;
            const canCancel = CANCELLABLE_STATUSES.includes(order.status);
            return (
              <div key={oid} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
                transition: 'border-color .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Status bar accent */}
                <div style={{
                  width: 3, alignSelf: 'stretch', borderRadius: 3, flexShrink: 0,
                  background: STATUS_CONFIG[order.status]?.color || 'var(--tx-3)',
                }} />

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--tx-3)' }}>
                      {order.order_code}
                    </span>
                    <StatusPill status={order.status} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>
                    {order.service_name || order.category_name || 'Request'}
                    {' · '}
                    {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {canCancel && (
                    <button
                      onClick={() => openCancel(order)}
                      title="Cancel request"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--tx-3)', padding: 6, borderRadius: 6, display: 'flex',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#ef444418'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx-3)'; e.currentTarget.style.background = 'none'; }}
                    >
                      <X size={15} />
                    </button>
                  )}
                  <Link
                    to={`/requests/${oid}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--tx-2)', textDecoration: 'none', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.color = 'var(--tx-1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--tx-2)'; }}
                  >
                    <Eye size={13} />
                    View
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setCancelOpen(false)}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
            padding: '28px', width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,.5)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Cancel Request</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 22 }}>
              Cancel <strong style={{ color: 'var(--tx-2)' }}>{cancelTarget?.title}</strong>? The team will be notified. This cannot be undone.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 6 }}>
                Reason <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-1)',
                  fontSize: 13, outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="">Select a reason...</option>
                {cancelReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)', display: 'block', marginBottom: 6 }}>
                Notes {cancelReason === 'Other' ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: 'var(--tx-3)' }}>(optional)</span>}
              </label>
              <textarea
                rows={3}
                placeholder="Add any additional context..."
                value={cancelNotes}
                onChange={e => setCancelNotes(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 7, color: 'var(--tx-1)',
                  fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--red)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelOpen(false)}
                disabled={canceling}
                className="btn btn-ghost"
              >
                Keep Request
              </button>
              <button
                onClick={handleCancel}
                disabled={canceling || !cancelReason}
                style={{
                  padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: canceling || !cancelReason ? '#ef444440' : '#ef4444',
                  color: '#fff', border: 'none', cursor: canceling || !cancelReason ? 'not-allowed' : 'pointer',
                  transition: 'all .15s',
                }}
              >
                {canceling ? 'Canceling...' : 'Cancel Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

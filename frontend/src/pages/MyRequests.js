/**
 * MyRequests — Client request tracking with full status timeline
 *
 * Features:
 *   • KPI strip (Total, Open, In Progress, Completed)
 *   • Search + status filter
 *   • Request cards with visual status stepper (timestamps per stage)
 *   • Cancel modal with reason selection
 *   • Empty state with CTA to services
 */
import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import {
  Inbox, Search, Eye, Clock, CheckCircle2, AlertCircle, XCircle,
  Filter, ArrowUpRight, X, Plus, RefreshCw, Package, ArrowRight,
  FileText, Loader2, ChevronRight, Circle, Truck, MessageSquare,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const CANCELLABLE_STATUSES = ['New', 'Open', 'Submitted', 'In Progress', 'Pending', 'Pending Review'];

const STATUS_CONFIG = {
  'New':            { color: '#3b82f6', bg: '#3b82f618', icon: Circle,        label: 'New' },
  'Open':           { color: '#3b82f6', bg: '#3b82f618', icon: Circle,        label: 'Open' },
  'Submitted':      { color: '#3b82f6', bg: '#3b82f618', icon: Circle,        label: 'Submitted' },
  'In Progress':    { color: '#a855f7', bg: '#a855f718', icon: Loader2,       label: 'In Progress' },
  'Pending':        { color: '#f97316', bg: '#f9731618', icon: MessageSquare, label: 'In Review' },
  'Pending Review': { color: '#f59e0b', bg: '#f59e0b18', icon: Eye,           label: 'Review' },
  'Delivered':      { color: '#22c55e', bg: '#22c55e18', icon: Truck,         label: 'Delivered' },
  'Closed':         { color: '#606060', bg: '#60606018', icon: CheckCircle2,  label: 'Closed' },
  'Canceled':       { color: '#ef4444', bg: '#ef444418', icon: XCircle,       label: 'Canceled' },
};

// Timeline steps in order
const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Submitted',   statuses: ['New', 'Open', 'Submitted'], tsField: 'created_at' },
  { key: 'progress',  label: 'In Progress', statuses: ['In Progress'],              tsField: 'picked_at' },
  { key: 'review',    label: 'In Review',   statuses: ['Pending', 'Pending Review'], tsField: 'review_started_at' },
  { key: 'delivered', label: 'Delivered',    statuses: ['Delivered', 'Closed'],      tsField: 'delivered_at' },
];

function getStepIndex(status) {
  if (['Canceled'].includes(status)) return -1;
  if (['New', 'Open', 'Submitted'].includes(status)) return 0;
  if (['In Progress'].includes(status)) return 1;
  if (['Pending', 'Pending Review'].includes(status)) return 2;
  if (['Delivered', 'Closed'].includes(status)) return 3;
  return 0;
}

function fmtDate(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtRelative(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(isoStr);
}

// ── Status Pill ──
function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['New'];
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ── Status Timeline Stepper ──
function StatusTimeline({ order }) {
  const currentStep = getStepIndex(order.status);
  const isCanceled = order.status === 'Canceled';

  if (isCanceled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 2px' }}>
        <XCircle size={14} style={{ color: '#ef4444' }} />
        <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
          Canceled {order.canceled_at ? `· ${fmtDateTime(order.canceled_at)}` : ''}
        </span>
        {order.cancellation_reason && (
          <span style={{ fontSize: 11, color: 'var(--tx-3)', marginLeft: 4 }}>
            — {order.cancellation_reason}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '12px 0 2px' }}>
      {TIMELINE_STEPS.map((step, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent = idx === currentStep;
        const ts = order[step.tsField];

        const dotColor = isComplete ? '#22c55e' : isCurrent ? STATUS_CONFIG[order.status]?.color || '#3b82f6' : 'var(--border)';
        const lineColor = isComplete ? '#22c55e' : 'var(--border)';

        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: idx < TIMELINE_STEPS.length - 1 ? 1 : 'none' }}>
            {/* Step dot + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
              <div style={{
                width: isCurrent ? 22 : 16, height: isCurrent ? 22 : 16,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isComplete || isCurrent ? dotColor : 'transparent',
                border: `2px solid ${dotColor}`,
                transition: 'all .2s',
              }}>
                {isComplete && <CheckCircle2 size={10} style={{ color: '#fff' }} />}
                {isCurrent && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <span style={{
                fontSize: 10, fontWeight: isCurrent ? 700 : 500, marginTop: 4,
                color: isComplete ? '#22c55e' : isCurrent ? dotColor : 'var(--tx-3)',
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
              {ts && (isComplete || isCurrent) && (
                <span style={{ fontSize: 9, color: 'var(--tx-3)', marginTop: 1 }}>
                  {fmtDate(ts)}
                </span>
              )}
            </div>

            {/* Connector line */}
            {idx < TIMELINE_STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, background: lineColor,
                marginBottom: ts ? 20 : 14, minWidth: 20,
                transition: 'background .2s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Request Card ──
function RequestCard({ order, onCancel }) {
  const navigate = useNavigate();
  const oid = order._id || order.id;
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['New'];

  return (
    <div
      className="request-card"
      onClick={() => navigate(`/requests/${oid}`)}
      style={{
        '--card-accent': cfg.color,
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        overflow: 'hidden', cursor: 'pointer',
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: cfg.color }} />

      <div style={{ padding: '16px 20px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--tx-3)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
                {order.order_code}
              </span>
              <StatusPill status={order.status} />
              {order.priority && order.priority !== 'Normal' && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: order.priority === 'Urgent' ? '#ef444418' : order.priority === 'High' ? '#f9731618' : '#3b82f618',
                  color: order.priority === 'Urgent' ? '#ef4444' : order.priority === 'High' ? '#f97316' : '#3b82f6',
                }}>
                  {order.priority}
                </span>
              )}
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)', margin: 0, lineHeight: 1.3 }}>
              {order.title}
            </h3>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {canCancel && (
              <button
                className="icon-btn-danger"
                onClick={() => onCancel(order)}
                title="Cancel request"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--tx-3)', padding: 6, borderRadius: 6, display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
            <button
              onClick={() => navigate(`/requests/${oid}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: `${cfg.color}15`, border: 'none',
                color: cfg.color, cursor: 'pointer', transition: 'all .15s',
              }}
            >
              View <ArrowUpRight size={12} />
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--tx-3)', marginBottom: 2 }}>
          {order.service_name && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Package size={11} /> {order.service_name}
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> {fmtRelative(order.created_at)}
          </span>
          {order.editor_name && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Assigned: <strong style={{ color: 'var(--tx-2)' }}>{order.editor_name}</strong>
            </span>
          )}
        </div>

        {/* Status Timeline */}
        <StatusTimeline order={order} />
      </div>
    </div>
  );
}

// ── Main Page ──
export default function MyRequests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Cancel state
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNotes, setCancelNotes] = useState('');
  const [canceling, setCanceling] = useState(false);
  const [cancelReasons, setCancelReasons] = useState([]);

  useEffect(() => { fetchMyRequests(); fetchCancelReasons(); }, []); // eslint-disable-line

  // Preview-as-client support
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;

  const fetchMyRequests = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const url = isPreview && previewClientId
        ? `${API}/orders?requester_id=${previewClientId}`
        : `${API}/orders/my-requests`;
      const res = await ax().get(url);
      const data = res.data;
      setOrders(Array.isArray(data) ? data : data?.items || data?.orders || []);
    } catch {
      toast.error('Failed to load your requests');
      setOrders([]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const fetchCancelReasons = async () => {
    try {
      const res = await ax().get(`${API}/orders/cancellation-reasons`);
      setCancelReasons(res.data.reasons || []);
    } catch { setCancelReasons(['No longer needed', 'Changed my mind', 'Found another solution', 'Other']); }
  };

  const openCancel = (order) => {
    setCancelTarget(order);
    setCancelReason('');
    setCancelNotes('');
    setCancelOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelReason) { toast.error('Please select a reason'); return; }
    if (cancelReason === 'Other' && !cancelNotes.trim()) { toast.error('Please add a note for "Other"'); return; }
    setCanceling(true);
    const tid = cancelTarget._id || cancelTarget.id;
    try {
      await ax().post(`${API}/orders/${tid}/cancel`, { reason: cancelReason, notes: cancelNotes.trim() || null });
      toast.success('Request canceled');
      setCancelOpen(false);
      setOrders(prev => prev.map(o => (o._id || o.id) === tid ? { ...o, status: 'Canceled', canceled_at: new Date().toISOString(), cancellation_reason: cancelReason } : o));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel request');
    } finally { setCanceling(false); }
  };

  const q = search.toLowerCase();
  const filtered = useMemo(() => orders.filter(o => {
    const matchSearch = !q || o.order_code?.toLowerCase().includes(q) || o.title?.toLowerCase().includes(q) || o.service_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  }), [orders, q, statusFilter]);

  const counts = useMemo(() => ({
    total: orders.length,
    open: orders.filter(o => ['New', 'Open', 'Submitted'].includes(o.status)).length,
    inProgress: orders.filter(o => ['In Progress', 'Pending', 'Pending Review'].includes(o.status)).length,
    done: orders.filter(o => ['Delivered', 'Closed'].includes(o.status)).length,
  }), [orders]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 80 }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>My Requests</h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>Track your submitted service requests in real-time</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => fetchMyRequests(true)}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: 'var(--tx-2)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button
            onClick={() => navigate('/services')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> New Request
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="metrics-grid-4">
        {[
          { label: 'Total Requests', value: counts.total, color: 'var(--tx-1)', icon: FileText },
          { label: 'Open', value: counts.open, color: '#3b82f6', icon: Circle },
          { label: 'In Progress', value: counts.inProgress, color: '#a855f7', icon: Loader2 },
          { label: 'Completed', value: counts.done, color: '#22c55e', icon: CheckCircle2 },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={18} style={{ color: k.color }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 3 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 350 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            type="text" placeholder="Search by code, title, or service..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 34px', background: 'var(--card)',
              border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: '9px 14px', background: 'var(--card)',
            border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-2)',
            fontSize: 13, cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Request Cards */}
      {filtered.length === 0 ? (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
          padding: '80px 24px', textAlign: 'center',
        }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid var(--border)' }}>
            <Inbox size={32} style={{ color: 'var(--tx-3)' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)', margin: '0 0 8px' }}>
            {orders.length === 0 ? 'No requests yet' : 'No matching requests'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 20px' }}>
            {orders.length === 0 ? 'Browse our services catalog and submit your first request.' : 'Try adjusting your search or filters.'}
          </p>
          {orders.length === 0 && (
            <button
              onClick={() => navigate('/services')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Browse Services
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(order => (
            <RequestCard
              key={order._id || order.id}
              order={order}
              onCancel={openCancel}
            />
          ))}
        </div>
      )}

      {/* Cancel Modal */}
      {cancelOpen && (
        <div className="modal-overlay" onClick={() => setCancelOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 460, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <XCircle size={18} style={{ color: '#ef4444' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Cancel Request</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 22 }}>
              Cancel <strong style={{ color: 'var(--tx-2)' }}>{cancelTarget?.title}</strong>? This cannot be undone.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reason *
              </label>
              <select
                value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)',
                  fontSize: 13, outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
                }}
              >
                <option value="">Select a reason...</option>
                {cancelReasons.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Notes {cancelReason === 'Other' ? '*' : '(optional)'}
              </label>
              <textarea
                rows={3} placeholder="Add any additional context..."
                value={cancelNotes} onChange={e => setCancelNotes(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)',
                  fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCancelOpen(false)} disabled={canceling}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: 'none', border: '1px solid var(--border)', color: 'var(--tx-2)', cursor: 'pointer',
                }}
              >
                Keep Request
              </button>
              <button
                onClick={handleCancel} disabled={canceling || !cancelReason}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: canceling || !cancelReason ? '#ef444460' : '#ef4444',
                  color: '#fff', border: 'none', cursor: canceling || !cancelReason ? 'not-allowed' : 'pointer',
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

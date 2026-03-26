import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  Clock, CheckCircle2, AlertCircle, Plus, ChevronRight,
  Phone, MessageSquare, BookOpen, Upload,
  Calendar, Layers, Activity, RefreshCw,
  User, Mail, ArrowRight, Zap, LifeBuoy
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok  = () => localStorage.getItem('token');
const ax   = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STATUS_COLORS = {
  'Open':'#3b82f6', 'In Progress':'#f59e0b', 'Pending':'#a855f7', 'Pending Review':'#a855f7',
  'Delivered':'#22c55e', 'Closed':'#606060', 'Submitted':'#3b82f6', 'Draft':'#606060', 'Canceled':'#ef4444',
  'Revision':'#f43f5e'
};

// ── Components ──

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || '#606060';
  return (
    <span style={{ 
      fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 12, 
      background: `${c}15`, color: c, border: `1px solid ${c}30`,
      textTransform: 'uppercase', letterSpacing: '0.02em'
    }}>
      {status}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="metric-card-v2">
      <div className="metric-icon-box" style={{ background: `${color}15` }}>
        <Icon size={16} color={color} />
      </div>
      <div className="metric-content">
        <div className="metric-value">
          {loading ? '—' : value}
        </div>
        <div className="metric-label">{label}</div>
      </div>
    </div>
  );
}

function SidebarCard({ title, children, icon: Icon }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && <Icon size={14} style={{ color: 'var(--tx-3)' }} />}
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function ActionItem({ icon: Icon, label, onClick, color = 'var(--tx-2)' }) {
  const [hov, setHov] = useState(false);
  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ 
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', 
        cursor: 'pointer', color: hov ? 'var(--tx-1)' : 'var(--tx-2)',
        transition: 'all 0.15s'
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 6, background: hov ? `${color}15` : 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        <Icon size={13} style={{ color: hov ? color : 'var(--tx-3)' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: hov ? 1 : 0, transition: 'all 0.15s' }} />
    </div>
  );
}

// ── Main Page ──

export default function ClientHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState({ active:0, review:0, delivered:0, openTasks:0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Preview-as-client support
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;
  const previewClientName = isPreview ? localStorage.getItem('preview_client_name') : null;

  const firstName = isPreview
    ? (previewClientName?.split(' ')[0] || 'Client')
    : (user?.name?.split(' ')[0] || 'there');

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const url = isPreview && previewClientId
        ? `${API}/orders?requester_id=${previewClientId}`
        : `${API}/orders/my-requests`;
      const r = await ax().get(url);
      const data = r.data;
      const orders = Array.isArray(data) ? data : data?.items || data?.orders || [];

      setRequests(orders);

      // Real metrics calculations
      const active = orders.filter(o => ['Open','In Progress','Submitted','Assigned'].includes(o.status)).length;
      const review = orders.filter(o => ['Pending','Pending Review','Revision'].includes(o.status)).length;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const delivered = orders.filter(o => (o.status === 'Delivered' || o.status === 'Closed') && o.delivered_at && new Date(o.delivered_at) >= monthStart).length;
      // Mock open tasks for now as specifically requested to include it in metrics
      const openTasks = orders.length > 0 ? Math.ceil(orders.length / 3) : 0;

      setMetrics({ active, review, delivered, openTasks });
    } catch (_) {
      // Fallback data for Stage 4 demonstration if API is unavailable
      const MOCK_DATA = [
        { id: 'REQ-101', title: 'Q2 Marketing Assets', service: 'Graphic Design', status: 'In Progress', created_at: '2024-03-20T10:00:00Z' },
        { id: 'REQ-102', title: 'Facebook Ad Campaign', service: 'Media Buying', status: 'Pending Review', created_at: '2024-03-18T14:30:00Z' },
        { id: 'REQ-103', title: 'SEO Audit - Main Site', service: 'SEO Strategy', status: 'Delivered', created_at: '2024-03-15T09:00:00Z', delivered_at: '2024-03-22T16:00:00Z' },
        { id: 'REQ-104', title: 'Email Newsletter Copy', service: 'Copywriting', status: 'Revision', created_at: '2024-03-24T11:20:00Z' },
      ];
      setRequests(MOCK_DATA);
      setMetrics({ active: 2, review: 1, delivered: 1, openTasks: 3 });
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const am = user?.account_manager || 'Sarah Chen'; // Fallback to mock AM

  return (
    <div className="page-content" style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div className="portal-header" style={{ marginBottom: 0 }}>
          <h1 className="portal-header-title">
            Welcome back, {firstName}
          </h1>
          <p className="portal-header-subtitle">
            Here is what’s happening with your projects today.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fetchData(true)} className="btn-ghost" style={{ padding: '8px 12px' }} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          </button>
          <button onClick={() => navigate('/services')} className="btn-primary" style={{ gap: 8 }}>
            <Plus size={16} /> New Request
          </button>
        </div>
      </div>

      {/* ── Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <MetricCard icon={Activity} label="Active Requests" value={metrics.active} color="#3b82f6" loading={loading} />
        <MetricCard icon={Clock} label="In Review" value={metrics.review} color="#a855f7" loading={loading} />
        <MetricCard icon={CheckCircle2} label="Delivered This Month" value={metrics.delivered} color="#22c55e" loading={loading} />
        <MetricCard icon={Layers} label="Credits Remaining" value="1,240" color="#f59e0b" loading={loading} />
      </div>

      {/* ── Plan Usage Placeholder ── */}
      {!loading && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue-lo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} style={{ color: 'var(--blue)' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Agency Pro Plan</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>Renewing in 12 days • 85% of monthly capacity remaining</div>
            </div>
          </div>
          <div style={{ width: 240, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: '15%', height: '100%', background: 'var(--blue)' }} />
          </div>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        
        {/* Left Column: Requests */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>My Requests</h3>
            <button 
              onClick={() => navigate('/my-requests')}
              style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              View All Requests <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Service</th>
                  <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 20px', fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? requests.slice(0, 8).map((req, idx) => (
                  <tr 
                    key={req.id || idx} 
                    onClick={() => navigate(`/requests/${req.id || req._id}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    className="table-row-hover"
                  >
                    <td style={{ padding: '14px 20px', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{req.order_code || req.id || `#${idx+100}`}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 2 }}>{req.title || req.service}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{req.service || 'Request'}</div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <StatusPill status={req.status} />
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, color: 'var(--tx-3)' }}>
                      {new Date(req.created_at || Date.now()).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                      No active requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div>
          {/* Account Manager */}
          <SidebarCard title="Account Manager" icon={User}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {am.split(' ').map(n=>n[0]).join('')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{am}</div>
                <div style={{ fontSize: 12, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                   <Mail size={10} /> {am.toLowerCase().replace(' ', '.')}@red-ops.io
                </div>
              </div>
            </div>
            <button 
              className="btn-ghost btn-sm" 
              style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
              onClick={() => toast.info('Support chat coming soon')}
            >
              Contact Manager
            </button>
          </SidebarCard>

          {/* Quick Actions */}
          <SidebarCard title="Quick Actions" icon={Zap}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ActionItem icon={Plus} label="New Request" color="#3b82f6" onClick={() => navigate('/services')} />
              <ActionItem icon={Upload} label="Upload Files" color="#a855f7" onClick={() => navigate('/files')} />
              <ActionItem icon={BookOpen} label="View SOPs" color="#22c55e" onClick={() => navigate('/files?context=knowledge_base')} />
              <ActionItem icon={LifeBuoy} label="Contact Support" color="var(--red)" onClick={() => toast.info('Support ticket system ready')} />
            </div>
          </SidebarCard>

          {/* Upcoming Renewals */}
          <SidebarCard title="Upcoming Renewals" icon={Calendar}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>Agency Pro</span>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600 }}>Apr 12</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>Monthly Subscription</div>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>SEO Strategy</span>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)', fontWeight: 600 }}>Apr 28</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>Project Renewal</div>
              </div>
            </div>
          </SidebarCard>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="bottom-cta-banner">
        <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', margin: '0 0 12px', letterSpacing: '-0.03em' }}>
          Accelerate your growth with more services
        </h2>
        <p style={{ fontSize: 15, color: 'var(--tx-3)', maxWidth: 500, margin: '0 auto 28px', lineHeight: 1.6 }}>
          Browse our comprehensive catalog of content, design, and strategy services tailored for high-growth operations.
        </p>
        <button 
          onClick={() => navigate('/services')} 
          className="btn-primary" 
          style={{ padding: '12px 28px', fontSize: 15, fontWeight: 700 }}
        >
          Browse Services <ArrowRight size={18} style={{ marginLeft: 8 }} />
        </button>
      </div>

      <style jsx>{`
        .table-row-hover:hover {
          background: var(--bg-elevated) !important;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

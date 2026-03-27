import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  FileText, Clock, CheckCircle2, AlertCircle, Plus, ChevronRight,
  Phone, MessageSquare, BookOpen, LifeBuoy, Upload, Star,
  ArrowUpRight, Calendar, Layers, Activity, TrendingUp, RefreshCw,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok  = () => localStorage.getItem('token');
const ax   = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STATUS_COLORS = {
  'Open':'#3b82f6', 'In Progress':'#f59e0b', 'Pending':'#a855f7', 'Pending Review':'#a855f7',
  'Delivered':'#22c55e', 'Closed':'#606060', 'Submitted':'#3b82f6', 'Draft':'#606060', 'Canceled':'#ef4444',
};

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] || '#606060';
  return <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:4, background:`${c}22`, color:c }}>{status}</span>;
}

function MetricCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ width:34, height:34, borderRadius:8, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize:24, fontWeight:700, color:'var(--tx-1)', letterSpacing:'-.03em', lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color:'var(--tx-3)', marginTop:4 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:'var(--tx-3)', marginTop:2, opacity:.7 }}>{sub}</div>}
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, color='var(--red)' }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:7, padding:'14px 8px', background: hov ? 'var(--bg-elevated)' : 'var(--bg-card)', border:`1px solid ${hov ? 'var(--border-hi)' : 'var(--border)'}`, borderRadius:10, cursor:'pointer', transition:'all .12s', flex:1 }}>
      <div style={{ width:34, height:34, background:`${color}22`, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span style={{ fontSize:11.5, color:'var(--tx-2)', fontWeight:500, textAlign:'center', lineHeight:1.3 }}>{label}</span>
    </button>
  );
}

export default function ClientHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics]   = useState({ active:0, review:0, delivered:0, total:0 });
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Preview-as-client support: use preview client's name and fetch their data
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;
  const previewClientName = isPreview ? localStorage.getItem('preview_client_name') : null;

  const firstName = isPreview
    ? (previewClientName?.split(' ')[0] || 'Client')
    : (user?.name?.split(' ')[0] || 'there');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // In preview mode, fetch the client's orders by requester_id; otherwise use my-requests
      const url = isPreview && previewClientId
        ? `${API}/orders?requester_id=${previewClientId}`
        : `${API}/orders/my-requests`;
      const r = await ax().get(url);
      const data = r.data;
      const orders = Array.isArray(data) ? data : data?.items || data?.orders || [];

      setRequests(orders);

      // Calculate real metrics from actual data
      const active    = orders.filter(o => ['Open','In Progress','Submitted'].includes(o.status)).length;
      const review    = orders.filter(o => ['Pending','Pending Review'].includes(o.status)).length;
      const now       = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const delivered = orders.filter(o => o.status === 'Delivered' && o.delivered_at && new Date(o.delivered_at) >= monthStart).length;
      const total     = orders.length;

      setMetrics({ active, review, delivered, total });
    } catch (_) {
      // If API fails, show zeros — not fake data
      setRequests([]);
      setMetrics({ active:0, review:0, delivered:0, total:0 });
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  // Derive account manager from user data (or from client record when available)
  const am = user?.account_manager || null;

  return (
    <div className="page-content" style={{ paddingBottom:40 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-.04em', marginBottom:4, color:'var(--tx-1)' }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ fontSize:13.5, color:'var(--tx-3)', margin:0 }}>
            {new Date().toLocaleDateString('en-CA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => fetchData(true)} className="btn-ghost btn-sm" style={{ gap:5 }} disabled={refreshing}>
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}/> Refresh
          </button>
          <button onClick={() => navigate('/services')} className="btn-primary" style={{ gap:6 }}>
            <Plus size={13}/> New Request
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid-4">
        <MetricCard icon={Clock}        label="Active Requests"     value={loading ? '—' : metrics.active}    color='#3b82f6' />
        <MetricCard icon={AlertCircle}  label="In Review"           value={loading ? '—' : metrics.review}    color='#f59e0b' />
        <MetricCard icon={CheckCircle2} label="Delivered This Month" value={loading ? '—' : metrics.delivered} color='#22c55e' />
        <MetricCard icon={FileText}     label="Total Requests"      value={loading ? '—' : metrics.total}     color='#a855f7' />
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-grid" style={{ marginBottom:24 }}>
        <QuickAction icon={Plus}       label="New Request"     onClick={() => navigate('/services')}    color='#3b82f6' />
        <QuickAction icon={FileText}   label="My Requests"     onClick={() => navigate('/my-requests')} color='var(--red)' />
        <QuickAction icon={BookOpen}   label="Resources"       onClick={() => navigate('/files?context=knowledge_base')} color='#a855f7' />
        <QuickAction icon={LifeBuoy}   label="Get Help"        onClick={() => navigate('/my-account')}  color='#22c55e' />
      </div>

      {/* Two column layout */}
      <div className="two-col">

        {/* Recent Requests */}
        <div className="card col-main" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:14, fontWeight:700, color:'var(--tx-1)' }}>Recent Requests</span>
            <button onClick={() => navigate('/my-requests')} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer' }}>
              View all <ChevronRight size={12}/>
            </button>
          </div>

          {loading ? (
            <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--tx-3)', fontSize:13 }}>Loading your requests...</div>
          ) : requests.length === 0 ? (
            <div style={{ padding:'40px 20px', textAlign:'center' }}>
              <Layers size={28} color="var(--tx-3)" style={{ marginBottom:8 }} />
              <p style={{ fontSize:14, color:'var(--tx-2)', fontWeight:600, margin:'0 0 4px' }}>No requests yet</p>
              <p style={{ fontSize:12, color:'var(--tx-3)', margin:'0 0 16px' }}>Submit your first request to get started.</p>
              <button onClick={() => navigate('/services')} className="btn-primary btn-sm" style={{ gap:5 }}>
                <Plus size={12}/> Browse Services
              </button>
            </div>
          ) : (
            <div>
              {requests.slice(0, 6).map((req, i) => {
                const code = req.order_code || req.id || `#${i+1}`;
                const title = req.title || req.service_name || req.service || 'Untitled Request';
                const status = req.status || 'Open';
                const date = req.created_at || req.date;
                return (
                  <div key={req._id || req.id || i}
                    onClick={() => navigate(`/requests/${req._id || req.id}`)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background .08s' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'var(--red)' }}>{code}</span>
                        <StatusPill status={status} />
                      </div>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--tx-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {title}
                      </div>
                    </div>
                    {date && (
                      <span style={{ fontSize:11, color:'var(--tx-3)', flexShrink:0 }}>
                        {new Date(date).toLocaleDateString('en-CA',{month:'short',day:'numeric'})}
                      </span>
                    )}
                    <ChevronRight size={12} color="var(--tx-3)" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="col-side" style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Account Info Card */}
          <div className="card" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:12 }}>Your Account</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { label:'Account', value: user?.name || '—' },
                { label:'Email',   value: user?.email || '—' },
                { label:'Plan',    value: user?.subscription_plan_name || 'Standard' },
                { label:'Role',    value: user?.account_type || user?.role || '—' },
              ].map(r => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                  <span style={{ color:'var(--tx-3)' }}>{r.label}</span>
                  <span style={{ color:'var(--tx-1)', fontWeight:500, textAlign:'right', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Account Manager Card */}
          {am ? (
            <div className="card" style={{ padding:'16px 18px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:12 }}>Your Account Manager</div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ width:40, height:40, borderRadius:9, background:'#22c55e22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#22c55e' }}>
                  {am.split(' ').map(n=>n[0]).join('')}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--tx-1)' }}>{am}</div>
                  <div style={{ fontSize:11, color:'var(--tx-3)' }}>Account Manager</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Request Summary Card */}
          {!loading && requests.length > 0 && (
            <div className="card" style={{ padding:'16px 18px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:12 }}>Request Breakdown</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {Object.entries(
                  requests.reduce((acc, r) => { const s = r.status || 'Open'; acc[s] = (acc[s]||0)+1; return acc; }, {})
                ).sort((a,b) => b[1]-a[1]).map(([status, count]) => {
                  const c = STATUS_COLORS[status] || '#606060';
                  const pct = Math.round((count / requests.length) * 100);
                  return (
                    <div key={status}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:11, color:'var(--tx-2)' }}>{status}</span>
                        <span style={{ fontSize:11, fontWeight:600, color:c }}>{count}</span>
                      </div>
                      <div style={{ height:4, background:'var(--bg-elevated)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:c, borderRadius:2, transition:'width .3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Deliverables */}
          {!loading && requests.filter(r => r.status === 'Delivered').length > 0 && (
            <div className="card" style={{ padding:'16px 18px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <CheckCircle2 size={13} color="#22c55e" /> Recent Deliverables
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {requests.filter(r => r.status === 'Delivered').slice(0, 4).map((r, i) => (
                  <div key={r.id || i} onClick={() => navigate(`/requests/${r._id || r.id}`)}
                    style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'6px 8px', borderRadius:6, transition:'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <div style={{ width:28, height:28, borderRadius:6, background:'#22c55e18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <CheckCircle2 size={12} color="#22c55e" />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--tx-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {r.title || r.service_name || 'Delivery'}
                      </div>
                      <div style={{ fontSize:10, color:'var(--tx-3)' }}>
                        {r.delivered_at ? new Date(r.delivered_at).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : 'Recently'}
                      </div>
                    </div>
                    <ChevronRight size={12} color="var(--tx-3)" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {!loading && requests.length > 0 && (
            <div className="card" style={{ padding:'16px 18px' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <Activity size={13} color="var(--tx-2)" /> Recent Activity
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {requests.slice(0, 5).map((r, i) => {
                  const isLast = i === Math.min(requests.length, 5) - 1;
                  return (
                    <div key={r.id || i} style={{ display:'flex', gap:10, paddingBottom: isLast ? 0 : 10 }}>
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:16 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background: STATUS_COLORS[r.status] || '#606060', flexShrink:0, marginTop:4 }} />
                        {!isLast && <div style={{ width:1, flex:1, background:'var(--border)', marginTop:4 }} />}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:'var(--tx-1)', fontWeight:500, lineHeight:1.3 }}>
                          {r.title || r.service_name || 'Request'} — <span style={{ color: STATUS_COLORS[r.status] || '#606060', fontWeight:600 }}>{r.status}</span>
                        </div>
                        <div style={{ fontSize:10, color:'var(--tx-3)', marginTop:2 }}>
                          {r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Help Card */}
          <div style={{ background:'linear-gradient(135deg, #c92a3e22, #c92a3e08)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--tx-1)', marginBottom:4 }}>Need something done?</div>
            <p style={{ fontSize:12, color:'var(--tx-3)', margin:'0 0 12px', lineHeight:1.5 }}>
              Browse our services and submit a new request in minutes.
            </p>
            <button onClick={() => navigate('/services')} className="btn-primary btn-sm" style={{ gap:5, width:'100%', justifyContent:'center' }}>
              Browse Services <ArrowUpRight size={12}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

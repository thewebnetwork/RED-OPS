import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle,
  Users, Layers, BarChart3, Download, RefreshCw, ArrowUp, ArrowDown, Minus, Loader2,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STAGE_COLORS  = { 'Submitted':'#3b82f6','Open':'#3b82f6','Assigned':'#a855f7','In Progress':'#f59e0b','Pending Review':'#06b6d4','Revision':'#ef4444','Delivered':'#22c55e','Closed':'#606060' };
const PRI_COLORS    = { Urgent:'#c92a3e', High:'#f59e0b', Normal:'#3b82f6', Low:'#606060' };

function StagePill({ stage }) {
  const c = STAGE_COLORS[stage] || 'var(--tx-3)';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: c + '22', color: c }}>{stage}</span>;
}
function PriPill({ priority }) {
  const c = PRI_COLORS[priority] || 'var(--tx-3)';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: c + '22', color: c }}>{priority}</span>;
}

const RANGES = ['Last 7 days', 'Last 30 days', 'This month', 'Last 3 months'];

function getRangeDates(range) {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from;
  if (range === 'Last 7 days') from = new Date(now - 7*86400*1000);
  else if (range === 'Last 30 days') from = new Date(now - 30*86400*1000);
  else if (range === 'This month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else from = new Date(now - 90*86400*1000);
  return { date_from: from.toISOString().split('T')[0], date_to: to };
}

export default function Reports() {
  const [range, setRange] = useState('Last 30 days');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // KPI data from /api/dashboard/v2/metrics
  const [kpi, setKpi] = useState(null);
  const [sla, setSla] = useState(null);

  // Chart data from /api/dashboard/v2/charts
  const [volumeData, setVolumeData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);

  // Recent orders from /api/dashboard/activity
  const [recentOrders, setRecentOrders] = useState([]);

  const fetchAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const days = range === 'Last 7 days' ? 7 : range === 'Last 30 days' ? 30 : range === 'This month' ? 30 : 90;

      const [metricsRes, volumeRes, categoryRes, activityRes] = await Promise.allSettled([
        axios.get(`${API}/dashboard/v2/metrics`),
        axios.get(`${API}/dashboard/v2/charts/ticket-volume-by-status`, { params: { days } }),
        axios.get(`${API}/dashboard/v2/charts/ticket-volume-by-category`, { params: { days, limit: 5 } }),
        axios.get(`${API}/dashboard/activity`, { params: { limit: 10 } }),
      ]);

      if (metricsRes.status === 'fulfilled') {
        const m = metricsRes.value.data;
        setKpi(m.kpi || null);
        setSla(m.sla || null);
      }
      if (volumeRes.status === 'fulfilled') {
        setVolumeData(volumeRes.value.data?.data || []);
      }
      if (categoryRes.status === 'fulfilled') {
        setCategoryData(categoryRes.value.data?.data || []);
      }
      if (activityRes.status === 'fulfilled') {
        const orders = activityRes.value.data?.activity || activityRes.value.data || [];
        setRecentOrders(Array.isArray(orders) ? orders.slice(0, 10) : []);
      }
    } catch (err) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, [range]);

  // Compute KPI cards from real data
  const kpiCards = kpi ? [
    { label: 'Open Requests',      value: kpi.open || 0,            icon: Layers,       color: '#3b82f6' },
    { label: 'In Progress',        value: kpi.in_progress || 0,     icon: Clock,        color: '#f59e0b' },
    { label: 'Pending Review',     value: kpi.pending_review || 0,  icon: AlertCircle,  color: '#06b6d4' },
    { label: 'Delivered',          value: kpi.delivered || 0,       icon: CheckCircle2, color: '#22c55e' },
    { label: 'Closed',             value: kpi.closed || 0,         icon: CheckCircle2, color: '#606060' },
  ] : [];

  const slaCards = sla ? [
    { label: 'SLA On Track', value: sla.on_track || 0, color: '#22c55e' },
    { label: 'SLA At Risk',  value: sla.at_risk || 0,  color: '#f59e0b' },
    { label: 'SLA Breached', value: sla.breached || 0, color: '#ef4444' },
  ] : [];

  // Volume chart: aggregate by date or use data as-is
  const volMax = volumeData.length > 0 ? Math.max(...volumeData.map(d => (d.open||0)+(d.in_progress||0)+(d.pending||0)+(d.delivered||0))) : 1;

  // Category data for top services
  const catMax = categoryData.length > 0 ? Math.max(...categoryData.map(d => d.count||0)) : 1;

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Analytics</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>Live snapshot of request performance and delivery health.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 7, padding: 3, gap: 2 }}>
            {RANGES.map(r => (
              <button key={r} onClick={() => setRange(r)}
                style={{ padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: range === r ? 'var(--red)' : 'transparent', color: range === r ? '#fff' : 'var(--tx-2)', transition: 'all .12s', whiteSpace: 'nowrap' }}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={() => fetchAll(true)} className="btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {kpiCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 26, fontWeight: 800, color: 'var(--tx-1)', lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* SLA Status */}
      {slaCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {slaCards.map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '16px 18px', borderLeft: `3px solid ${color}` }}>
              <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
              <p style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 800, color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Row 2: Volume chart + Category distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Volume Trend */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Ticket Volume Trend</h3>
          {volumeData.length === 0 ? (
            <p style={{ color: 'var(--tx-3)', fontSize: 13 }}>No volume data available for this period.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
              {volumeData.slice(-14).map((d, i) => {
                const total = (d.open||0) + (d.in_progress||0) + (d.pending||0) + (d.delivered||0);
                const label = d.date ? new Date(d.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : `Day ${i+1}`;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-2)' }}>{total}</span>
                    <div style={{ width: '100%', background: 'var(--red)', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (total / Math.max(volMax, 1)) * 90)}px`, opacity: i === volumeData.slice(-14).length - 1 ? 1 : 0.5, transition: 'height .3s' }} />
                    <span style={{ fontSize: 8, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Categories / Services */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Top Categories</h3>
          {categoryData.length === 0 ? (
            <p style={{ color: 'var(--tx-3)', fontSize: 13 }}>No category data available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {categoryData.map(({ category, count }) => (
                <div key={category} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 130, fontSize: 12, color: 'var(--tx-1)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category || 'Uncategorized'}</span>
                  <div style={{ flex: 1, height: 7, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / catMax) * 100}%`, background: 'var(--red)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)', width: 22, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Recent Requests</h3>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{recentOrders.length} shown</span>
        </div>
        {recentOrders.length === 0 ? (
          <p style={{ padding: 20, color: 'var(--tx-3)', fontSize: 13 }}>No recent activity.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(r => (
                <tr key={r.id || r._id || r.order_code}>
                  <td style={{ color: 'var(--red)', fontWeight: 700, fontSize: 11 }}>{r.order_code || '—'}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{r.title || '—'}</td>
                  <td><StagePill stage={r.status || '—'} /></td>
                  <td><PriPill priority={r.priority || 'Normal'} /></td>
                  <td style={{ fontSize: 12, color: 'var(--tx-2)' }}>{r.editor_name || r.assignee_name || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--tx-2)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, Clock, CheckCircle2, AlertCircle, Layers, Download,
  RefreshCw, Loader2, FileText, ChevronRight, ArrowLeft, Table2,
  BarChart3, PieChart as PieIcon, Shield, Users, Tag, Zap,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STAGE_COLORS = { Submitted:'#3b82f6', Open:'#3b82f6', Assigned:'#a855f7', 'In Progress':'#f59e0b', 'Pending Review':'#06b6d4', Revision:'#ef4444', Delivered:'#22c55e', Closed:'#606060' };
const PRI_COLORS   = { Urgent:'#c92a3e', High:'#f59e0b', Normal:'#3b82f6', Low:'#606060' };
const CHART_COLORS = ['#E11D48','#3b82f6','#f59e0b','#22c55e','#a855f7','#06b6d4','#ef4444','#f97316'];
const RANGES = ['Last 7 days','Last 30 days','This month','Last 3 months'];

function Pill({ text, colorMap }) {
  const c = (colorMap && colorMap[text]) || 'var(--tx-3)';
  return <span style={{ fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:5,background:c+'22',color:c }}>{text}</span>;
}

function getRangeDays(range) {
  if (range === 'Last 7 days') return 7;
  if (range === 'Last 30 days') return 30;
  if (range === 'This month') return 30;
  return 90;
}

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

/* ── Custom recharts tooltip ─────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:8,padding:'8px 12px',boxShadow:'0 4px 12px rgba(0,0,0,.25)' }}>
      <p style={{ margin:0,fontSize:11,fontWeight:700,color:'var(--tx-1)',marginBottom:4 }}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{ margin:0,fontSize:11,color:p.color||'var(--tx-2)' }}>{p.name}: <b>{p.value}</b></p>
      ))}
    </div>
  );
}

/* ── REPORT CATEGORY ICONS ────────────────────────────────────────────── */
const CAT_ICON = { Volume: BarChart3, Aging: Clock, Performance: TrendingUp, SLA: Shield, Distribution: PieIcon, Escalation: Zap, Workflow: Layers };

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
export default function Reports() {
  const [range, setRange] = useState('Last 30 days');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Overview data (dashboard endpoints)
  const [kpi, setKpi] = useState(null);
  const [sla, setSla] = useState(null);
  const [volumeData, setVolumeData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // Canned reports
  const [availableReports, setAvailableReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // View mode: 'overview' or 'report'
  const [view, setView] = useState('overview');

  /* ── Fetch overview data ──────────────────────────────────────────────── */
  const fetchOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const days = getRangeDays(range);
      const [metricsRes, volumeRes, categoryRes, activityRes] = await Promise.allSettled([
        ax().get(`${API}/dashboard/v2/metrics`),
        ax().get(`${API}/dashboard/v2/charts/ticket-volume-by-status`, { params: { days } }),
        ax().get(`${API}/dashboard/v2/charts/ticket-volume-by-category`, { params: { days, limit: 6 } }),
        ax().get(`${API}/dashboard/activity`, { params: { limit: 10 } }),
      ]);
      if (metricsRes.status === 'fulfilled') { setKpi(metricsRes.value.data?.kpi||null); setSla(metricsRes.value.data?.sla||null); }
      if (volumeRes.status === 'fulfilled') setVolumeData(volumeRes.value.data?.data||[]);
      if (categoryRes.status === 'fulfilled') setCategoryData(categoryRes.value.data?.data||[]);
      if (activityRes.status === 'fulfilled') {
        const o = activityRes.value.data?.activity || activityRes.value.data || [];
        setRecentOrders(Array.isArray(o) ? o.slice(0,10) : []);
      }
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [range]);

  /* ── Fetch available canned reports ───────────────────────────────────── */
  const fetchReports = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/reports/available`);
      setAvailableReports(r.data || []);
    } catch { /* silently fall back to no reports */ }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchReports(); }, [fetchReports]);

  /* ── Run a canned report ──────────────────────────────────────────────── */
  const runReport = async (report) => {
    setActiveReport(report);
    setView('report');
    setReportLoading(true);
    setReportData(null);
    try {
      const dates = getRangeDates(range);
      const r = await ax().post(`${API}/reports/${report.id}/generate`, dates);
      setReportData(r.data);
    } catch (err) {
      toast.error('Failed to generate report');
      setReportData({ total_rows: 0, columns: [], data: [], summary: {} });
    } finally { setReportLoading(false); }
  };

  /* ── CSV export ────────────────────────────────────────────────────────── */
  const exportCSV = async () => {
    if (!activeReport) return;
    try {
      const dates = getRangeDates(range);
      const r = await ax().post(`${API}/reports/${activeReport.id}/export/csv`, dates, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeReport.id}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
  };

  /* ── KPI cards ─────────────────────────────────────────────────────────── */
  const kpiCards = kpi ? [
    { label:'Open Requests', value:kpi.open||0, icon:Layers, color:'#3b82f6' },
    { label:'In Progress', value:kpi.in_progress||0, icon:Clock, color:'#f59e0b' },
    { label:'Pending Review', value:kpi.pending_review||0, icon:AlertCircle, color:'#06b6d4' },
    { label:'Delivered', value:kpi.delivered||0, icon:CheckCircle2, color:'#22c55e' },
    { label:'Closed', value:kpi.closed||0, icon:CheckCircle2, color:'#606060' },
  ] : [];

  const slaCards = sla ? [
    { label:'SLA On Track', value:sla.on_track||0, color:'#22c55e' },
    { label:'SLA At Risk', value:sla.at_risk||0, color:'#f59e0b' },
    { label:'SLA Breached', value:sla.breached||0, color:'#ef4444' },
  ] : [];

  /* ── Volume chart data transform for recharts ──────────────────────────── */
  const volChart = volumeData.slice(-14).map((d, i) => ({
    date: d.date ? new Date(d.date).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : `Day ${i+1}`,
    Open: d.open||0,
    'In Progress': d.in_progress||0,
    Pending: d.pending||0,
    Delivered: d.delivered||0,
  }));

  /* ── Category data for pie chart ────────────────────────────────────────── */
  const pieData = categoryData.map((d) => ({ name: d.category||'Other', value: d.count||0 }));

  if (loading) {
    return (
      <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)' }}>
        <Loader2 size={24} className="spin" style={{ color:'var(--tx-3)' }} />
      </div>
    );
  }

  /* ── REPORT DETAIL VIEW ─────────────────────────────────────────────────── */
  if (view === 'report') {
    return (
      <div style={{ flex:1,overflowY:'auto',background:'var(--bg)',padding:'24px 28px' }}>
        {/* Back + title */}
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:20 }}>
          <button onClick={()=>{ setView('overview'); setActiveReport(null); setReportData(null); }}
            style={{ background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',color:'var(--tx-2)',padding:0 }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:20,fontWeight:700,color:'var(--tx-1)',margin:0 }}>{activeReport?.name}</h1>
            <p style={{ margin:'2px 0 0',fontSize:12,color:'var(--tx-3)' }}>{activeReport?.description}</p>
          </div>
          {reportData && reportData.total_rows > 0 && (
            <button onClick={exportCSV} className="btn-ghost btn-sm" style={{ display:'flex',alignItems:'center',gap:5 }}>
              <Download size={13} /> Export CSV
            </button>
          )}
        </div>

        {/* Date range pills */}
        <div style={{ display:'flex',gap:2,background:'var(--bg-elevated)',borderRadius:7,padding:3,marginBottom:20,width:'fit-content' }}>
          {RANGES.map(r => (
            <button key={r} onClick={()=>{ setRange(r); if(activeReport) runReport(activeReport); }}
              style={{ padding:'4px 10px',borderRadius:5,fontSize:11,fontWeight:600,cursor:'pointer',border:'none',background:range===r?'var(--red)':'transparent',color:range===r?'#fff':'var(--tx-2)',transition:'all .12s',whiteSpace:'nowrap' }}>
              {r}
            </button>
          ))}
        </div>

        {reportLoading ? (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:60 }}>
            <Loader2 size={24} className="spin" style={{ color:'var(--tx-3)' }} />
          </div>
        ) : reportData ? (
          <>
            {/* Summary cards */}
            {reportData.summary && Object.keys(reportData.summary).length > 0 && (
              <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginBottom:20 }}>
                {Object.entries(reportData.summary).map(([k,v]) => {
                  if (typeof v === 'object') return null;
                  const label = k.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
                  return (
                    <div key={k} className="card" style={{ padding:'14px 16px' }}>
                      <span style={{ fontSize:10,color:'var(--tx-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em' }}>{label}</span>
                      <p style={{ margin:'6px 0 0',fontSize:22,fontWeight:800,color:'var(--tx-1)',lineHeight:1 }}>
                        {typeof v === 'number' ? (v % 1 !== 0 ? v.toFixed(1) : v) : v}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chart for chartable reports */}
            {activeReport?.supports_charts && reportData.data?.length > 0 && (
              <div className="card" style={{ padding:20,marginBottom:20 }}>
                <h3 style={{ margin:'0 0 16px',fontSize:13,fontWeight:700,color:'var(--tx-1)' }}>Chart</h3>
                <ResponsiveContainer width="100%" height={220}>
                  {reportData.columns.includes('date') ? (
                    <AreaChart data={reportData.data.slice(-30)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize:10,fill:'var(--tx-3)' }} tickFormatter={v=>v?.slice(5)||v} />
                      <YAxis tick={{ fontSize:10,fill:'var(--tx-3)' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="count" stroke="#E11D48" fill="#E11D4830" strokeWidth={2} />
                    </AreaChart>
                  ) : reportData.columns.includes('age_bucket') || reportData.columns.includes('bucket') ? (
                    <BarChart data={
                      reportData.summary?.buckets
                        ? Object.entries(reportData.summary.buckets).map(([k,v])=>({name:k,count:v}))
                        : reportData.data.slice(0,10)
                    }>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey={reportData.summary?.buckets ? "name" : (reportData.columns.find(c=>c.includes('name'))||reportData.columns[0])} tick={{ fontSize:10,fill:'var(--tx-3)' }} />
                      <YAxis tick={{ fontSize:10,fill:'var(--tx-3)' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" fill="#E11D48" radius={[4,4,0,0]} />
                    </BarChart>
                  ) : (
                    <BarChart data={reportData.data.slice(0,10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey={reportData.columns.find(c=>c.includes('name'))||reportData.columns[0]} tick={{ fontSize:10,fill:'var(--tx-3)' }} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize:10,fill:'var(--tx-3)' }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey={reportData.columns.find(c=>c.includes('count'))||reportData.columns[reportData.columns.length-1]} fill="#E11D48" radius={[4,4,0,0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Data table */}
            <div className="card" style={{ padding:0,overflow:'hidden' }}>
              <div style={{ padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <h3 style={{ margin:0,fontSize:13,fontWeight:700,color:'var(--tx-1)' }}>Data ({reportData.total_rows} rows)</h3>
              </div>
              {reportData.data?.length === 0 ? (
                <p style={{ padding:20,color:'var(--tx-3)',fontSize:13 }}>No data for this period.</p>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {reportData.columns.map(c => (
                          <th key={c} style={{ textTransform:'capitalize' }}>{c.replace(/_/g,' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.slice(0,50).map((row,i) => (
                        <tr key={i}>
                          {reportData.columns.map(c => (
                            <td key={c} style={{ fontSize:12 }}>
                              {c === 'status' ? <Pill text={row[c]||'—'} colorMap={STAGE_COLORS} /> :
                               c === 'sla_state' ? <Pill text={row[c]||'—'} colorMap={{on_track:'#22c55e',at_risk:'#f59e0b',breached:'#ef4444'}} /> :
                               c.includes('hours') && typeof row[c] === 'number' ? `${row[c].toFixed(1)}h` :
                               c.includes('rate') && typeof row[c] === 'number' ? `${row[c].toFixed(1)}%` :
                               c.includes('_at') && row[c] ? new Date(row[c]).toLocaleDateString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) :
                               row[c] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {reportData.data.length > 50 && (
                    <p style={{ padding:'10px 18px',fontSize:11,color:'var(--tx-3)' }}>Showing 50 of {reportData.data.length} rows. Export CSV for full data.</p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  /* ── OVERVIEW VIEW ──────────────────────────────────────────────────────── */
  return (
    <div style={{ flex:1,overflowY:'auto',background:'var(--bg)',padding:'24px 28px' }}>
      {/* Header */}
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:700,color:'var(--tx-1)',margin:0 }}>Analytics</h1>
          <p style={{ margin:'3px 0 0',fontSize:13,color:'var(--tx-3)' }}>Live snapshot of request performance and delivery health.</p>
        </div>
        <div style={{ display:'flex',gap:8,alignItems:'center' }}>
          <div style={{ display:'flex',background:'var(--bg-elevated)',borderRadius:7,padding:3,gap:2 }}>
            {RANGES.map(r => (
              <button key={r} onClick={()=>setRange(r)}
                style={{ padding:'4px 10px',borderRadius:5,fontSize:11,fontWeight:600,cursor:'pointer',border:'none',background:range===r?'var(--red)':'transparent',color:range===r?'#fff':'var(--tx-2)',transition:'all .12s',whiteSpace:'nowrap' }}>
                {r}
              </button>
            ))}
          </div>
          <button onClick={()=>fetchOverview(true)} className="btn-ghost btn-sm" style={{ display:'flex',alignItems:'center',gap:5 }}>
            <RefreshCw size={13} className={refreshing?'spin':''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12,marginBottom:24 }}>
        {kpiCards.map(({ label,value,icon:Icon,color }) => (
          <div key={label} className="card" style={{ padding:'16px 18px' }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
              <span style={{ fontSize:11,color:'var(--tx-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em' }}>{label}</span>
              <div style={{ width:30,height:30,borderRadius:8,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <p style={{ margin:'10px 0 0',fontSize:26,fontWeight:800,color:'var(--tx-1)',lineHeight:1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* SLA Status */}
      {slaCards.length > 0 && (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24 }}>
          {slaCards.map(({ label,value,color }) => (
            <div key={label} className="card" style={{ padding:'16px 18px',borderLeft:`3px solid ${color}` }}>
              <span style={{ fontSize:11,color:'var(--tx-3)',fontWeight:600,textTransform:'uppercase' }}>{label}</span>
              <p style={{ margin:'8px 0 0',fontSize:28,fontWeight:800,color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts Row — Recharts! */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20 }}>
        {/* Volume Trend — Area Chart */}
        <div className="card" style={{ padding:20 }}>
          <h3 style={{ margin:'0 0 16px',fontSize:13,fontWeight:700,color:'var(--tx-1)' }}>Ticket Volume Trend</h3>
          {volChart.length === 0 ? (
            <p style={{ color:'var(--tx-3)',fontSize:13 }}>No volume data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={volChart}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E11D48" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E11D48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize:9,fill:'var(--tx-3)' }} />
                <YAxis tick={{ fontSize:9,fill:'var(--tx-3)' }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="Open" stackId="1" stroke="#3b82f6" fill="#3b82f620" />
                <Area type="monotone" dataKey="In Progress" stackId="1" stroke="#f59e0b" fill="#f59e0b20" />
                <Area type="monotone" dataKey="Delivered" stackId="1" stroke="#22c55e" fill="#22c55e20" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category Distribution — Pie Chart */}
        <div className="card" style={{ padding:20 }}>
          <h3 style={{ margin:'0 0 16px',fontSize:13,fontWeight:700,color:'var(--tx-1)' }}>Top Categories</h3>
          {pieData.length === 0 ? (
            <p style={{ color:'var(--tx-3)',fontSize:13 }}>No category data available.</p>
          ) : (
            <div style={{ display:'flex',alignItems:'center',gap:16 }}>
              <ResponsiveContainer width="50%" height={170}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1,display:'flex',flexDirection:'column',gap:6 }}>
                {pieData.map((d,i) => (
                  <div key={d.name} style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ width:8,height:8,borderRadius:2,background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0 }} />
                    <span style={{ fontSize:11,color:'var(--tx-2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{d.name}</span>
                    <span style={{ fontSize:11,fontWeight:700,color:'var(--tx-1)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Canned Reports Library */}
      {availableReports.length > 0 && (
        <div className="card" style={{ padding:0,overflow:'hidden',marginBottom:20 }}>
          <div style={{ padding:'14px 18px',borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ margin:0,fontSize:13,fontWeight:700,color:'var(--tx-1)' }}>Report Library</h3>
            <p style={{ margin:'2px 0 0',fontSize:11,color:'var(--tx-3)' }}>Generate detailed reports with data tables and CSV export.</p>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:0 }}>
            {availableReports.map((rpt) => {
              const CatIcon = CAT_ICON[rpt.category] || FileText;
              return (
                <button key={rpt.id} onClick={()=>runReport(rpt)}
                  style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 18px',background:'transparent',border:'none',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',width:'100%',transition:'background .1s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <div style={{ width:32,height:32,borderRadius:8,background:'var(--bg-elevated)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <CatIcon size={14} style={{ color:'var(--tx-2)' }} />
                  </div>
                  <div style={{ flex:1,overflow:'hidden' }}>
                    <p style={{ margin:0,fontSize:12,fontWeight:600,color:'var(--tx-1)' }}>{rpt.name}</p>
                    <p style={{ margin:'1px 0 0',fontSize:10,color:'var(--tx-3)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{rpt.description}</p>
                  </div>
                  <span style={{ fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:4,background:'var(--bg-elevated)',color:'var(--tx-3)',textTransform:'uppercase',flexShrink:0 }}>{rpt.category}</span>
                  <ChevronRight size={14} style={{ color:'var(--tx-3)',flexShrink:0 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Orders Table */}
      <div className="card" style={{ padding:0,overflow:'hidden' }}>
        <div style={{ padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <h3 style={{ margin:0,fontSize:13,fontWeight:700,color:'var(--tx-1)' }}>Recent Requests</h3>
          <span style={{ fontSize:11,color:'var(--tx-3)' }}>{recentOrders.length} shown</span>
        </div>
        {recentOrders.length === 0 ? (
          <p style={{ padding:20,color:'var(--tx-3)',fontSize:13 }}>No recent activity.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Created</th></tr>
            </thead>
            <tbody>
              {recentOrders.map(r => (
                <tr key={r.id||r._id||r.order_code}>
                  <td style={{ color:'var(--red)',fontWeight:700,fontSize:11 }}>{r.order_code||'—'}</td>
                  <td style={{ maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500 }}>{r.title||'—'}</td>
                  <td><Pill text={r.status||'—'} colorMap={STAGE_COLORS} /></td>
                  <td><Pill text={r.priority||'Normal'} colorMap={PRI_COLORS} /></td>
                  <td style={{ fontSize:12,color:'var(--tx-2)' }}>{r.editor_name||r.assignee_name||'—'}</td>
                  <td style={{ fontSize:12,color:'var(--tx-2)' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

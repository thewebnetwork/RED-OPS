import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle2, AlertCircle,
  Users, Layers, BarChart3, Download, RefreshCw, ArrowUp, ArrowDown, Minus,
} from 'lucide-react';

// ── Mock analytics data ───────────────────────────────────────────────────────
const KPI_CARDS = [
  { label: 'Active Requests',   value: '24',   delta: '+3',  up: true,  icon: Layers,       color: '#3b82f6' },
  { label: 'Avg. Delivery Days',value: '4.2d',  delta: '-0.8d', up: true, icon: Clock,       color: '#f59e0b' },
  { label: 'SLA Compliance',    value: '91%',  delta: '+2%', up: true,  icon: CheckCircle2, color: '#22c55e' },
  { label: 'Overdue Items',     value: '3',    delta: '-2',  up: true,  icon: AlertCircle,  color: '#ef4444' },
  { label: 'Active Clients',    value: '18',   delta: '+1',  up: true,  icon: Users,        color: '#a855f7' },
  { label: 'Requests This Month',value:'47',   delta: '+12', up: true,  icon: BarChart3,    color: '#06b6d4' },
];

const STAGE_DIST = [
  { stage: 'Submitted',     count: 4,  color: '#3b82f6' },
  { stage: 'Assigned',      count: 5,  color: '#a855f7' },
  { stage: 'In Progress',   count: 8,  color: '#f59e0b' },
  { stage: 'Pending Review',count: 4,  color: '#06b6d4' },
  { stage: 'Revision',      count: 2,  color: '#ef4444' },
  { stage: 'Delivered',     count: 18, color: '#22c55e' },
  { stage: 'Closed',        count: 6,  color: '#606060' },
];
const STAGE_TOTAL = STAGE_DIST.reduce((s, r) => s + r.count, 0);

const PRIORITY_DIST = [
  { label: 'Urgent', count: 5,  color: '#c92a3e' },
  { label: 'High',   count: 12, color: '#f59e0b' },
  { label: 'Normal', count: 18, color: '#3b82f6' },
  { label: 'Low',    count: 12, color: '#606060' },
];
const PRI_TOTAL = PRIORITY_DIST.reduce((s, r) => s + r.count, 0);

const VOLUME_DATA = [
  { month: 'Oct', count: 28 },
  { month: 'Nov', count: 34 },
  { month: 'Dec', count: 22 },
  { month: 'Jan', count: 39 },
  { month: 'Feb', count: 41 },
  { month: 'Mar', count: 47 },
];
const VOL_MAX = Math.max(...VOLUME_DATA.map(d => d.count));

const TOP_SERVICES = [
  { name: 'Video Editing',     count: 14, pct: 30 },
  { name: 'Graphic Design',    count: 11, pct: 23 },
  { name: 'Copywriting',       count: 9,  pct: 19 },
  { name: 'Meta Ads Setup',    count: 7,  pct: 15 },
  { name: 'Email Sequence',    count: 6,  pct: 13 },
];

const RECENT_ACTIVITY = [
  { id: 'RRG-00015', title: 'Burnham Strategy Presentation', stage: 'In Progress', priority: 'Urgent', assignee: 'Marcus Obi',  due: 'Mar 24', overdue: false },
  { id: 'RRG-00006', title: 'Coastal Living Feature Video',  stage: 'Revision',    priority: 'Urgent', assignee: 'Taryn P.',    due: 'Mar 21', overdue: true  },
  { id: 'RRG-00001', title: 'Thompson RE — April Ad Creative',stage:'In Progress', priority: 'Urgent', assignee: 'Taryn P.',    due: 'Mar 22', overdue: false },
  { id: 'RRG-00002', title: 'Dani K. Blog Post Series',      stage: 'Pending Review',priority:'High',  assignee: 'Sarah Chen',  due: 'Mar 28', overdue: false },
  { id: 'RRG-00005', title: 'Verde Cafe Meta Ads Q2',         stage: 'In Progress', priority: 'High',  assignee: 'Lucca R.',    due: 'Mar 26', overdue: false },
  { id: 'RRG-00010', title: 'TechStart Pitch Deck Redesign',  stage: 'Pending Review',priority:'Normal',assignee: 'Marcus Obi', due: 'Mar 29', overdue: false },
  { id: 'RRG-00013', title: 'Green Energy Blog Series',       stage: 'Delivered',   priority: 'Normal', assignee: 'Sarah Chen', due: 'Mar 27', overdue: false },
];

const STAGE_COLORS  = { 'Submitted':'#3b82f6','Assigned':'#a855f7','In Progress':'#f59e0b','Pending Review':'#06b6d4','Revision':'#ef4444','Delivered':'#22c55e','Closed':'#606060' };
const PRI_COLORS    = { Urgent:'#c92a3e', High:'#f59e0b', Normal:'#3b82f6', Low:'#606060' };

const RANGES = ['Last 7 days', 'Last 30 days', 'This month', 'Last 3 months'];

function StagePill({ stage }) {
  const c = STAGE_COLORS[stage] || 'var(--tx-3)';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: c + '22', color: c }}>{stage}</span>;
}
function PriPill({ priority }) {
  const c = PRI_COLORS[priority] || 'var(--tx-3)';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: c + '22', color: c }}>{priority}</span>;
}

export default function Reports() {
  const [range, setRange] = useState('Last 30 days');

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
          <button className="btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {KPI_CARDS.map(({ label, value, delta, up, icon: Icon, color }) => (
          <div key={label} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <p style={{ margin: '10px 0 6px', fontSize: 26, fontWeight: 800, color: 'var(--tx-1)', lineHeight: 1 }}>{value}</p>
            <span style={{ fontSize: 11, fontWeight: 600, color: up ? '#22c55e' : '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />} {delta} vs prev period
            </span>
          </div>
        ))}
      </div>

      {/* Row 2: Volume chart + Stage distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Monthly Volume Bar Chart */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Requests by Month</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 120 }}>
            {VOLUME_DATA.map(d => (
              <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-2)' }}>{d.count}</span>
                <div style={{ width: '100%', background: `var(--red)`, borderRadius: '4px 4px 0 0', height: `${(d.count / VOL_MAX) * 90}px`, opacity: d.month === 'Mar' ? 1 : 0.45, transition: 'height .3s' }} />
                <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stage Distribution */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Stage Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {STAGE_DIST.map(({ stage, count, color }) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 88, fontSize: 11, color: 'var(--tx-2)', flexShrink: 0 }}>{stage}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / STAGE_TOTAL) * 100}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-1)', width: 22, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Priority dist + Top services */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Priority */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Priority Breakdown</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {PRIORITY_DIST.map(({ label, count, color }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', padding: '12px 4px', background: color + '14', border: `1px solid ${color}30`, borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color }}>{count}</p>
                <p style={{ margin: '3px 0 0', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)' }}>{label}</p>
              </div>
            ))}
          </div>
          {/* Stacked bar */}
          <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden' }}>
            {PRIORITY_DIST.map(({ label, count, color }) => (
              <div key={label} style={{ width: `${(count / PRI_TOTAL) * 100}%`, background: color }} />
            ))}
          </div>
        </div>

        {/* Top Services */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Top Services</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TOP_SERVICES.map(({ name, count, pct }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 130, fontSize: 12, color: 'var(--tx-1)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <div style={{ flex: 1, height: 7, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'var(--red)', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--tx-3)', width: 22, textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Requests Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Recent Requests</h3>
          <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Showing {RECENT_ACTIVITY.length} of 47</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Title</th><th>Stage</th><th>Priority</th><th>Assignee</th><th>Due</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_ACTIVITY.map(r => (
              <tr key={r.id}>
                <td style={{ color: 'var(--red)', fontWeight: 700, fontSize: 11 }}>{r.id}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{r.title}</td>
                <td><StagePill stage={r.stage} /></td>
                <td><PriPill priority={r.priority} /></td>
                <td style={{ fontSize: 12, color: 'var(--tx-2)' }}>{r.assignee}</td>
                <td style={{ fontSize: 12, fontWeight: r.overdue ? 700 : 400, color: r.overdue ? '#ef4444' : 'var(--tx-1)' }}>
                  {r.overdue ? '⚠ ' : ''}{r.due}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

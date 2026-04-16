/**
 * FinanceDashboard — three-period KPIs + 12-month bar chart + weekly cash flow.
 * Reads from GET /api/finance/dashboard. Pure SVG charts (no chart lib).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, DollarSign, Target,
  Loader2, RefreshCw, ArrowUp, ArrowDown,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const fmt = (n) => `$${Math.round(n || 0).toLocaleString()}`;
const fmtSigned = (n) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;

export default function FinanceDashboard({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDash = useCallback(async () => {
    try {
      const { data: d } = await ax().get(`${API}/finance/dashboard`);
      setData(d);
    } catch { /* silent — caller already has fetchAll error toasts */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDash(); }, [fetchDash, refreshKey]);

  if (loading || !data) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: 'var(--tx-3)' }}>
        <Loader2 size={18} className="spin" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PeriodGrid month={data.month} quarter={data.quarter} ytd={data.ytd} />
      <MonthlyBars series={data.monthly_series} />
      <WeeklyCashFlow weeks={data.weekly_cash_flow} currentMonth={data.current_month} />
    </div>
  );
}

// ── Three-period KPI grid ────────────────────────────────────────────────────
function PeriodGrid({ month, quarter, ytd }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
      <PeriodCard label="This month"   data={month}   accent="var(--accent)" />
      <PeriodCard label="Quarter to date" data={quarter} accent="var(--blue)" />
      <PeriodCard label="Year to date" data={ytd}     accent="var(--purple)" />
    </div>
  );
}

function PeriodCard({ label, data, accent }) {
  const positive = (data.net || 0) >= 0;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
          background: positive ? 'var(--color-green-soft)' : 'var(--color-red-soft)',
          color: positive ? 'var(--green)' : 'var(--red-status)',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          {positive ? <ArrowUp size={10} /> : <ArrowDown size={10} />} {fmtSigned(data.net)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Stat icon={TrendingUp} color="var(--green)" label="Income" value={fmt(data.income)} />
        <Stat icon={TrendingDown} color="var(--red-status)" label="Expenses" value={fmt(data.expense)} />
      </div>

      {data.top_expense_category && (
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
          <span style={{ color: 'var(--tx-3)' }}>Largest expense</span>
          <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>
            {data.top_expense_category.category} · <span style={{ color: 'var(--red-status)' }}>{fmt(data.top_expense_category.amount)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, label, value }) {
  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>
        <Icon size={11} style={{ color }} /> {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

// ── 12-month bar chart with net line ─────────────────────────────────────────
function MonthlyBars({ series }) {
  const W = 760, H = 220, padL = 50, padR = 16, padT = 16, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxBar = Math.max(1, ...series.map(s => Math.max(s.income, s.expense)));
  const nets = series.map(s => s.net);
  const minNet = Math.min(0, ...nets);
  const maxNet = Math.max(0, ...nets);
  const netRange = (maxNet - minNet) || 1;

  const groupW = innerW / series.length;
  const barW = Math.max(4, (groupW - 6) / 2);

  const yBar = (v) => padT + innerH - (v / maxBar) * innerH;
  const yNet = (v) => padT + innerH - ((v - minNet) / netRange) * innerH;

  const linePath = series.map((s, i) => {
    const x = padL + groupW * i + groupW / 2;
    const y = yNet(s.net);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const monthLabel = (k) => {
    const [, m] = k.split('-');
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m, 10) - 1] || '';
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Income vs expenses (last 13 months)</span>
        <Legend />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 700 }}>
          {/* Y axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => {
            const y = padT + innerH - t * innerH;
            return (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 4" />
                <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--tx-3)">
                  ${Math.round(maxBar * t).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {series.map((s, i) => {
            const xGroup = padL + groupW * i;
            return (
              <g key={s.month}>
                <rect
                  x={xGroup + 2} y={yBar(s.income)}
                  width={barW} height={padT + innerH - yBar(s.income)}
                  fill="var(--green)" rx={2}
                />
                <rect
                  x={xGroup + 2 + barW + 2} y={yBar(s.expense)}
                  width={barW} height={padT + innerH - yBar(s.expense)}
                  fill="var(--red-status)" rx={2}
                />
                <text x={xGroup + groupW / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--tx-3)">
                  {monthLabel(s.month)}
                </text>
              </g>
            );
          })}

          {/* Net line overlay */}
          <path d={linePath} stroke="var(--accent)" strokeWidth="2" fill="none" />
          {series.map((s, i) => {
            const x = padL + groupW * i + groupW / 2;
            const y = yNet(s.net);
            return <circle key={s.month + '-pt'} cx={x} cy={y} r={2.5} fill="var(--accent)" />;
          })}
        </svg>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--tx-3)' }}>
      <Dot color="var(--green)" /> Income
      <Dot color="var(--red-status)" /> Expense
      <Dot color="var(--accent)" /> Net
    </div>
  );
}

function Dot({ color }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 4, verticalAlign: 'middle' }} />;
}

// ── Weekly cash flow for current month ───────────────────────────────────────
function WeeklyCashFlow({ weeks, currentMonth }) {
  if (!weeks || weeks.length === 0) {
    return null;
  }
  const max = Math.max(1, ...weeks.flatMap(w => [w.income, w.expense]));
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Cash flow this month</span>
        <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{currentMonth}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {weeks.map(w => (
          <div key={w.label} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 110px', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ color: 'var(--tx-3)', fontWeight: 600 }}>{w.label}</span>
            <Bar value={w.income} max={max} color="var(--green)" align="left" />
            <Bar value={w.expense} max={max} color="var(--red-status)" align="left" />
            <span style={{
              textAlign: 'right',
              fontWeight: 700,
              color: (w.income - w.expense) >= 0 ? 'var(--green)' : 'var(--red-status)',
            }}>
              {fmtSigned(w.income - w.expense)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bar({ value, max, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 18, background: 'var(--bg-elevated)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct}%`, background: color, transition: 'width 0.25s',
      }} />
      <span style={{
        position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
        fontSize: 10.5, fontWeight: 600, color: '#fff', mixBlendMode: 'difference',
      }}>{fmt(value)}</span>
    </div>
  );
}

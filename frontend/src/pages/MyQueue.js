import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, ChevronRight, DollarSign, TrendingUp, Calendar, Inbox,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STATUS_PILL = {
  draft:                 { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: 'Draft' },
  sent:                  { bg: 'rgba(59,130,246,0.15)',  fg: '#3b82f6', label: 'Sent' },
  acknowledged:          { bg: 'rgba(59,130,246,0.15)',  fg: '#3b82f6', label: 'Acknowledged' },
  'in-progress':         { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b', label: 'In Progress' },
  submitted:             { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b', label: 'Submitted' },
  'in-review':           { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b', label: 'In Review' },
  'revisions-requested': { bg: 'rgba(239,68,68,0.15)',   fg: '#ef4444', label: 'Revisions' },
  approved:              { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Approved' },
  paid:                  { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Paid' },
  closed:                { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: 'Closed' },
};

function StatusPill({ status }) {
  const cfg = STATUS_PILL[status] || STATUS_PILL.draft;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  );
}

function deadlineLabel(deadline) {
  if (!deadline) return '—';
  const dd = new Date(deadline);
  const now = new Date();
  const days = Math.ceil((dd - now) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: '#ef4444' };
  if (days === 0) return { text: 'today', color: '#f59e0b' };
  if (days === 1) return { text: 'tomorrow', color: '#f59e0b' };
  return { text: `${days} days`, color: 'var(--tx-3)' };
}

function BriefRow({ b, onOpen }) {
  const dl = deadlineLabel(b.deadline);
  const dlColor = typeof dl === 'object' ? dl.color : 'var(--tx-3)';
  const dlText = typeof dl === 'object' ? dl.text : dl;
  return (
    <div onClick={onOpen}
      style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color .12s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <strong style={{ fontSize: 13.5, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title || '(untitled)'}</strong>
          <StatusPill status={b.status} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--tx-3)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: dlColor }}>
            <Calendar size={11} /> {dlText}
          </span>
          {b.payment_amount != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <DollarSign size={11} /> {Number(b.payment_amount).toLocaleString()} {b.payment_currency || ''}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
    </div>
  );
}

function Section({ title, items, emptyText, navigate }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>
        {title} {items.length > 0 && <span style={{ color: 'var(--tx-2)' }}>· {items.length}</span>}
      </h3>
      {items.length === 0 ? (
        <div style={{ padding: 16, borderRadius: 8, border: '1px dashed var(--border)', textAlign: 'center', fontSize: 12, color: 'var(--tx-3)' }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(b => <BriefRow key={b.id} b={b} onOpen={() => navigate(`/my-queue/${b.id}`)} />)}
        </div>
      )}
    </div>
  );
}

export default function MyQueue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ active: [], submitted: [], recent: [], summary: {} });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ax().get(`${API}/my-queue`);
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load queue');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  const summary = data.summary || {};

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>My Queue</h1>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>Briefs assigned to you.</p>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <SummaryCard
          icon={DollarSign}
          color="#22c55e"
          label="Approved & due"
          value={`$${Number(summary.payment_due_approved || 0).toLocaleString()}`}
          hint="payment in flight"
        />
        <SummaryCard
          icon={TrendingUp}
          color="var(--accent)"
          label="Earned this month"
          value={`$${Number(summary.earned_this_month || 0).toLocaleString()}`}
          hint="paid briefs"
        />
        <SummaryCard
          icon={Inbox}
          color="#f59e0b"
          label="Active briefs"
          value={String(summary.active_count || 0)}
          hint="in progress"
        />
      </div>

      <Section title="Active" items={data.active || []} emptyText="No active briefs right now." navigate={navigate} />
      <Section title="Submitted (awaiting review)" items={data.submitted || []} emptyText="Nothing submitted." navigate={navigate} />
      <Section title="Recent (last 30 days)" items={data.recent || []} emptyText="No recent closes." navigate={navigate} />
    </div>
  );
}

function SummaryCard({ icon: Icon, color, label, value, hint }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, marginBottom: 8 }}>
        <Icon size={12} style={{ color }} /> {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

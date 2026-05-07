import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, DollarSign } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STATUS_PILL = {
  approved: { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Approved' },
  paid:     { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Paid' },
  closed:   { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: 'Closed' },
};

function StatusPill({ status }) {
  const cfg = STATUS_PILL[status] || { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: status };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

export default function MyPayments() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], ytd_total: 0, currency_note: '' });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ax().get(`${API}/my-payments`);
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load payments');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Payments</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>{data.currency_note || 'Closed and paid briefs.'}</p>
        </div>
        <div className="card" style={{ padding: '14px 22px', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <DollarSign size={16} style={{ color: '#22c55e' }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>YTD total</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1.2 }}>${Number(data.ytd_total || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {data.items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
            No paid or closed briefs yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                <th style={th}>Title</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                <th style={th}>Currency</th>
                <th style={th}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row, i) => (
                <tr key={row.brief_id || i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{row.title || '(untitled)'}</td>
                  <td style={td}><StatusPill status={row.status} /></td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                    ${Number(row.payment_amount || 0).toLocaleString()}
                  </td>
                  <td style={{ ...td, color: 'var(--tx-3)' }}>{row.payment_currency || '—'}</td>
                  <td style={{ ...td, color: 'var(--tx-3)' }}>{fmtDate(row.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const th = {
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--tx-3)',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  padding: '10px 14px',
};

const td = {
  padding: '10px 14px',
  color: 'var(--tx-1)',
};

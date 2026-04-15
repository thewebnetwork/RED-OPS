/**
 * StripePaymentsPanel — admin-only live view of recent Stripe charges.
 * Pulls from /api/finance/stripe/payments. If Stripe isn't connected,
 * renders a "Connect Stripe" nudge that links to /integrations.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, ExternalLink, Loader2, Link2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const fmt = (cents, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100);

export default function StripePaymentsPanel() {
  const [state, setState] = useState({ loading: true, connected: false, payments: [], total: 0, error: null });

  useEffect(() => {
    let cancel = false;
    ax().get(`${API}/finance/stripe/payments?limit=10`)
      .then(r => { if (!cancel) setState({
        loading: false,
        connected: !!r.data?.connected,
        payments: r.data?.payments || [],
        total: r.data?.total_cents_30d || 0,
        error: null,
      }); })
      .catch(err => {
        if (cancel) return;
        setState({ loading: false, connected: false, payments: [], total: 0,
          error: err.response?.data?.detail || 'Stripe lookup failed' });
      });
    return () => { cancel = true; };
  }, []);

  if (state.loading) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tx-3)', fontSize: 13 }}>
        <Loader2 size={14} className="spin" /> Loading Stripe…
      </div>
    );
  }

  if (!state.connected) {
    return (
      <div className="card" style={{
        padding: 18, marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <CreditCard size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Live payments from Stripe</div>
          <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>
            Connect your Stripe account to see recent charges and 30-day totals alongside your manual ledger.
          </div>
        </div>
        <Link
          to="/integrations?provider=stripe"
          className="btn-primary"
          style={{ gap: 6, padding: '8px 14px', fontSize: 13, textDecoration: 'none', flexShrink: 0 }}
        >
          <Link2 size={13} /> Connect Stripe
        </Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CreditCard size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>Live Stripe payments</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>
          <strong style={{ color: 'var(--green)', fontWeight: 700 }}>{fmt(state.total)}</strong> in the last 30 days
        </div>
      </div>

      {state.payments.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--tx-3)' }}>No recent successful charges.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {state.payments.map((p, i) => (
            <a
              key={p.id}
              href={p.receipt_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 90px 16px',
                alignItems: 'center', gap: 12,
                padding: '10px 2px',
                borderBottom: i === state.payments.length - 1 ? 'none' : '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.customer_name || p.customer_email || 'Stripe customer'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.description || p.customer_email || p.id}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', textAlign: 'right' }}>
                {p.created ? new Date(p.created * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', textAlign: 'right' }}>
                {fmt(p.amount, p.currency)}
              </div>
              <ExternalLink size={12} style={{ color: 'var(--tx-3)' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

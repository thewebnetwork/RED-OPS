import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CalendarDays, TrendingUp, MessageCircle, RefreshCw, LogOut } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');

const PHASE_STYLES = {
  onboarding: { bg: '#f59e0b18', color: '#f59e0b', label: 'Onboarding' },
  active:     { bg: '#A2182C18', color: '#A2182C', label: 'Active' },
  renewing:   { bg: '#3b82f618', color: '#3b82f6', label: 'Renewing' },
  offboarded: { bg: '#60606018', color: '#606060', label: 'Offboarded' },
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function formatTimestamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export default function ClientPortal() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/client-portal/data/me`, {
          headers: { Authorization: `Bearer ${tok()}` },
        });
        if (res.status === 404) { setNotFound(true); return; }
        if (res.status === 401) { logout(); return; }
        if (!res.ok) { setError('Something went wrong.'); return; }
        setData(await res.json());
      } catch { setError('Something went wrong.'); }
      finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line

  const firstName = user?.name?.split(' ')[0] || user?.email || 'there';

  if (loading) return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
        <div className="spinner-ring" />
      </div>
    </div>
  );

  if (error) return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: 'var(--tx-2)', marginBottom: '1rem' }}>{error}</p>
        <button onClick={() => window.location.reload()} style={btnStyle}>
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={pageStyle}>
      <Header firstName={firstName} onLogout={logout} />
      <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--tx-1)', marginBottom: '0.5rem' }}>
          Your portal is being set up
        </h2>
        <p style={{ color: 'var(--tx-2)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
          We're finishing up your account configuration. Your account manager will notify you when your portal is ready.
        </p>
      </div>
    </div>
  );

  const phase = PHASE_STYLES[data.status_phase] || PHASE_STYLES.onboarding;
  const perf = data.performance || {};

  return (
    <div style={pageStyle}>
      <Header firstName={firstName} onLogout={logout} />

      {/* Card 1 — Welcome */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>
            Hi {firstName}
          </h1>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            padding: '3px 10px', borderRadius: 20, background: phase.bg, color: phase.color,
          }}>
            {phase.label}
          </span>
        </div>
        <p style={{ color: 'var(--tx-2)', marginTop: 8, fontSize: '0.9rem' }}>
          {data.launched_at
            ? `Day ${data.days_since_launch} since launch`
            : 'Campaign not yet launched'}
        </p>
      </div>

      {/* Card 2 — Performance */}
      <div style={cardStyle}>
        <h2 style={cardTitleStyle}><TrendingUp size={18} style={{ color: '#A2182C' }} /> Your Performance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <StatBlock label="This Week" value={perf.appointments_this_week ?? 0} />
          <StatBlock label="This Month" value={perf.appointments_this_month ?? 0} />
          <StatBlock label="Total" value={perf.appointments_total ?? 0} accent />
        </div>
        {perf.last_updated_at && (
          <p style={{ fontSize: '0.75rem', color: 'var(--tx-3)', marginTop: '0.75rem' }}>
            Last updated: {formatTimestamp(perf.last_updated_at)}
          </p>
        )}
      </div>

      {/* Card 3 — Upcoming Appointments */}
      <div style={cardStyle}>
        <h2 style={cardTitleStyle}><CalendarDays size={18} style={{ color: '#97662D' }} /> Upcoming Appointments</h2>
        {(!data.upcoming_appointments || data.upcoming_appointments.length === 0) ? (
          <p style={{ color: 'var(--tx-3)', marginTop: '0.75rem', fontSize: '0.875rem' }}>
            No appointments booked yet. Your ISA will book these as leads come in.
          </p>
        ) : (
          <div style={{ marginTop: '0.75rem' }}>
            {data.upcoming_appointments.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0',
                borderBottom: i < data.upcoming_appointments.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--tx-2)', minWidth: 110 }}>
                  {formatDate(a.appointment_date)}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--tx-1)', flex: 1, fontWeight: 500 }}>
                  {a.lead_name}
                </span>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4,
                  background: a.lead_type === 'seller' ? '#a855f715' : '#3b82f615',
                  color: a.lead_type === 'seller' ? '#a855f7' : '#3b82f6',
                }}>
                  {a.lead_type}
                </span>
                {a.notes && <span style={{ fontSize: '0.75rem', color: 'var(--tx-3)' }}>— {a.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card 4 — Status Message */}
      <div style={cardStyle}>
        <h2 style={cardTitleStyle}><MessageCircle size={18} style={{ color: '#AEC6C8' }} /> Where We Are</h2>
        <p style={{ color: 'var(--tx-1)', marginTop: '0.75rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
          {data.status_message || 'Your account manager will post status updates here.'}
        </p>
      </div>
    </div>
  );
}

function Header({ firstName, onLogout }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Red Ribbon Group
      </div>
      <button onClick={onLogout} style={{
        background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.35rem 0.75rem',
        color: 'var(--tx-2)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <LogOut size={14} /> Sign Out
      </button>
    </div>
  );
}

function StatBlock({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 10, padding: '1rem',
      textAlign: 'center', border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: '2rem', fontWeight: 700, color: accent ? '#A2182C' : 'var(--tx-1)',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--tx-3)', marginTop: 6, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

const pageStyle = { maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' };
const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' };
const cardTitleStyle = { fontSize: '1rem', fontWeight: 600, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 };
const btnStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--tx-1)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 };

/**
 * TeamCalendarConnections — admin-only view of who on the team has
 * connected which external calendar. Sourced from
 * GET /api/calendar-sync/admin/team (admin-gated on the backend).
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

function relativeTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TeamCalendarConnections() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancel = false;
    ax().get(`${API}/calendar-sync/admin/team`)
      .then(r => { if (!cancel) setRows(Array.isArray(r.data) ? r.data : []); })
      .catch(e => { if (!cancel) setErr(e.response?.data?.detail || 'Failed to load'); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  const connectedCount = rows.filter(r => r.google || r.outlook).length;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Calendar size={16} style={{ color: 'var(--accent)' }} />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>Team calendar connections</h3>
        </div>
        {!loading && rows.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>
            {connectedCount} of {rows.length} connected
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 14px' }}>
        Each team member manages their own connection from Settings &rarr; Notifications &amp; Calendar.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 12 }}>
          <Loader2 size={13} className="spin" /> Loading…
        </div>
      ) : err ? (
        <div style={{ fontSize: 12, color: 'var(--red-status)' }}>{err}</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx-3)' }}>No team members.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(r => (
            <div
              key={r.user_id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </div>
                {r.email && (
                  <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 1 }}>{r.email}</div>
                )}
              </div>
              <Pill connected={r.google} label="Google" />
              <Pill connected={r.outlook} label="Outlook" />
              <span style={{ fontSize: 11, color: 'var(--tx-3)', minWidth: 70, textAlign: 'right' }}>
                {r.last_synced_at ? relativeTime(r.last_synced_at) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ connected, label }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
        background: connected ? 'var(--color-green-soft)' : 'var(--surface)',
        color: connected ? 'var(--green)' : 'var(--tx-3)',
        border: '1px solid var(--border)',
      }}
    >
      {connected && <CheckCircle2 size={11} />}
      {label}
    </span>
  );
}

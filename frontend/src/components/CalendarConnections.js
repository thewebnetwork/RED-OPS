/**
 * CalendarConnections — per-user Google Calendar + Outlook connect/disconnect.
 *
 * Drop into Settings (or anywhere). Fetches the current user's connection
 * state, opens the OAuth window, runs a manual pull-sync, and disconnects.
 *
 * If OAuth env vars aren't configured on the backend, /auth returns 503;
 * we surface a friendly toast and the connect button stays disabled.
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Calendar, RefreshCw, Trash2, Loader2, Link2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const PROVIDER_META = {
  google:  { label: 'Google Calendar', color: '#4285F4', initial: 'G' },
  outlook: { label: 'Outlook',         color: '#0078D4', initial: 'O' },
};

export default function CalendarConnections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // provider currently being acted on

  const refresh = useCallback(async () => {
    try {
      const { data } = await ax().get(`${API}/calendar-sync/connections`);
      setConnections(Array.isArray(data) ? data : []);
    } catch {
      // Endpoint might 404 in older backends — keep silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-fetch when the user lands back here from the OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('calendar_connected');
    const error = params.get('calendar_error');
    if (connected) {
      toast.success(`${PROVIDER_META[connected]?.label || connected} connected`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      refresh();
    } else if (error) {
      toast.error(`Calendar connect failed: ${decodeURIComponent(error)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refresh]);

  const handleConnect = async (provider) => {
    setBusy(provider);
    try {
      const { data } = await ax().get(`${API}/calendar-sync/${provider}/auth`);
      if (data.auth_url) window.location.href = data.auth_url;
    } catch (err) {
      const detail = err.response?.data?.detail || 'Connect failed';
      toast.error(detail);
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async (provider) => {
    setBusy(provider);
    try {
      const { data } = await ax().post(`${API}/calendar-sync/${provider}/sync`);
      toast.success(`Synced ${data.synced} events from ${PROVIDER_META[provider]?.label || provider}`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async (provider) => {
    if (!window.confirm(`Disconnect ${PROVIDER_META[provider]?.label || provider}? Synced events stay on your calendar until you remove them manually.`)) return;
    setBusy(provider);
    try {
      await ax().delete(`${API}/calendar-sync/${provider}`);
      toast.success(`${PROVIDER_META[provider]?.label || provider} disconnected`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Disconnect failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Calendar size={16} style={{ color: 'var(--accent)' }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>Calendar connections</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 16px' }}>
        Connect your own Google Calendar or Outlook to see your external events alongside RED OPS tasks.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 12 }}>
          <Loader2 size={13} className="spin" /> Loading…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {connections.map(c => {
            const meta = PROVIDER_META[c.provider] || { label: c.provider, color: 'var(--tx-2)', initial: '?' };
            const isBusy = busy === c.provider;
            return (
              <div
                key={c.provider}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: meta.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14,
                }}>{meta.initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{meta.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.connected
                      ? <>Connected as <strong style={{ color: 'var(--tx-2)' }}>{c.email || 'unknown'}</strong>{typeof c.event_count === 'number' && c.event_count > 0 ? ` · ${c.event_count} events synced` : ''}</>
                      : <>Not connected</>}
                  </div>
                </div>
                {c.connected ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleSync(c.provider)}
                      disabled={isBusy}
                      title="Pull events now"
                      style={btnGhost}
                    >
                      {isBusy ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                      Sync
                    </button>
                    <button
                      onClick={() => handleDisconnect(c.provider)}
                      disabled={isBusy}
                      title="Disconnect"
                      style={{ ...btnGhost, color: 'var(--red-status)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(c.provider)}
                    disabled={isBusy}
                    className="btn-primary"
                    style={{ gap: 5, padding: '7px 12px', fontSize: 12, flexShrink: 0 }}
                  >
                    {isBusy ? <Loader2 size={13} className="spin" /> : <Link2 size={13} />}
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '7px 10px', fontSize: 12, fontWeight: 600,
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--tx-2)', borderRadius: 8, cursor: 'pointer',
};

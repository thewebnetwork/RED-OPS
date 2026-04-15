/**
 * DriveConnections — per-user Google Drive connect/disconnect.
 * Same pattern as CalendarConnections but scoped to /drive-sync.
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { HardDrive, RefreshCw, Trash2, Loader2, Link2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

export default function DriveConnections() {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState(null);
  const [fileCount, setFileCount] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await ax().get(`${API}/drive-sync/connections`);
      const row = Array.isArray(data) ? data[0] : null;
      if (row?.connected) {
        setConnected(true);
        setEmail(row.email || null);
        setFileCount(row.file_count || 0);
        setLastSynced(row.last_synced_at || null);
      } else {
        setConnected(false);
        setEmail(null);
        setFileCount(null);
        setLastSynced(null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      const { data } = await ax().get(`${API}/drive-sync/google/auth`);
      if (data.auth_url) window.location.href = data.auth_url;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Connect failed');
    } finally { setBusy(false); }
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      const { data } = await ax().post(`${API}/drive-sync/google/sync`);
      toast.success(`Synced ${data.synced} Google Drive files`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sync failed');
    } finally { setBusy(false); }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Google Drive? Cached files will be removed from Drive.')) return;
    setBusy(true);
    try {
      await ax().delete(`${API}/drive-sync`);
      toast.success('Google Drive disconnected');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Disconnect failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <HardDrive size={16} style={{ color: 'var(--accent)' }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>Google Drive</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 14px' }}>
        Connect your Google Drive so those files appear alongside RED OPS files on the Drive page.
      </p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-3)', fontSize: 12 }}>
          <Loader2 size={13} className="spin" /> Loading…
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 10,
          border: '1px solid var(--border)', background: 'var(--bg-elevated)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: '#4285F4', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14,
          }}>G</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>Google Drive</div>
            <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {connected
                ? <>Connected as <strong style={{ color: 'var(--tx-2)' }}>{email || 'unknown'}</strong>{fileCount ? ` · ${fileCount} files cached` : ''}</>
                : 'Not connected'}
            </div>
          </div>
          {connected ? (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={handleSync} disabled={busy} style={btnGhost}>
                {busy ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} Sync
              </button>
              <button onClick={handleDisconnect} disabled={busy} style={{ ...btnGhost, color: 'var(--red-status)' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={busy}
              className="btn-primary"
              style={{ gap: 5, padding: '7px 12px', fontSize: 12, flexShrink: 0 }}
            >
              {busy ? <Loader2 size={13} className="spin" /> : <Link2 size={13} />}
              Connect
            </button>
          )}
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

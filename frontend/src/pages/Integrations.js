import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { X, CheckCircle, Key, ExternalLink, Loader2, Trash2, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const allIntegrations = [
  {
    id: 'ghl', name: 'GoHighLevel', category: 'CRM',
    description: 'Your primary acquisition & nurture CRM. Syncs contact status and pipeline stages.',
    icon: 'G', color: '#3b82f6', authType: 'api_key', keyLabel: 'GHL API Key',
    docsUrl: 'https://highlevel.stoplight.io/docs/integrations/0443d7d1a4bd0-overview',
  },
  {
    id: 'google_drive', name: 'Google Drive', category: 'Storage',
    description: 'Access and deliver files directly from Drive within requests and projects.',
    icon: 'D', color: '#4285f4', authType: 'oauth', oauthLabel: 'Sign in with Google',
  },
  {
    id: 'slack_webhook', name: 'Slack', category: 'Communication',
    description: 'Get notified in Slack when requests are submitted, assigned, or completed.',
    icon: 'S', color: '#36c5f0', authType: 'webhook', keyLabel: 'Slack Incoming Webhook URL',
    docsUrl: 'https://api.slack.com/messaging/webhooks',
  },
  {
    id: 'gmail', name: 'Gmail / Google Workspace', category: 'Communication',
    description: 'Send automated client emails and monthly reports directly from Red Ops.',
    icon: 'G', color: '#ea4335', authType: 'oauth', oauthLabel: 'Sign in with Google',
  },
  {
    id: 'stripe', name: 'Stripe', category: 'Payments',
    description: 'Sync client MRR, track renewals, and flag missed payments automatically.',
    icon: 'S', color: '#625bdb', authType: 'api_key', keyLabel: 'Stripe Secret Key',
    docsUrl: 'https://stripe.com/docs/keys',
  },
  {
    id: 'calendly', name: 'Calendly', category: 'Scheduling',
    description: 'Auto-create tasks when strategy calls are booked.',
    icon: 'C', color: '#006fee', authType: 'api_key', keyLabel: 'Calendly Personal Access Token',
    docsUrl: 'https://developer.calendly.com/api-docs',
  },
  {
    id: 'zapier', name: 'Zapier', category: 'Automation',
    description: 'Trigger Red Ops actions from 5,000+ apps via webhooks.',
    icon: 'Z', color: '#ff4f00', authType: 'webhook', keyLabel: 'Webhook URL',
  },
  {
    id: 'notion', name: 'Notion', category: 'Knowledge',
    description: 'Migrate Notion docs to Red Ops SOPs with one click.',
    icon: 'N', color: '#888', authType: 'oauth', oauthLabel: 'Connect Notion',
  },
  {
    id: 'meta_ads', name: 'Meta Ads', category: 'Marketing',
    description: 'Pull live ad performance into client dashboards.',
    icon: 'M', color: '#1877f2', authType: 'oauth', oauthLabel: 'Connect Meta Business',
  },
  {
    id: 'google_ads', name: 'Google Ads', category: 'Marketing',
    description: 'Monitor campaign performance alongside client health scores.',
    icon: 'A', color: '#4285f4', authType: 'oauth', oauthLabel: 'Sign in with Google',
  },
  {
    id: 'nextcloud', name: 'Nextcloud', category: 'Storage',
    description: 'Primary file storage for all deliverables and client assets.',
    icon: 'N', color: '#0082c9', authType: 'api_key', keyLabel: 'Nextcloud App Password',
  },
  {
    id: 'openai', name: 'OpenAI', category: 'AI',
    description: 'Powers the AI Brief Generator, Chat Assistant, and Status Summary.',
    icon: 'O', color: '#10a37f', authType: 'api_key', keyLabel: 'OpenAI API Key',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
];

const comingSoon = [
  { name: 'HubSpot', category: 'CRM' },
  { name: 'Salesforce', category: 'CRM' },
  { name: 'Monday.com', category: 'Project Management' },
  { name: 'QuickBooks', category: 'Accounting' },
];

export default function Integrations() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [connectedMap, setConnectedMap] = useState({});  // provider → integration doc
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await ax().get(`${API}/integrations`);
      const map = {};
      (res.data || []).forEach(i => { map[i.provider] = i; });
      setConnectedMap(map);
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const isConnected = id => !!connectedMap[id];
  const connectedCount = Object.keys(connectedMap).length;

  const filtered = allIntegrations.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
    const matchFilter = statusFilter === 'All' || (statusFilter === 'Connected' ? isConnected(i.id) : !isConnected(i.id));
    return matchSearch && matchFilter;
  });

  const openConnect = integration => {
    setApiKey('');
    setModal({ integration });
  };

  const handleConnect = async () => {
    if (!modal) return;
    const { integration } = modal;

    if ((integration.authType === 'api_key' || integration.authType === 'webhook') && !apiKey.trim()) {
      toast.error(`Please enter your ${integration.keyLabel || 'key'} to connect.`);
      return;
    }

    if (integration.authType === 'oauth') {
      toast.info(`${integration.name} OAuth coming soon. Use API key if available.`);
      return;
    }

    setConnecting(true);
    try {
      const config = integration.authType === 'webhook' ? { webhook_url: apiKey } : { api_key: apiKey };
      const res = await ax().post(`${API}/integrations/${integration.id}/connect`, {
        provider: integration.id,
        auth_type: integration.authType,
        config,
      });
      if (res.data.status === 'connected') {
        toast.success(`${integration.name} connected successfully`);
      } else {
        toast.warning(`${integration.name} saved but credentials may be invalid`);
      }
      fetchIntegrations();
      setModal(null);
      setApiKey('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (integration) => {
    if (!window.confirm(`Disconnect ${integration.name}?`)) return;
    try {
      await ax().delete(`${API}/integrations/${integration.id}`);
      toast.success(`${integration.name} disconnected`);
      fetchIntegrations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to disconnect');
    }
  };

  const handleTest = async (integration) => {
    setTesting(integration.id);
    try {
      const res = await ax().post(`${API}/integrations/${integration.id}/test`);
      if (res.data.status === 'connected') {
        toast.success(`${integration.name} is working`);
      } else {
        toast.error(`${integration.name} test failed — check credentials`);
      }
      fetchIntegrations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Test failed');
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '32px 28px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Integrations</h1>
        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--tx-3)' }}>
          Connect Red Ops to your existing stack. {connectedCount} connected.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <input className="input-field" placeholder="Search integrations..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, maxWidth: 320, height: 34, fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'Connected', 'Available'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: statusFilter === f ? 'var(--red)' : 'var(--border)', background: statusFilter === f ? 'var(--red)' : 'transparent', color: statusFilter === f ? '#fff' : 'var(--tx-2)', transition: 'all .12s' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 40 }}>
        {filtered.map(integration => {
          const connected = isConnected(integration.id);
          const info = connectedMap[integration.id];
          return (
            <div key={integration.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 0, borderLeft: connected ? `3px solid ${integration.color}` : undefined }}>
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: integration.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                  {integration.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>{integration.name}</span>
                    {connected && <CheckCircle size={14} color="#22c55e" />}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--tx-3)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 3 }}>{integration.category}</span>
                </div>
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.55, flex: 1, margin: '0 0 10px' }}>{integration.description}</p>

              {connected && info && (
                <div style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 10 }}>
                  Status: <span style={{ color: info.status === 'connected' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{info.status}</span>
                  {info.connected_at && <> · Connected {new Date(info.connected_at).toLocaleDateString()}</>}
                </div>
              )}

              {connected ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => handleTest(integration)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    {testing === integration.id ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} Test
                  </button>
                  <button onClick={() => openConnect(integration)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--tx-2)' }}>
                    Reconfigure
                  </button>
                  <button onClick={() => handleDisconnect(integration)}
                    style={{ padding: '7px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openConnect(integration)}
                  style={{ padding: '8px 0', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid', width: '100%', borderColor: integration.color, background: integration.color + '18', color: integration.color, transition: 'all .12s' }}>
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Coming Soon */}
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 14 }}>Coming Soon</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {comingSoon.map(item => (
            <div key={item.name} style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', borderRadius: 10, padding: '20px 16px', textAlign: 'center', opacity: 0.55 }}>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--tx-1)' }}>{item.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--tx-3)' }}>{item.category}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: modal.integration.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>{modal.integration.icon}</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Connect {modal.integration.name}</h3>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--tx-3)' }}>{modal.integration.category}</p>
                </div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-2)' }}><X size={18} /></button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--tx-2)', marginBottom: 20, lineHeight: 1.55 }}>{modal.integration.description}</p>

            {(modal.integration.authType === 'api_key' || modal.integration.authType === 'webhook') ? (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  <Key size={12} /> {modal.integration.keyLabel}
                </label>
                <input
                  className="input-field"
                  type="password"
                  placeholder="Paste your key here..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnect()}
                  autoFocus
                  style={{ marginBottom: 8 }}
                />
                {modal.integration.docsUrl && (
                  <a href={modal.integration.docsUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--tx-3)', textDecoration: 'none', marginBottom: 20 }}>
                    <ExternalLink size={11} /> Where do I find this key?
                  </a>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.5 }}>
                OAuth integration for <strong style={{ color: 'var(--tx-1)' }}>{modal.integration.name}</strong> is coming soon. If this service supports API keys, you can use that method instead.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{ flex: 2, padding: '10px 0', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: connecting ? 'wait' : 'pointer', border: 'none', background: modal.integration.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all .12s', opacity: connecting ? 0.7 : 1 }}>
                {connecting ? <Loader2 size={14} className="spin" /> : null}
                {connecting ? 'Connecting...' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

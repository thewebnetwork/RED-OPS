import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Settings, Users, Shield, Building2, FolderTree, GitBranch, Palette, Mail, Plug, Search, ChevronRight, CheckCircle2, Circle, Eye } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const SECTIONS = [
  { id: 'general', label: 'General', icon: Settings, inline: true },
  { id: 'team', label: 'Team', icon: Users, inline: false, path: '/team' },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield, inline: false, path: '/roles' },
  { id: 'clients', label: 'Client Accounts', icon: Building2, inline: true },
  { id: 'categories', label: 'Categories', icon: FolderTree, inline: false, path: '/categories' },
  { id: 'workflows', label: 'Workflows', icon: GitBranch, inline: false, path: '/workflows' },
  { id: 'ui', label: 'UI & Branding', icon: Palette, inline: false, path: '/settings/ui' },
  { id: 'email', label: 'Email', icon: Mail, inline: false, path: '/email-settings' },
  { id: 'integrations', label: 'Integrations', icon: Plug, inline: false, path: '/integrations' },
];

// ── General Section ────────────────────────────────────────────────────────────

function GeneralSection() {
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: 'var(--tx-1)' }}>
          Organization Settings
        </h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--tx-2)' }}>
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your organization name"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg)',
                color: 'var(--tx-1)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--tx-2)' }}>
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg)',
                color: 'var(--tx-1)',
                boxSizing: 'border-box',
              }}
            >
              <option>UTC</option>
              <option>EST</option>
              <option>CST</option>
              <option>MST</option>
              <option>PST</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--tx-2)' }}>
              Date Format
            </label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                background: 'var(--bg)',
                color: 'var(--tx-1)',
                boxSizing: 'border-box',
              }}
            >
              <option>MM/DD/YYYY</option>
              <option>DD/MM/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Client Accounts Section ────────────────────────────────────────────────────

function ClientAccountsSection() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await ax().get(`${API}/users`);
      const mediaClients = res.data.filter((u) => u.account_type === 'Media Client');
      setClients(mediaClients);
    } catch (err) {
      toast.error('Failed to load clients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const togglePortal = async (clientId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'none' : 'active';
      await ax().patch(`${API}/users/${clientId}`, { portal_status: newStatus });
      setClients(clients.map((c) => c.id === clientId ? { ...c, portal_status: newStatus } : c));
      toast.success(`Portal ${newStatus === 'active' ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error('Failed to update portal status');
      console.error(err);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: clients.length,
    activePortals: clients.filter((c) => c.portal_status === 'active').length,
    invited: clients.filter((c) => c.portal_status === 'invited').length,
    noPortal: clients.filter((c) => c.portal_status === 'none').length,
  };

  return (
    <div>
      {/* KPI Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>Total Clients</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--tx-1)' }}>{stats.total}</div>
        </div>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>Active Portals</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--green)' }}>{stats.activePortals}</div>
        </div>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>Invited</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--yellow)' }}>{stats.invited}</div>
        </div>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '4px' }}>No Portal</div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'var(--tx-3)' }}>{stats.noPortal}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '300px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '36px',
            padding: '10px 12px 10px 36px',
            fontSize: '13px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--bg)',
            color: 'var(--tx-1)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Clients Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--tx-3)' }}>Loading clients...</div>
      ) : filteredClients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--tx-3)' }}>
          {search ? 'No clients found matching your search.' : 'No client accounts yet.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--tx-2)', fontSize: '12px' }}>Client</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--tx-2)', fontSize: '12px' }}>Company</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--tx-2)', fontSize: '12px' }}>Plan</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--tx-2)', fontSize: '12px' }}>Portal Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: 'var(--tx-2)', fontSize: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--card)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#fff',
                    }}>
                      {client.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--tx-1)' }}>{client.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>{client.email}</div>
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--tx-2)' }}>{client.company || '—'}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: '500',
                      background: 'var(--accent)',
                      color: '#fff',
                      borderRadius: '4px',
                    }}>
                      {client.plan || 'Standard'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {client.portal_status === 'active' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--green)' }}>
                        <CheckCircle2 size={14} /> Active
                      </span>
                    )}
                    {client.portal_status === 'invited' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--yellow)' }}>
                        <Circle size={14} /> Invited
                      </span>
                    )}
                    {!client.portal_status || client.portal_status === 'none' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--tx-3)' }}>
                        <Circle size={14} /> None
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => navigate(`/clients/${client.id}`)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--tx-1)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        onClick={() => togglePortal(client.id, client.portal_status)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: client.portal_status === 'active' ? 'var(--red)' : 'var(--green)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {client.portal_status === 'active' ? 'Disable' : 'Enable'} Portal
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Navigation Card ───────────────────────────────────────────────────────────

function NavigationCard({ section }) {
  const navigate = useNavigate();
  return (
    <div style={{
      padding: '20px',
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <section.icon size={20} color="var(--accent)" strokeWidth={1.75} />
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--tx-1)' }}>{section.label}</h3>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--tx-3)', marginBottom: '16px' }}>
        {section.id === 'team' && 'Manage your team members and permissions.'}
        {section.id === 'roles' && 'Configure roles and their permissions.'}
        {section.id === 'categories' && 'Manage service and ticket classification.'}
        {section.id === 'workflows' && 'Automate status changes and notifications.'}
        {section.id === 'ui' && 'Customize colors, logo, and branding.'}
        {section.id === 'email' && 'Configure email settings and templates.'}
        {section.id === 'integrations' && 'Manage third-party integrations.'}
      </p>
      <button
        onClick={() => navigate(section.path)}
        style={{
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: '500',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: '6px',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        Open <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SettingsHub() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('general');

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--tx-1)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        borderRight: '1px solid var(--border)',
        background: 'var(--card)',
        overflowY: 'auto',
        flexShrink: 0,
      }}>
        <div style={{ padding: '20px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="var(--accent)" strokeWidth={1.75} />
            Settings
          </h1>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    fontWeight: isActive ? '600' : '500',
                    border: 'none',
                    borderRadius: '8px',
                    background: isActive ? 'rgba(162, 24, 44, 0.1)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--tx-2)',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'rgba(162, 24, 44, 0.05)';
                      e.currentTarget.style.color = 'var(--tx-1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--tx-2)';
                    }
                  }}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span style={{ flex: 1 }}>{section.label}</span>
                  {isActive && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Content Area */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
      }}>
        <div style={{ maxWidth: '1200px' }}>
          {/* Page Header */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--tx-1)', marginBottom: '8px' }}>
              {SECTIONS.find((s) => s.id === activeSection)?.label}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--tx-3)' }}>
              Manage your platform settings and configurations
            </p>
          </div>

          {/* Content */}
          {activeSection === 'general' && <GeneralSection />}
          {activeSection === 'clients' && <ClientAccountsSection />}
          {SECTIONS.find((s) => s.id === activeSection && !s.inline) && (
            <NavigationCard section={SECTIONS.find((s) => s.id === activeSection)} />
          )}
        </div>
      </main>
    </div>
  );
}

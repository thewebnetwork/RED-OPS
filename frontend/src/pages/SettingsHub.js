import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';
import {
  Settings, Users, Shield, Building2, FolderTree, GitBranch, Palette, Mail, Plug,
  Search, ChevronRight, CheckCircle2, Circle, Eye, ShoppingBag, Plus, Pencil, Trash2,
  X, Loader2, Clock, Package, Layers, Zap, EyeOff, Video, Camera, FileText, BarChart2,
  Megaphone, Globe, Mic, Phone, BookOpen, LayoutGrid,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const SECTIONS = [
  { id: 'general', label: 'General', icon: Settings, inline: true },
  { id: 'team', label: 'Team', icon: Users, inline: false, path: '/team' },
  { id: 'roles', label: 'Roles & Permissions', icon: Shield, inline: false, path: '/roles' },
  { id: 'clients', label: 'Client Accounts', icon: Building2, inline: true },
  { id: 'services', label: 'Services', icon: ShoppingBag, inline: true },
  { id: 'categories', label: 'Categories', icon: FolderTree, inline: false, path: '/categories' },
  { id: 'workflows', label: 'Workflows', icon: GitBranch, inline: false, path: '/workflows' },
  { id: 'ui', label: 'UI & Branding', icon: Palette, inline: false, path: '/settings/ui' },
  { id: 'email', label: 'Email', icon: Mail, inline: false, path: '/email-settings' },
  { id: 'integrations', label: 'Integrations', icon: Plug, inline: false, path: '/integrations' },
];

// ── General Section ────────────────────────────────────────────────────────────

function GeneralSection() {
  const { currentOrg, refreshOrgs } = useOrg();
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load current org settings
  useEffect(() => {
    if (currentOrg && !loaded) {
      setOrgName(currentOrg.name || '');
      setTimezone(currentOrg.settings?.timezone || 'UTC');
      setDateFormat(currentOrg.settings?.date_format || 'MM/DD/YYYY');
      setLoaded(true);
    }
  }, [currentOrg, loaded]);

  const handleSave = async () => {
    if (!currentOrg) { toast.error('No organization found'); return; }
    setSaving(true);
    try {
      await ax().patch(`${API}/organizations/${currentOrg.id || currentOrg._id}`, {
        name: orgName,
        settings: { timezone, date_format: dateFormat },
      });
      toast.success('Organization settings saved');
      refreshOrgs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally { setSaving(false); }
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: '13px',
    border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--bg)', color: 'var(--tx-1)', boxSizing: 'border-box',
  };

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
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your organization name" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--tx-2)' }}>
              Timezone
            </label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={inputStyle}>
              <option value="UTC">UTC</option>
              <option value="America/Toronto">Eastern (Toronto)</option>
              <option value="America/Edmonton">Mountain (Edmonton)</option>
              <option value="America/Vancouver">Pacific (Vancouver)</option>
              <option value="America/New_York">Eastern (New York)</option>
              <option value="America/Chicago">Central (Chicago)</option>
              <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
              <option value="Europe/London">London (GMT)</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: 'var(--tx-2)' }}>
              Date Format
            </label>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} style={inputStyle}>
              <option>MM/DD/YYYY</option>
              <option>DD/MM/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ marginTop: '20px', padding: '10px 24px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
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

// ── Services Management Section ──────────────────────────────────────────────

const CATEGORY_ICONS = {
  'Content Creation': FileText, 'Photography': Camera, 'Videography': Video,
  'Digital Marketing': BarChart2, 'Design & Branding': Palette, 'Strategy': Zap,
  'Video Production': Video, 'Ads & Marketing': Megaphone, 'Copywriting': Mail, default: Package,
};
const CATEGORY_COLORS = {
  'Content Creation': '#3b82f6', 'Photography': '#f59e0b', 'Videography': '#ef4444',
  'Digital Marketing': '#8b5cf6', 'Design & Branding': '#ec4899', 'Strategy': '#22c55e',
  'Video Production': '#ef4444', 'Ads & Marketing': '#f97316', 'Copywriting': '#06b6d4', default: '#6366f1',
};

function ServiceEditorModal({ service, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    category: service?.category || service?.hidden_category_l1 || '',
    icon: service?.icon || '',
    turnaround_text: service?.turnaround_text || '',
    deliverable_type: service?.deliverable_type || '',
    offer_track: service?.offer_track || '',
    flow_type: service?.flow_type || '',
    cta_label: service?.cta_label || '',
    cta_url: service?.cta_url || '',
    client_visible: service?.client_visible !== false,
    active: service?.active !== false,
    sort_order: service?.sort_order || 0,
    default_title: service?.default_title || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Service name is required'); return; }
    if (!form.category.trim()) { toast.error('Category is required'); return; }
    setSaving(true);
    try {
      if (service?.id) {
        await ax().put(`${API}/service-templates/${service.id}`, form);
        toast.success('Service updated');
      } else {
        await ax().post(`${API}/service-templates`, form);
        toast.success('Service created');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const inp = {
    width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--tx-1)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }} onClick={onClose}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, width: 700, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--tx-1)' }}>
            {service?.id ? 'Edit Service' : 'Create New Service'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 6, display: 'flex', borderRadius: 7 }}><X size={20} /></button>
        </div>

        <div style={{ padding: '24px 28px', maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Service Name *</label>
              <input style={inp} placeholder="e.g. Product Photography" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label style={lbl}>Icon (emoji)</label>
              <input style={inp} placeholder="📸" value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} maxLength="2" />
            </div>
          </div>

          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="What does this service include?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Category *</label>
              <input style={inp} placeholder="e.g. Photography" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Turnaround Time</label>
              <input style={inp} placeholder="e.g. 2-3 days" value={form.turnaround_text} onChange={e => setForm(p => ({ ...p, turnaround_text: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Deliverable</label>
              <select style={inp} value={form.deliverable_type} onChange={e => setForm(p => ({ ...p, deliverable_type: e.target.value }))}>
                <option value="">None</option>
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="document">Document</option>
                <option value="design">Design</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Offer Track</label>
              <select style={inp} value={form.offer_track} onChange={e => setForm(p => ({ ...p, offer_track: e.target.value }))}>
                <option value="">None</option>
                <option value="ONE_OFF">One-Time</option>
                <option value="DFY_CORE">DFY Core</option>
                <option value="BOOK_CALL">Book a Call</option>
                <option value="RETAINER">Retainer</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Sort Order</label>
              <input style={inp} type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>CTA Label</label>
              <input style={inp} placeholder="e.g. Book Now" value={form.cta_label} onChange={e => setForm(p => ({ ...p, cta_label: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>CTA URL</label>
              <input style={inp} placeholder="https://..." value={form.cta_url} onChange={e => setForm(p => ({ ...p, cta_url: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={lbl}>Default Request Title</label>
            <input style={inp} placeholder="Auto-populated in request forms" value={form.default_title} onChange={e => setForm(p => ({ ...p, default_title: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 32, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setForm(p => ({ ...p, active: !p.active }))} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.active ? '#22c55e' : 'var(--bg)', position: 'relative', transition: 'background .15s' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: form.active ? 22 : 2, transition: 'left .15s', boxShadow: '0 2px 4px rgba(0,0,0,.2)' }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, color: form.active ? 'var(--tx-1)' : 'var(--tx-3)' }}>Active</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setForm(p => ({ ...p, client_visible: !p.client_visible }))} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: form.client_visible ? '#22c55e' : 'var(--bg)', position: 'relative', transition: 'background .15s' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: form.client_visible ? 22 : 2, transition: 'left .15s', boxShadow: '0 2px 4px rgba(0,0,0,.2)' }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, color: form.client_visible ? 'var(--tx-1)' : 'var(--tx-3)' }}>Visible to Clients</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '18px 28px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--tx-2)', cursor: 'pointer' }} onClick={onClose}>Cancel</button>
          <button style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : service?.id ? 'Save Changes' : 'Create Service'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ServicesSection() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null=closed, {}=new, {id:...}=edit

  useEffect(() => { fetchServices(); }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await ax().get(`${API}/service-templates/all`);
      setServices(res.data || []);
    } catch (err) {
      toast.error('Failed to load services');
    } finally { setLoading(false); }
  };

  const handleDelete = async (svc) => {
    if (!window.confirm(`Delete "${svc.name}"? This cannot be undone.`)) return;
    try {
      await ax().delete(`${API}/service-templates/${svc.id}`);
      toast.success('Service deleted');
      fetchServices();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleSeed = async () => {
    try {
      await ax().post(`${API}/service-templates/seed`);
      toast.success('Default services seeded!');
      fetchServices();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to seed');
    }
  };

  const filtered = services.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    (s.category || s.hidden_category_l1 || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const cats = new Set(services.map(s => s.category || s.hidden_category_l1).filter(Boolean));
  const activeCount = services.filter(s => s.active !== false).length;
  const visibleCount = services.filter(s => s.client_visible !== false).length;

  return (
    <div>
      {editing !== null && (
        <ServiceEditorModal
          service={editing?.id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSave={fetchServices}
        />
      )}

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Services', value: services.length, icon: Package, color: 'var(--accent)' },
          { label: 'Active', value: activeCount, icon: Zap, color: 'var(--green)' },
          { label: 'Categories', value: cats.size, icon: Layers, color: 'var(--purple)' },
          { label: 'Client Visible', value: visibleCount, icon: Eye, color: 'var(--blue, #3b82f6)' },
        ].map(k => (
          <div key={k.label} style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={16} style={{ color: k.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: 300, flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            type="text" placeholder="Search services..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, padding: '10px 12px 10px 36px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--tx-1)', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {services.length === 0 && (
            <button onClick={handleSeed} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--tx-2)', cursor: 'pointer' }}>
              <Zap size={14} /> Seed Defaults
            </button>
          )}
          <button onClick={() => setEditing({})} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Add Service
          </button>
        </div>
      </div>

      {/* Services Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--tx-3)' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--tx-3)' }}>
          {search ? 'No services match your search.' : 'No services yet. Add one or seed the defaults.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: 'var(--tx-2)', fontSize: 12 }}>Service</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: 'var(--tx-2)', fontSize: 12 }}>Category</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 600, color: 'var(--tx-2)', fontSize: 12 }}>Turnaround</th>
                <th style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: 'var(--tx-2)', fontSize: 12 }}>Status</th>
                <th style={{ padding: 12, textAlign: 'center', fontWeight: 600, color: 'var(--tx-2)', fontSize: 12 }}>Visible</th>
                <th style={{ padding: 12, textAlign: 'right', fontWeight: 600, color: 'var(--tx-2)', fontSize: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(svc => {
                const cat = svc.category || svc.hidden_category_l1 || '—';
                const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
                const CatIcon = CATEGORY_ICONS[cat] || CATEGORY_ICONS.default;
                return (
                  <tr key={svc.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${catColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${catColor}25` }}>
                        {svc.icon && /[^\x00-\x7F]/.test(svc.icon) ? (
                          <span style={{ fontSize: 18 }}>{svc.icon}</span>
                        ) : (
                          <CatIcon size={16} style={{ color: catColor }} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--tx-1)' }}>{svc.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--tx-3)', maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{svc.description}</div>
                      </div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: catColor, backgroundColor: `${catColor}12`, padding: '3px 8px', borderRadius: 5, display: 'inline-block' }}>{cat}</span>
                    </td>
                    <td style={{ padding: 12, color: 'var(--tx-2)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Clock size={12} /> {svc.turnaround_text || '—'}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {svc.active !== false ? (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#22c55e18', color: '#22c55e' }}>Active</span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'var(--bg)', color: 'var(--tx-3)', border: '1px solid var(--border)' }}>Inactive</span>
                      )}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      {svc.client_visible !== false ? (
                        <Eye size={14} style={{ color: 'var(--green)' }} />
                      ) : (
                        <EyeOff size={14} style={{ color: 'var(--tx-3)' }} />
                      )}
                    </td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditing(svc)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, color: 'var(--accent)' }} title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(svc)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, color: 'var(--red)' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
        {section.id === 'services' && 'Manage your service catalog and templates.'}
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
          {activeSection === 'services' && <ServicesSection />}
          {SECTIONS.find((s) => s.id === activeSection && !s.inline) && (
            <NavigationCard section={SECTIONS.find((s) => s.id === activeSection)} />
          )}
        </div>
      </main>
    </div>
  );
}

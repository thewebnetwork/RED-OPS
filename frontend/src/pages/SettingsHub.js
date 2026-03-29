import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useOrg } from '@/contexts/OrgContext';
import {
  Settings, Users, Shield, Building2, FolderTree, GitBranch, Palette, Mail, Plug,
  Search, ChevronRight, CheckCircle2, Circle, Eye, ShoppingBag, Plus, Pencil, Trash2,
  X, Loader2, Clock, Package, Layers, Zap, EyeOff, Video, Camera, FileText, BarChart2,
  Megaphone, Globe, Mic, Phone, BookOpen, LayoutGrid, Tag, CreditCard, DollarSign, Star,
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
  { id: 'specialties', label: 'Specialties', icon: Tag, inline: true },
  { id: 'plans', label: 'Subscription Plans', icon: CreditCard, inline: true },
  { id: 'categories', label: 'Categories', icon: FolderTree, inline: false, path: '/categories' },
  { id: 'finance-categories', label: 'Finance Categories', icon: DollarSign, inline: true },
  { id: 'workflows', label: 'Workflows', icon: GitBranch, inline: false, path: '/workflows' },
  { id: 'email', label: 'Email', icon: Mail, inline: false, path: '/email-settings' },
  { id: 'integrations', label: 'Integrations', icon: Plug, inline: false, path: '/integrations' },
];

// ── General Section ────────────────────────────────────────────────────────────

function GeneralSection() {
  const { currentOrg, loading: orgLoading, refreshOrgs } = useOrg();
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load current org settings
  useEffect(() => {
    if (currentOrg && !loaded) {
      setOrgName(currentOrg?.name || '');
      setTimezone(currentOrg?.settings?.timezone || 'UTC');
      setDateFormat(currentOrg?.settings?.date_format || 'MM/DD/YYYY');
      setLoaded(true);
    }
  }, [currentOrg, loaded]);

  if (orgLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  const handleSave = async () => {
    if (!orgName.trim()) { toast.error('Organization name is required'); return; }
    setSaving(true);
    try {
      if (currentOrg) {
        await ax().patch(`${API}/organizations/${currentOrg?.id || currentOrg?._id}`, {
          name: orgName,
          settings: { timezone, date_format: dateFormat },
        });
        toast.success('Organization settings saved');
      } else {
        // No org exists — create one
        await ax().post(`${API}/organizations`, { name: orgName });
        toast.success('Organization created');
      }
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
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [plans, setPlans] = useState([]);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetchClients();
    ax().get(`${API}/subscription-plans`).then(r => setPlans(r.data || [])).catch(() => {});
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await ax().get(`${API}/users`);
      const users = Array.isArray(res.data) ? res.data : (res.data?.users || []);
      const mediaClients = users.filter((u) => u.account_type === 'Media Client');
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

  const startEdit = (client) => {
    setEditing(client.id);
    setEditForm({ name: client.name || '', email: client.email || '', company: client.company || '', subscription_plan_name: client.subscription_plan_name || '' });
  };

  const cancelEdit = () => { setEditing(null); setEditForm({}); };

  const saveEdit = async (clientId) => {
    setEditSaving(true);
    try {
      await ax().patch(`${API}/users/${clientId}`, editForm);
      setClients(clients.map((c) => c.id === clientId ? { ...c, ...editForm } : c));
      toast.success('Client updated');
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update client');
    } finally { setEditSaving(false); }
  };

  const deleteClient = async (clientId, name) => {
    if (!window.confirm(`Delete client "${name}"? This cannot be undone.`)) return;
    try {
      await ax().delete(`${API}/users/${clientId}`);
      setClients(clients.filter((c) => c.id !== clientId));
      toast.success(`Client "${name}" deleted`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete client');
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
    noPortal: clients.filter((c) => !c.portal_status || c.portal_status === 'none').length,
  };

  const inpStyle = { width: '100%', padding: '6px 10px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg)', color: 'var(--tx-1)', boxSizing: 'border-box' };

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
                <tr key={client.id} style={{ borderBottom: '1px solid var(--border)' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--card)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px' }}>
                    {editing === client.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <input style={inpStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
                        <input style={{ ...inpStyle, fontSize: 11 }} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                          {client.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500', color: 'var(--tx-1)' }}>{client.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--tx-3)' }}>{client.email}</div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--tx-2)' }}>
                    {editing === client.id ? (
                      <input style={inpStyle} value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} placeholder="Company" />
                    ) : (client.company || '—')}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {editing === client.id ? (
                      <select style={inpStyle} value={editForm.subscription_plan_name || ''} onChange={e => setEditForm(f => ({ ...f, subscription_plan_name: e.target.value }))}>
                        <option value="">No plan</option>
                        {plans.map(p => <option key={p.id} value={p.name}>{p.name}{p.price_monthly ? ` — $${p.price_monthly}/mo` : ''}</option>)}
                      </select>
                    ) : (
                      <span style={{ display: 'inline-block', padding: '4px 8px', fontSize: '11px', fontWeight: '500', background: client.subscription_plan_name ? 'var(--accent)' : 'var(--surface-2)', color: client.subscription_plan_name ? '#fff' : 'var(--tx-3)', borderRadius: '4px' }}>
                        {client.subscription_plan_name || '—'}
                      </span>
                    )}
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
                    {(!client.portal_status || client.portal_status === 'none') && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--tx-3)' }}>
                        <Circle size={14} /> None
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {editing === client.id ? (
                        <>
                          <button onClick={() => saveEdit(client.id)} disabled={editSaving}
                            style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '600', background: 'var(--green)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', opacity: editSaving ? 0.6 : 1 }}>
                            {editSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={cancelEdit}
                            style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '500', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--tx-2)', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(client)}
                            style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '500', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--tx-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Pencil size={11} /> Edit
                          </button>
                          <button onClick={() => navigate(`/clients/${client.id}`)}
                            style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '500', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--tx-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={11} /> View
                          </button>
                          <button onClick={() => togglePortal(client.id, client.portal_status)}
                            style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '500', background: client.portal_status === 'active' ? 'var(--red)' : 'var(--green)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>
                            {client.portal_status === 'active' ? 'Disable' : 'Enable'} Portal
                          </button>
                          <button onClick={() => deleteClient(client.id, client.name)}
                            style={{ padding: '5px 10px', fontSize: '12px', fontWeight: '500', background: 'transparent', border: '1px solid var(--red)', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Trash2 size={11} /> Delete
                          </button>
                        </>
                      )}
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

// ── Specialties Management Section ───────────────────────────────────────────

function SpecialtiesSection() {
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', icon: '', color: '' });
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', icon: '', color: '#3b82f6' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSpecialties(); }, []);

  const fetchSpecialties = async () => {
    try {
      setLoading(true);
      const res = await ax().get(`${API}/specialties`);
      setSpecialties(res.data || []);
    } catch (err) {
      toast.error('Failed to load specialties');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error('Specialty name is required'); return; }
    setSaving(true);
    try {
      await ax().post(`${API}/specialties`, createForm);
      toast.success('Specialty created');
      setCreating(false);
      setCreateForm({ name: '', description: '', icon: '', color: '#3b82f6' });
      fetchSpecialties();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create specialty');
    } finally { setSaving(false); }
  };

  const startEdit = (spec) => {
    setEditing(spec.id);
    setEditForm({ name: spec.name || '', description: spec.description || '', icon: spec.icon || '', color: spec.color || '#3b82f6' });
  };

  const handleUpdate = async (specId) => {
    if (!editForm.name.trim()) { toast.error('Specialty name is required'); return; }
    setSaving(true);
    try {
      await ax().patch(`${API}/specialties/${specId}`, editForm);
      toast.success('Specialty updated');
      setEditing(null);
      fetchSpecialties();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update specialty');
    } finally { setSaving(false); }
  };

  const handleDelete = async (spec) => {
    const msg = spec.user_count > 0
      ? `Delete "${spec.name}"? ${spec.user_count} user(s) will be unassigned.`
      : `Delete "${spec.name}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await ax().delete(`${API}/specialties/${spec.id}`);
      toast.success('Specialty deleted');
      fetchSpecialties();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete specialty');
    }
  };

  const inpStyle = {
    width: '100%', padding: '8px 12px', fontSize: '13px',
    border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--bg)', color: 'var(--tx-1)', boxSizing: 'border-box',
  };

  return (
    <div>
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Tag size={16} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{specialties.length}</div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Total Specialties</div>
          </div>
        </div>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={16} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{specialties.reduce((sum, s) => sum + (s.user_count || 0), 0)}</div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Assigned Users</div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>Manage Specialties</h3>
        <button onClick={() => { setCreating(true); setEditing(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Add Specialty
        </button>
      </div>

      {/* Create Form */}
      {creating && (
        <div style={{ padding: 20, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>New Specialty</h4>
            <button onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name *</label>
              <input style={inpStyle} placeholder="e.g. Photography" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Icon (emoji)</label>
              <input style={inpStyle} placeholder="e.g. camera emoji" value={createForm.icon} onChange={e => setCreateForm(f => ({ ...f, icon: e.target.value }))} maxLength="2" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={createForm.color} onChange={e => setCreateForm(f => ({ ...f, color: e.target.value }))}
                  style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'var(--bg)', padding: 2 }} />
                <input style={{ ...inpStyle, flex: 1 }} value={createForm.color} onChange={e => setCreateForm(f => ({ ...f, color: e.target.value }))} placeholder="#3b82f6" />
              </div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
            <input style={inpStyle} placeholder="Optional description" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={saving}
              style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating...' : 'Create Specialty'}
            </button>
            <button onClick={() => setCreating(false)}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--tx-2)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Specialties List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--tx-3)' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : specialties.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--tx-3)' }}>
          No specialties yet. Click "Add Specialty" to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {specialties.map(spec => (
            <div key={spec.id} style={{ padding: '14px 18px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi, #3a3a3a)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>

              {editing === spec.id ? (
                /* Edit mode */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                    <input style={inpStyle} placeholder="Name" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                    <input style={inpStyle} placeholder="Icon emoji" value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))} maxLength="2" />
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="color" value={editForm.color || '#3b82f6'} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                        style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'var(--bg)', padding: 2 }} />
                      <input style={{ ...inpStyle, flex: 1 }} value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} placeholder="#3b82f6" />
                    </div>
                  </div>
                  <input style={inpStyle} placeholder="Description" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleUpdate(spec.id)} disabled={saving}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: 'var(--green)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(null)}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--tx-2)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${spec.color || '#3b82f6'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${spec.color || '#3b82f6'}30` }}>
                    {spec.icon ? (
                      <span style={{ fontSize: 18 }}>{spec.icon}</span>
                    ) : (
                      <Tag size={16} style={{ color: spec.color || '#3b82f6' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--tx-1)' }}>{spec.name}</div>
                    {spec.description && <div style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>{spec.description}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--tx-3)', marginRight: 8 }}>
                      {spec.user_count || 0} user{(spec.user_count || 0) !== 1 ? 's' : ''}
                    </span>
                    <button onClick={() => startEdit(spec)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, color: 'var(--accent)' }} title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(spec)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, color: 'var(--red)' }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subscription Plans Management Section ────────────────────────────────────

// ── Finance Categories Section ───────────────────────────────────────────────

function FinanceCategoriesSection() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('expense');
  const [newColor, setNewColor] = useState('#6366f1');
  const [editingCat, setEditingCat] = useState(null);

  useEffect(() => { fetchCats(); }, []);

  const fetchCats = async () => {
    try {
      setLoading(true);
      const res = await ax().get(`${API}/finance/categories`);
      setCats(res.data?.items || []);
    } catch { toast.error('Failed to load categories'); }
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await ax().post(`${API}/finance/categories`, { name: newName.trim(), type: newType, color: newColor });
      setNewName('');
      toast.success('Category added');
      fetchCats();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add'); }
  };

  const handleSave = async (id) => {
    try {
      await ax().patch(`${API}/finance/categories/${id}`, { name: editingCat.name, type: editingCat.type, color: editingCat.color });
      setEditingCat(null);
      toast.success('Category updated');
      fetchCats();
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Existing transactions keep their label.')) return;
    try {
      await ax().delete(`${API}/finance/categories/${id}`);
      toast.success('Category deleted');
      fetchCats();
    } catch { toast.error('Failed to delete'); }
  };

  const inpStyle = {
    padding: '8px 10px', fontSize: 13, borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--surface-2)',
    color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--tx-1)' }}>Finance Categories</h3>
      <p style={{ fontSize: 13, color: 'var(--tx-3)', marginBottom: 20 }}>Used in Finance to tag and filter transactions.</p>

      {/* Add new */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <input style={{ ...inpStyle, flex: 1 }} value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Category name" onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
        <select style={inpStyle} value={newType} onChange={e => setNewType(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="both">Both</option>
        </select>
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
          style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
        <button onClick={handleAdd} className="btn-primary btn-sm" style={{ gap: 4 }}>
          <Plus size={13} /> Add
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} /></div>
      ) : cats.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--tx-3)', fontSize: 13 }}>No categories yet. Add one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cats.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              {editingCat?.id === cat.id ? (
                <>
                  <input type="color" value={editingCat.color || '#6366f1'} onChange={e => setEditingCat(p => ({ ...p, color: e.target.value }))}
                    style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 0 }} />
                  <input style={{ ...inpStyle, flex: 1 }} value={editingCat.name} onChange={e => setEditingCat(p => ({ ...p, name: e.target.value }))} />
                  <select style={{ ...inpStyle, width: 'auto' }} value={editingCat.type} onChange={e => setEditingCat(p => ({ ...p, type: e.target.value }))}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="both">Both</option>
                  </select>
                  <button onClick={() => handleSave(cat.id)} style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingCat(null)} style={{ fontSize: 11, color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: cat.color || '#6366f1', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--tx-1)' }}>{cat.name}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 600,
                    background: cat.type === 'income' ? '#22c55e18' : cat.type === 'expense' ? '#ef444418' : 'var(--surface-3)',
                    color: cat.type === 'income' ? '#22c55e' : cat.type === 'expense' ? '#ef4444' : 'var(--tx-3)',
                  }}>{cat.type}</span>
                  <button onClick={() => setEditingCat({ ...cat })} style={{ fontSize: 11, color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleDelete(cat.id)} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function SubscriptionPlansSection() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', price_monthly: '', price_yearly: '', features: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await ax().get(`${API}/subscription-plans`);
      setPlans(res.data || []);
    } catch (err) {
      toast.error('Failed to load subscription plans');
    } finally { setLoading(false); }
  };

  const parseFeatures = (featStr) => {
    if (!featStr || !featStr.trim()) return [];
    return featStr.split('\n').map(f => f.trim()).filter(Boolean);
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast.error('Plan name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: createForm.name,
        description: createForm.description || null,
        price_monthly: createForm.price_monthly ? parseFloat(createForm.price_monthly) : null,
        price_yearly: createForm.price_yearly ? parseFloat(createForm.price_yearly) : null,
        features: parseFeatures(createForm.features),
        sort_order: parseInt(createForm.sort_order) || 0,
      };
      await ax().post(`${API}/subscription-plans`, payload);
      toast.success('Plan created');
      setCreating(false);
      setCreateForm({ name: '', description: '', price_monthly: '', price_yearly: '', features: '', sort_order: 0 });
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create plan');
    } finally { setSaving(false); }
  };

  const startEdit = (plan) => {
    setEditing(plan.id);
    setEditForm({
      name: plan.name || '',
      description: plan.description || '',
      price_monthly: plan.price_monthly != null ? String(plan.price_monthly) : '',
      price_yearly: plan.price_yearly != null ? String(plan.price_yearly) : '',
      features: (plan.features || []).join('\n'),
      sort_order: plan.sort_order || 0,
    });
  };

  const handleUpdate = async (planId) => {
    if (!editForm.name.trim()) { toast.error('Plan name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: editForm.name,
        description: editForm.description || null,
        price_monthly: editForm.price_monthly ? parseFloat(editForm.price_monthly) : null,
        price_yearly: editForm.price_yearly ? parseFloat(editForm.price_yearly) : null,
        features: parseFeatures(editForm.features),
        sort_order: parseInt(editForm.sort_order) || 0,
      };
      await ax().patch(`${API}/subscription-plans/${planId}`, payload);
      toast.success('Plan updated');
      setEditing(null);
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update plan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (plan) => {
    if (plan.user_count > 0) {
      toast.error(`Cannot delete "${plan.name}" — ${plan.user_count} active user(s) are on this plan`);
      return;
    }
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    try {
      await ax().delete(`${API}/subscription-plans/${plan.id}`);
      toast.success('Plan deleted');
      fetchPlans();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete plan');
    }
  };

  const inpStyle = {
    width: '100%', padding: '8px 12px', fontSize: '13px',
    border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--bg)', color: 'var(--tx-1)', boxSizing: 'border-box',
  };

  const lblStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' };

  const formatPrice = (price) => {
    if (price == null) return '—';
    return `$${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <div>
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CreditCard size={16} style={{ color: '#a855f7' }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{plans.length}</div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Total Plans</div>
          </div>
        </div>
        <div style={{ padding: '12px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={16} style={{ color: '#22c55e' }} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)', lineHeight: 1 }}>{plans.reduce((sum, p) => sum + (p.user_count || 0), 0)}</div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Subscribed Users</div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>Manage Plans</h3>
        <button onClick={() => { setCreating(true); setEditing(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Add Plan
        </button>
      </div>

      {/* Create Form */}
      {creating && (
        <div style={{ padding: 20, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>New Subscription Plan</h4>
            <button onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lblStyle}>Name *</label>
              <input style={inpStyle} placeholder="e.g. Scale" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label style={lblStyle}>Monthly Price</label>
              <input style={inpStyle} type="number" step="0.01" placeholder="0.00" value={createForm.price_monthly} onChange={e => setCreateForm(f => ({ ...f, price_monthly: e.target.value }))} />
            </div>
            <div>
              <label style={lblStyle}>Yearly Price</label>
              <input style={inpStyle} type="number" step="0.01" placeholder="0.00" value={createForm.price_yearly} onChange={e => setCreateForm(f => ({ ...f, price_yearly: e.target.value }))} />
            </div>
            <div>
              <label style={lblStyle}>Sort Order</label>
              <input style={inpStyle} type="number" value={createForm.sort_order} onChange={e => setCreateForm(f => ({ ...f, sort_order: e.target.value }))} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lblStyle}>Description</label>
            <input style={inpStyle} placeholder="Brief description of this plan" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lblStyle}>Features (one per line)</label>
            <textarea style={{ ...inpStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Feature 1&#10;Feature 2&#10;Feature 3" value={createForm.features} onChange={e => setCreateForm(f => ({ ...f, features: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={saving}
              style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating...' : 'Create Plan'}
            </button>
            <button onClick={() => setCreating(false)}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'var(--tx-2)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--tx-3)' }}>
          <Loader2 size={24} className="spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--tx-3)' }}>
          No subscription plans yet. Click "Add Plan" to create one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {plans.map(plan => (
            <div key={plan.id} style={{ padding: 20, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hi, #3a3a3a)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>

              {editing === plan.id ? (
                /* Edit mode */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={lblStyle}>Name *</label>
                    <input style={inpStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={lblStyle}>Monthly</label>
                      <input style={inpStyle} type="number" step="0.01" placeholder="0.00" value={editForm.price_monthly} onChange={e => setEditForm(f => ({ ...f, price_monthly: e.target.value }))} />
                    </div>
                    <div>
                      <label style={lblStyle}>Yearly</label>
                      <input style={inpStyle} type="number" step="0.01" placeholder="0.00" value={editForm.price_yearly} onChange={e => setEditForm(f => ({ ...f, price_yearly: e.target.value }))} />
                    </div>
                    <div>
                      <label style={lblStyle}>Order</label>
                      <input style={inpStyle} type="number" value={editForm.sort_order} onChange={e => setEditForm(f => ({ ...f, sort_order: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label style={lblStyle}>Description</label>
                    <input style={inpStyle} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
                  </div>
                  <div>
                    <label style={lblStyle}>Features (one per line)</label>
                    <textarea style={{ ...inpStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }} value={editForm.features} onChange={e => setEditForm(f => ({ ...f, features: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => handleUpdate(plan.id)} disabled={saving}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: 'var(--green)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(null)}
                      style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--tx-2)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)', margin: 0, marginBottom: 4 }}>{plan.name}</h4>
                      {plan.description && <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>{plan.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => startEdit(plan)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, color: 'var(--accent)' }} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(plan)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, color: 'var(--red)' }} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>Monthly</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)' }}>{formatPrice(plan.price_monthly)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>Yearly</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-1)' }}>{formatPrice(plan.price_yearly)}</div>
                    </div>
                  </div>

                  {/* Features */}
                  {plan.features && plan.features.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Features</div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {plan.features.map((feat, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx-2)' }}>
                            <CheckCircle2 size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>
                      {plan.user_count || 0} subscriber{(plan.user_count || 0) !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                      Order: {plan.sort_order}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
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
        <div>
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
          {activeSection === 'specialties' && <SpecialtiesSection />}
          {activeSection === 'plans' && <SubscriptionPlansSection />}
          {activeSection === 'finance-categories' && <FinanceCategoriesSection />}
          {SECTIONS.find((s) => s.id === activeSection && !s.inline) && (
            <NavigationCard section={SECTIONS.find((s) => s.id === activeSection)} />
          )}
        </div>
      </main>
    </div>
  );
}

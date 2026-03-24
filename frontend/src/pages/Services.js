/**
 * Services — Premium Service Catalog & Order Portal
 *
 * Features:
 *   • Category-based navigation with icon tabs
 *   • KPI bar (total services, categories, active templates)
 *   • Premium service cards with icons, turnaround badges, CTA flow types
 *   • Grid/list view toggle
 *   • Search + category filter
 *   • Request modal with dynamic form schema
 *   • Admin: inline create/edit service templates
 *   • Seed catalog for first-time setup
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ShoppingBag, Loader2, X, ChevronRight, Clock, Plus, Search,
  Upload, FileText, CheckCircle2, ArrowRight, Settings, Grid3X3,
  List, Package, Layers, Zap, Star, Eye, EyeOff, Pencil, Trash2,
  Tag, LayoutGrid, BookOpen, Video, Camera, Palette, BarChart2,
  Megaphone, Globe, Mail, Mic, Phone, ExternalLink, Copy,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

// ── Category icons ──
const CATEGORY_ICONS = {
  'Content Creation': FileText,
  'Photography': Camera,
  'Videography': Video,
  'Digital Marketing': BarChart2,
  'Design & Branding': Palette,
  'Strategy': Zap,
  'Video Production': Video,
  'Ads & Marketing': Megaphone,
  'Copywriting': Mail,
  'default': Package,
};

const CATEGORY_COLORS = {
  'Content Creation': '#3b82f6',
  'Photography': '#f59e0b',
  'Videography': '#ef4444',
  'Digital Marketing': '#8b5cf6',
  'Design & Branding': '#ec4899',
  'Strategy': '#22c55e',
  'Video Production': '#ef4444',
  'Ads & Marketing': '#f97316',
  'Copywriting': '#06b6d4',
  'default': '#6366f1',
};

const FLOW_LABELS = {
  'ONE_OFF': { label: 'One-Time', color: '#3b82f6', bg: '#3b82f618' },
  'DFY_CORE': { label: 'DFY Core', color: '#8b5cf6', bg: '#8b5cf618' },
  'BOOK_CALL': { label: 'Book a Call', color: '#22c55e', bg: '#22c55e18' },
  'RETAINER': { label: 'Retainer', color: '#f59e0b', bg: '#f59e0b18' },
};

const DELIVERABLE_ICONS = {
  video: Video,
  image: Camera,
  document: FileText,
  design: Palette,
  default: Package,
};

function getCatIcon(cat) {
  const Icon = CATEGORY_ICONS[cat] || CATEGORY_ICONS.default;
  return Icon;
}

function getCatColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
}

// ── Request Modal ──
function RequestModal({ service, onClose }) {
  const [formData, setFormData] = useState({});
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  if (!service) return null;

  const schema = service.form_schema || [];
  const CatIcon = getCatIcon(service.category);
  const catColor = getCatColor(service.category);

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
    toast.success(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} selected`);
  };

  const handleSubmit = async () => {
    for (const field of schema.filter(f => f.required)) {
      if (!formData[field.field] && field.type !== 'file') {
        toast.error(`${field.label} is required`);
        return;
      }
    }
    if (!description.trim() && schema.length === 0) {
      toast.error('Please describe what you need');
      return;
    }

    setSubmitting(true);
    try {
      let richDesc = description.trim();
      if (schema.length > 0) {
        const answers = schema
          .filter(f => formData[f.field] && f.type !== 'file')
          .map(f => `**${f.label}:** ${formData[f.field]}`)
          .join('\n');
        richDesc = answers + (richDesc ? `\n\n**Additional Notes:**\n${richDesc}` : '');
      }

      await ax().post(`${API}/orders`, {
        title: service.default_title || service.name,
        description: richDesc,
        service_name: service.name,
        category_name: service.category,
        service_template_id: service.id,
      });

      toast.success(`Request submitted for "${service.name}"`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, width: 560 }} onClick={e => e.stopPropagation()}>
        {/* Header with accent */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: `${catColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {service.icon ? <span style={{ fontSize: 22 }}>{service.icon}</span> : <CatIcon size={22} style={{ color: catColor }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--tx-1)' }}>{service.name}</h2>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0', lineHeight: 1.5 }}>{service.description}</p>
          </div>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        {/* Meta badges */}
        <div style={{ padding: '12px 24px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <span style={metaBadge}><Clock size={11} /> {service.turnaround_text || 'TBD'}</span>
          <span style={{ ...metaBadge, background: `${catColor}18`, color: catColor, borderColor: `${catColor}30` }}>
            <CatIcon size={11} /> {service.category}
          </span>
          {service.offer_track && FLOW_LABELS[service.offer_track] && (
            <span style={{ ...metaBadge, background: FLOW_LABELS[service.offer_track].bg, color: FLOW_LABELS[service.offer_track].color }}>
              {FLOW_LABELS[service.offer_track].label}
            </span>
          )}
          {service.deliverable_type && (
            <span style={metaBadge}>
              {React.createElement(DELIVERABLE_ICONS[service.deliverable_type] || DELIVERABLE_ICONS.default, { size: 11 })} {service.deliverable_type}
            </span>
          )}
        </div>

        {/* Form body */}
        <div style={{ padding: '20px 24px', maxHeight: '50vh', overflowY: 'auto' }}>
          {/* Dynamic form fields */}
          {schema.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              {schema.map(field => {
                if (field.type === 'file') return null;
                return (
                  <div key={field.field}>
                    <label style={labelStyle}>
                      {field.label} {field.required && <span style={{ color: 'var(--red)' }}>*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select style={inputStyle} value={formData[field.field] || ''} onChange={e => handleFieldChange(field.field, e.target.value)}>
                        <option value="">Select...</option>
                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder={field.placeholder || ''} value={formData[field.field] || ''} onChange={e => handleFieldChange(field.field, e.target.value)} />
                    ) : field.type === 'toggle' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => handleFieldChange(field.field, !formData[field.field])}
                          style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: formData[field.field] ? '#22c55e' : 'var(--bg)', position: 'relative', transition: 'background .15s' }}>
                          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: formData[field.field] ? 20 : 2, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                        </button>
                        <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>{formData[field.field] ? 'Yes' : 'No'}</span>
                      </div>
                    ) : (
                      <input style={inputStyle} placeholder={field.placeholder || ''} value={formData[field.field] || ''} onChange={e => handleFieldChange(field.field, e.target.value)} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              {schema.length > 0 ? 'Additional Notes' : 'Brief Description *'}
            </label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder={schema.length > 0 ? 'Anything else we should know?' : 'Tell us what you need for this service...'} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* File upload */}
          <div>
            <label style={labelStyle}>Attachments</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input type="file" id="svc-file-input" multiple style={{ display: 'none' }} onChange={handleFileChange} />
              <button onClick={() => document.getElementById('svc-file-input').click()} style={btnGhost}>
                <Upload size={13} /> Choose Files
              </button>
              {files.map((f, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', background: 'var(--bg)', borderRadius: 6, color: 'var(--tx-2)', border: '1px solid var(--border)' }}>
                  <FileText size={10} /> {f.name}
                  <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex' }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button style={{ ...btnGhost, flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...btnPrimary, flex: 2 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="spin" /> : <><ArrowRight size={14} /> Submit Request</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Service Editor Modal ──
function ServiceEditorModal({ service, onClose, onSave }) {
  const [form, setForm] = useState({
    name: service?.name || '',
    description: service?.description || '',
    category: service?.category || '',
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, width: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--tx-1)' }}>
            {service?.id ? 'Edit Service' : 'New Service'}
          </h2>
          <button onClick={onClose} style={closeBtn}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input style={inputStyle} placeholder="Service name..." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Icon (emoji)</label>
              <input style={inputStyle} placeholder="🎬" value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="What does this service include?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Category *</label>
              <input style={inputStyle} placeholder="e.g. Video Production" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Turnaround</label>
              <input style={inputStyle} placeholder="e.g. 2-3 days" value={form.turnaround_text} onChange={e => setForm(p => ({ ...p, turnaround_text: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Deliverable Type</label>
              <select style={inputStyle} value={form.deliverable_type} onChange={e => setForm(p => ({ ...p, deliverable_type: e.target.value }))}>
                <option value="">None</option>
                <option value="video">Video</option>
                <option value="image">Image</option>
                <option value="document">Document</option>
                <option value="design">Design</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Offer Track</label>
              <select style={inputStyle} value={form.offer_track} onChange={e => setForm(p => ({ ...p, offer_track: e.target.value }))}>
                <option value="">None</option>
                <option value="ONE_OFF">One-Time</option>
                <option value="DFY_CORE">DFY Core</option>
                <option value="BOOK_CALL">Book a Call</option>
                <option value="RETAINER">Retainer</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Sort Order</label>
              <input style={inputStyle} type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>CTA Label</label>
              <input style={inputStyle} placeholder="e.g. Book Now" value={form.cta_label} onChange={e => setForm(p => ({ ...p, cta_label: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>CTA URL</label>
              <input style={inputStyle} placeholder="https://..." value={form.cta_url} onChange={e => setForm(p => ({ ...p, cta_url: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Default Request Title</label>
            <input style={inputStyle} placeholder="Auto-fill for request title" value={form.default_title} onChange={e => setForm(p => ({ ...p, default_title: e.target.value }))} />
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 24 }}>
            <ToggleField label="Active" value={form.active} onChange={v => setForm(p => ({ ...p, active: v }))} />
            <ToggleField label="Visible to Clients" value={form.client_visible} onChange={v => setForm(p => ({ ...p, client_visible: v }))} />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button style={{ ...btnGhost, flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...btnPrimary, flex: 2 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : service?.id ? 'Save Changes' : 'Create Service'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleField({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: value ? '#22c55e' : 'var(--bg)', position: 'relative', transition: 'background .15s' }}
      >
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 20 : 2, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
      </button>
      <span style={{ fontSize: 13, fontWeight: 500, color: value ? 'var(--tx-1)' : 'var(--tx-3)' }}>{label}</span>
    </div>
  );
}

// ── Seed Banner ──
function SeedBanner({ onSeed }) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await ax().post(`${API}/service-templates/seed`);
      toast.success('Service catalog seeded!');
      onSeed();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to seed catalog');
    } finally { setSeeding(false); }
  };

  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <ShoppingBag size={28} style={{ color: 'var(--tx-3)' }} />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: 'var(--tx-1)' }}>Service Catalog Empty</h2>
      <p style={{ fontSize: 14, color: 'var(--tx-3)', margin: '0 0 24px', lineHeight: 1.6, maxWidth: 400, marginInline: 'auto' }}>
        Seed the default RRG service catalog to get started. You can customize everything after.
      </p>
      <button onClick={handleSeed} style={btnPrimary} disabled={seeding}>
        {seeding ? <Loader2 size={14} className="spin" /> : <><Zap size={14} /> Seed Service Catalog</>}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [view, setView] = useState(() => localStorage.getItem('services_view') || 'grid');
  const [showAdmin, setShowAdmin] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const isAdmin = user?.role === 'Administrator';
  const isClient = user?.role === 'Media Client' || user?.account_type === 'Media Client';

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin ? `${API}/service-templates/all` : `${API}/service-templates`;
      const r = await ax().get(endpoint);
      if (r.data && r.data.length > 0) {
        setServices(r.data);
        setUsedFallback(false);
      } else {
        setServices([]);
        setUsedFallback(true);
      }
    } catch {
      setServices([]);
      setUsedFallback(true);
    } finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { fetchServices(); }, [fetchServices]);
  useEffect(() => { localStorage.setItem('services_view', view); }, [view]);

  // Categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(services.map(s => s.category).filter(Boolean)));
    return ['All', ...cats.sort()];
  }, [services]);

  // Filtered
  const filtered = useMemo(() => {
    return services
      .filter(s => activeCategory === 'All' || s.category === activeCategory)
      .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.description || '').toLowerCase().includes(search.toLowerCase()));
  }, [services, activeCategory, search]);

  // KPIs
  const kpis = useMemo(() => {
    const active = services.filter(s => s.active !== false);
    const cats = new Set(services.map(s => s.category).filter(Boolean));
    const visible = services.filter(s => s.client_visible !== false);
    return { total: services.length, active: active.length, categories: cats.size, visible: visible.length };
  }, [services]);

  // Admin delete
  const handleDelete = async (svc, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete "${svc.name}"?`)) return;
    try {
      await ax().delete(`${API}/service-templates/${svc.id}`);
      toast.success('Service deleted');
      fetchServices();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 60 }}>
        <Loader2 size={28} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  if (isAdmin && usedFallback && services.length === 0) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        <SeedBanner onSeed={fetchServices} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {selectedService && <RequestModal service={selectedService} onClose={() => setSelectedService(null)} />}
      {editingService !== null && (
        <ServiceEditorModal
          service={editingService || undefined}
          onClose={() => setEditingService(null)}
          onSave={fetchServices}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>
            {isClient ? 'Order Services' : 'Services'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '4px 0 0' }}>
            {isClient ? 'Browse and request professional services' : 'Manage your service catalog and templates'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <>
              <button style={btnSecondary} onClick={() => setShowAdmin(!showAdmin)}>
                <Settings size={14} /> {showAdmin ? 'Client View' : 'Admin'}
              </button>
              <button style={btnPrimary} onClick={() => setEditingService({})}>
                <Plus size={14} /> New Service
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Bar (admin only) */}
      {isAdmin && showAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Services', value: kpis.total, icon: Package, color: 'var(--accent)' },
            { label: 'Active', value: kpis.active, icon: Zap, color: 'var(--green)' },
            { label: 'Categories', value: kpis.categories, icon: Layers, color: 'var(--purple)' },
            { label: 'Client Visible', value: kpis.visible, icon: Eye, color: 'var(--blue)' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const CIcon = getCatIcon(cat === 'All' ? 'default' : cat);
            const isActive = activeCategory === cat;
            const color = cat === 'All' ? 'var(--accent)' : getCatColor(cat);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                  borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${isActive ? color : 'var(--border)'}`,
                  background: isActive ? `${color}18` : 'var(--card)',
                  color: isActive ? color : 'var(--tx-3)',
                  transition: 'all .12s', whiteSpace: 'nowrap',
                }}
              >
                {cat !== 'All' && <CIcon size={13} />}
                {cat}
                {cat !== 'All' && (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    ({services.filter(s => s.category === cat).length})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            style={{ ...inputStyle, paddingLeft: 32, width: 200 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <button onClick={() => setView('grid')} style={{ ...viewBtn, background: view === 'grid' ? 'var(--accent)' : 'var(--card)', color: view === 'grid' ? '#fff' : 'var(--tx-3)' }}>
            <Grid3X3 size={16} />
          </button>
          <button onClick={() => setView('list')} style={{ ...viewBtn, background: view === 'list' ? 'var(--accent)' : 'var(--card)', color: view === 'list' ? '#fff' : 'var(--tx-3)' }}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Quality banner */}
      {!showAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, fontSize: 12, color: 'var(--tx-2)' }}>
          <CheckCircle2 size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
          Fulfilled by vetted RRG partners. Quality guaranteed. Billed through your account.
        </div>
      )}

      {/* Service Grid/List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <ShoppingBag size={40} style={{ color: 'var(--tx-3)', opacity: 0.4, marginBottom: 12 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 4 }}>
            {services.length === 0 ? 'No services available' : 'No services match your search'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>
            {services.length === 0 ? 'Services will appear here once configured.' : 'Try a different search term or category.'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(service => (
            <ServiceCard
              key={service.id || service.name}
              service={service}
              isAdmin={isAdmin && showAdmin}
              onSelect={() => setSelectedService(service)}
              onEdit={(e) => { e.stopPropagation(); setEditingService(service); }}
              onDelete={(e) => handleDelete(service, e)}
            />
          ))}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {filtered.map((service, i) => (
            <ServiceRow
              key={service.id || service.name}
              service={service}
              isAdmin={isAdmin && showAdmin}
              isLast={i === filtered.length - 1}
              onSelect={() => setSelectedService(service)}
              onEdit={(e) => { e.stopPropagation(); setEditingService(service); }}
              onDelete={(e) => handleDelete(service, e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Service Card (grid) ──
function ServiceCard({ service, isAdmin, onSelect, onEdit, onDelete }) {
  const CatIcon = getCatIcon(service.category);
  const catColor = getCatColor(service.category);
  const flow = service.offer_track ? FLOW_LABELS[service.offer_track] : null;
  const inactive = service.active === false;
  const hidden = service.client_visible === false;

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: 0, cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
        overflow: 'hidden', opacity: inactive ? 0.5 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = catColor; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${catColor}15`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: catColor }} />

      <div style={{ padding: '18px 20px' }}>
        {/* Admin badges */}
        {isAdmin && (inactive || hidden) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {inactive && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--red)', color: '#fff' }}>Inactive</span>}
            {hidden && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--bg)', color: 'var(--tx-3)', border: '1px solid var(--border)' }}><EyeOff size={9} style={{ marginRight: 3, display: 'inline' }} />Hidden</span>}
          </div>
        )}

        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: `${catColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {service.icon ? <span style={{ fontSize: 22 }}>{service.icon}</span> : <CatIcon size={22} style={{ color: catColor }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 2px', lineHeight: 1.3 }}>{service.name}</h3>
            <span style={{ fontSize: 11, color: catColor, fontWeight: 600 }}>{service.category}</span>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.55, margin: '0 0 14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {service.description}
        </p>

        {/* Badges row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={metaBadge}><Clock size={10} /> {service.turnaround_text || 'TBD'}</span>
          {flow && <span style={{ ...metaBadge, background: flow.bg, color: flow.color, borderColor: `${flow.color}30` }}>{flow.label}</span>}
          {service.deliverable_type && (
            <span style={metaBadge}>
              {React.createElement(DELIVERABLE_ICONS[service.deliverable_type] || DELIVERABLE_ICONS.default, { size: 10 })}
              {' '}{service.deliverable_type}
            </span>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {isAdmin ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={onEdit} style={iconBtn} title="Edit"><Pencil size={13} /></button>
              <button onClick={onDelete} style={{ ...iconBtn, color: 'var(--red)' }} title="Delete"><Trash2 size={13} /></button>
            </div>
          ) : (
            <span />
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: catColor }}>
            {service.cta_label || 'Request'} <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Service Row (list) ──
function ServiceRow({ service, isAdmin, isLast, onSelect, onEdit, onDelete }) {
  const CatIcon = getCatIcon(service.category);
  const catColor = getCatColor(service.category);
  const flow = service.offer_track ? FLOW_LABELS[service.offer_track] : null;
  const inactive = service.active === false;

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: 'pointer', transition: 'background .12s', opacity: inactive ? 0.5 : 1,
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width: 40, height: 40, borderRadius: 8, background: `${catColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {service.icon ? <span style={{ fontSize: 20 }}>{service.icon}</span> : <CatIcon size={20} style={{ color: catColor }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-1)' }}>{service.name}</span>
          {inactive && isAdmin && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: 'var(--red)', color: '#fff' }}>Inactive</span>}
        </div>
        <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{service.description?.substring(0, 80)}{service.description?.length > 80 ? '…' : ''}</span>
      </div>

      <span style={{ ...metaBadge, flexShrink: 0 }}><Clock size={10} /> {service.turnaround_text || 'TBD'}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: catColor, flexShrink: 0, minWidth: 90, textAlign: 'right' }}>{service.category}</span>

      {flow && <span style={{ ...metaBadge, flexShrink: 0, background: flow.bg, color: flow.color }}>{flow.label}</span>}

      {isAdmin && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={onEdit} style={iconBtn} title="Edit"><Pencil size={13} /></button>
          <button onClick={onDelete} style={{ ...iconBtn, color: 'var(--red)' }} title="Delete"><Trash2 size={13} /></button>
        </div>
      )}

      <ArrowRight size={14} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
    </div>
  );
}

// ═══════════════════════════════════════
// STYLES
// ═══════════════════════════════════════
const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
  justifyContent: 'center',
};
const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
  background: 'var(--card)', color: 'var(--tx-1)', border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 13, fontWeight: 500, cursor: 'pointer',
};
const btnGhost = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
  background: 'none', border: '1px solid var(--border)', borderRadius: 7,
  fontSize: 12, fontWeight: 500, color: 'var(--tx-2)', cursor: 'pointer',
};
const inputStyle = {
  width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--tx-1)', fontSize: 13, outline: 'none',
};
const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', display: 'block', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
const metaBadge = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
  padding: '3px 9px', borderRadius: 20, background: 'var(--bg)', color: 'var(--tx-2)',
  border: '1px solid var(--border)',
};
const viewBtn = {
  padding: '6px 10px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
};
const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
  background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6,
  color: 'var(--tx-3)', transition: 'all 0.15s',
};
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
};
const modalStyle = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
  maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
};
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)',
  padding: 4, flexShrink: 0, display: 'flex',
};

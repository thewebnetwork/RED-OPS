import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ShoppingBag, Loader2, X, ChevronRight, Clock, Plus, Search,
  Upload, FileText, CheckCircle2, ArrowRight, Settings,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

// ── Fallback catalog (shown only while API loads or if seed hasn't run) ──────
const FALLBACK_SERVICES = [
  { id: 'f1', name: 'Video Ad Edit (30s)',      category: 'Video Production',   icon: '🎬', description: 'Professional 30-second video ad edit with color grading and effects', turnaround_text: '2-3 days',  form_schema: [] },
  { id: 'f2', name: 'Video Ad Edit (60s)',      category: 'Video Production',   icon: '🎬', description: 'Complete 60-second commercial video production and editing',         turnaround_text: '3-5 days',  form_schema: [] },
  { id: 'f3', name: 'Reel / Short Form Edit',   category: 'Video Production',   icon: '📱', description: 'Fast-paced social media reel editing with trends and music sync',    turnaround_text: '1-2 days',  form_schema: [] },
  { id: 'f4', name: 'Ad Creative Set (5 imgs)', category: 'Design & Creative',  icon: '🎨', description: 'High-converting ad creative designs optimized for your platform',   turnaround_text: '2-3 days',  form_schema: [] },
  { id: 'f5', name: 'Thumbnail Pack (10)',       category: 'Design & Creative',  icon: '📸', description: 'Professional YouTube thumbnails designed for max click-through',     turnaround_text: '2-3 days',  form_schema: [] },
  { id: 'f6', name: 'Landing Page Design',      category: 'Design & Creative',  icon: '🖥️', description: 'Custom high-converting landing page design and layout',              turnaround_text: '4-7 days',  form_schema: [] },
  { id: 'f7', name: 'Meta Ads Setup & Launch',  category: 'Ads & Marketing',    icon: '📊', description: 'Complete Facebook/Instagram ad setup, targeting, and launch',        turnaround_text: '2-3 days',  form_schema: [] },
  { id: 'f8', name: 'Email Sequence (5 emails)',category: 'Copywriting',        icon: '✉️', description: 'Compelling 5-email nurture sequence with sales hooks',              turnaround_text: '2-3 days',  form_schema: [] },
  { id: 'f9', name: '90-min Strategy Call',      category: 'Strategy',           icon: '💡', description: 'Deep-dive strategy session with expert advisor. Includes notes.',     turnaround_text: '1-3 days',  form_schema: [] },
];

// ── Request Modal ────────────────────────────────────────────────────────────
function RequestModal({ service, onClose }) {
  const [formData, setFormData] = useState({});
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  if (!service) return null;

  const schema = service.form_schema || [];

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
    toast.success(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} selected`);
  };

  const handleSubmit = async () => {
    // Validate required fields
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
      // Build rich description from form + description
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '85vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 24 }}>{service.icon || '📋'}</span>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{service.name}</h2>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--tx-3)', margin: 0, lineHeight: 1.5 }}>{service.description}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4, flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* Turnaround badge */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--tx-2)' }}>
            <Clock size={10} /> {service.turnaround_text || 'TBD'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'rgba(168,85,247,.1)', color: '#a855f7' }}>
            {service.category}
          </span>
        </div>

        {/* Dynamic form fields from service template schema */}
        {schema.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            {schema.map(field => {
              if (field.type === 'file') return null; // Handle files separately
              return (
                <div key={field.field}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {field.label} {field.required && <span style={{ color: 'var(--red)' }}>*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select className="input-field" value={formData[field.field] || ''} onChange={e => handleFieldChange(field.field, e.target.value)}>
                      <option value="">Select...</option>
                      {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea className="input-field" rows={3} placeholder={field.placeholder || ''} value={formData[field.field] || ''} onChange={e => handleFieldChange(field.field, e.target.value)} />
                  ) : field.type === 'toggle' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => handleFieldChange(field.field, !formData[field.field])}
                        style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: formData[field.field] ? '#22c55e' : 'var(--bg-elevated)', position: 'relative', transition: 'background .15s' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: formData[field.field] ? 18 : 2, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{formData[field.field] ? 'Yes' : 'No'}</span>
                    </div>
                  ) : (
                    <input className="input-field" placeholder={field.placeholder || ''} value={formData[field.field] || ''} onChange={e => handleFieldChange(field.field, e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Description (always shown) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {schema.length > 0 ? 'Additional Notes' : 'Brief Description *'}
          </label>
          <textarea className="input-field" rows={3} placeholder={schema.length > 0 ? 'Anything else we should know?' : 'Tell us what you need for this service...'} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* File upload */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Attachments
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input type="file" id="svc-file-input" multiple style={{ display: 'none' }} onChange={handleFileChange} />
            <button onClick={() => document.getElementById('svc-file-input').click()} className="btn-ghost btn-sm" style={{ gap: 4 }}>
              <Upload size={11} /> Choose Files
            </button>
            {files.map((f, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', background: 'var(--bg-elevated)', borderRadius: 4, color: 'var(--tx-2)' }}>
                <FileText size={10} /> {f.name}
                <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex' }}>
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex: 2, gap: 5 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 size={13} className="spin" /> : <><ArrowRight size={13} /> Submit Request</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Seed Banner ────────────────────────────────────────────────────────
function SeedBanner({ onSeed }) {
  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await ax().post(`${API}/service-templates/seed`);
      toast.success('Service catalog seeded! Refreshing...');
      onSeed();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to seed catalog');
    } finally { setSeeding(false); }
  };

  return (
    <div style={{ margin: '0 auto', maxWidth: 480, padding: '60px 20px', textAlign: 'center' }}>
      <ShoppingBag size={40} color="var(--tx-3)" style={{ marginBottom: 16, opacity: 0.5 }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--tx-1)' }}>Service Catalog Empty</h2>
      <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 0 20px', lineHeight: 1.6 }}>
        Seed the default RRG service catalog to get started. You can customize services from Settings after.
      </p>
      <button onClick={handleSeed} className="btn-primary" style={{ gap: 5 }} disabled={seeding}>
        {seeding ? <Loader2 size={13} className="spin" /> : <><Plus size={13} /> Seed Service Catalog</>}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);

  const isAdmin = user?.role === 'Administrator';

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ax().get(`${API}/service-templates`);
      if (r.data && r.data.length > 0) {
        setServices(r.data);
        setUsedFallback(false);
      } else {
        // No services in DB — show fallback for clients, seed prompt for admins
        setServices(FALLBACK_SERVICES);
        setUsedFallback(true);
      }
    } catch {
      // API error — use fallback silently
      setServices(FALLBACK_SERVICES);
      setUsedFallback(true);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  // Extract categories dynamically from services
  const categories = ['All', ...Array.from(new Set(services.map(s => s.category).filter(Boolean)))];

  const filtered = services
    .filter(s => activeCategory === 'All' || s.category === activeCategory)
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.description || '').toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="page-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} className="spin" color="var(--tx-3)" />
      </div>
    );
  }

  // Show seed prompt if admin and no services
  if (isAdmin && usedFallback && services === FALLBACK_SERVICES) {
    return (
      <div className="page-fill">
        <SeedBanner onSeed={fetchServices} />
      </div>
    );
  }

  return (
    <div className="page-fill" style={{ flexDirection: 'column', overflow: 'hidden' }}>
      {selectedService && <RequestModal service={selectedService} onClose={() => setSelectedService(null)} />}

      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 2px' }}>Services</h1>
            <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>
              Order professional services from our trusted partner network
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..."
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px 6px 26px', fontSize: 12.5, color: 'var(--tx-1)', outline: 'none', width: 180 }} />
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{
                padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: '1px solid', transition: 'all .1s',
                borderColor: activeCategory === cat ? 'var(--red)' : 'var(--border)',
                background: activeCategory === cat ? 'var(--red-bg)' : 'transparent',
                color: activeCategory === cat ? 'var(--red)' : 'var(--tx-3)',
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Quality banner */}
      <div style={{ padding: '6px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <CheckCircle2 size={11} color="#22c55e" />
        Fulfilled by vetted RRG partners. Quality guaranteed. Billed through your account.
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, alignContent: 'start' }}>
        {filtered.map(service => (
          <div key={service.id || service.name} className="card" style={{ padding: '18px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'all .12s' }}
            onClick={() => setSelectedService(service)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hi)'; e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{service.icon || '📋'}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', margin: 0, lineHeight: 1.3 }}>{service.name}</h3>
                <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 600 }}>{service.category}</span>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--tx-2)', lineHeight: 1.5, margin: '0 0 12px', flex: 1 }}>{service.description}</p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--tx-3)' }}>
                <Clock size={10} /> {service.turnaround_text || 'TBD'}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>
                Request <ArrowRight size={10} />
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '60px 20px', textAlign: 'center' }}>
            <ShoppingBag size={32} color="var(--tx-3)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)', marginBottom: 6 }}>
              {services.length === 0 ? 'No services available' : 'No services match your search'}
            </div>
            <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: '0 auto', maxWidth: 360 }}>
              {services.length === 0 ? 'Services will appear here once configured.' : 'Try a different search term or category.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

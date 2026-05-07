import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, X, Star, Users, Loader2, DollarSign, Clock, Mail,
  Globe, Calendar, Edit3, AlertCircle,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const AVAILABILITY_COLORS = {
  available: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: 'Available' },
  busy: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'Busy' },
  unavailable: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', label: 'Unavailable' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

// ── Add / Edit Freelancer Modal ──────────────────────────────────────────────
function FreelancerDialog({ existing, onSave, onClose, saving }) {
  const isEdit = !!existing?.id;
  const [form, setForm] = useState({
    email: existing?.email || '',
    display_name: existing?.display_name || '',
    skills: (existing?.skills || []).join(', '),
    hourly_rate: existing?.hourly_rate || '',
    typical_turnaround_days: existing?.typical_turnaround_days || '',
    payment_method: existing?.payment_method || '',
    availability_state: existing?.availability_state || 'available',
    timezone: existing?.timezone || '',
    portfolio_url: existing?.portfolio_url || '',
    notes: existing?.notes || '',
  });

  const lblStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' };
  const inpStyle = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' };

  const handleSubmit = () => {
    if (!isEdit && !form.email.trim()) return toast.error('Email is required');
    if (!form.display_name.trim()) return toast.error('Display name is required');
    const payload = {
      ...form,
      email: form.email.trim().toLowerCase(),
      display_name: form.display_name.trim(),
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      hourly_rate: form.hourly_rate === '' ? null : Number(form.hourly_rate),
      typical_turnaround_days: form.typical_turnaround_days === '' ? null : Number(form.typical_turnaround_days),
    };
    if (isEdit) delete payload.email; // can't change email via PATCH
    onSave(payload);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: 560, maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>
            {isEdit ? `Edit ${existing.display_name}` : 'Invite a freelancer'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={18} /></button>
        </div>

        {!isEdit && (
          <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid var(--accent)', fontSize: 12, color: 'var(--tx-2)' }}>
            <Mail size={12} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--accent)' }} />
            A welcome email with a temporary password will be sent. They'll change it on first login.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {!isEdit && (
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={lblStyle}>Email *</label>
              <input style={inpStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="freelancer@example.com" />
            </div>
          )}
          <div>
            <label style={lblStyle}>Display name *</label>
            <input style={inpStyle} value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Mateus" />
          </div>
          <div>
            <label style={lblStyle}>Hourly rate (optional)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', fontSize: 13 }}>$</span>
              <input style={{ ...inpStyle, paddingLeft: 22 }} type="number" min="0" step="0.01" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="50" />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lblStyle}>Skills (comma-separated)</label>
          <input style={inpStyle} value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="video-editing, thumbnail-design, shorts-cutting" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lblStyle}>Typical turnaround (days)</label>
            <input style={inpStyle} type="number" min="0" value={form.typical_turnaround_days} onChange={e => setForm(f => ({ ...f, typical_turnaround_days: e.target.value }))} placeholder="3" />
          </div>
          <div>
            <label style={lblStyle}>Availability</label>
            <select style={inpStyle} value={form.availability_state} onChange={e => setForm(f => ({ ...f, availability_state: e.target.value }))}>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lblStyle}>Payment method</label>
            <input style={inpStyle} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} placeholder="Wise / PayPal / Stripe Connect" />
          </div>
          <div>
            <label style={lblStyle}>Timezone</label>
            <input style={inpStyle} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="America/Edmonton" />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lblStyle}>Portfolio URL</label>
          <input style={inpStyle} value={form.portfolio_url} onChange={e => setForm(f => ({ ...f, portfolio_url: e.target.value }))} placeholder="https://..." />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lblStyle}>Internal notes (admin/operator only)</label>
          <textarea style={{ ...inpStyle, minHeight: 70, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Quirks, billing details, communication preferences..." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={13} className="spin" />}
            {isEdit ? 'Save changes' : 'Send invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Freelancers() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ax().get(`${API}/freelancers`);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load freelancers');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await ax().patch(`${API}/freelancers/${editing.id}`, payload);
        toast.success('Freelancer updated');
      } else {
        await ax().post(`${API}/freelancers`, payload);
        toast.success(`Invite sent — temp password emailed to ${payload.email}`);
      }
      setDialogOpen(false);
      setEditing(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async (f) => {
    if (!window.confirm(`Deactivate ${f.display_name}? They won't be able to log in. Brief history is preserved.`)) return;
    try {
      await ax().delete(`${API}/freelancers/${f.id}`);
      toast.success('Freelancer deactivated');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to deactivate'); }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Freelancers</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>{items.length} on roster</p>
        </div>
        <button onClick={() => { setEditing(null); setDialogOpen(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none' }}>
          <Plus size={14} /> Add Freelancer
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--tx-3)' }}>
          <Users size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--tx-2)' }}>No freelancers yet</p>
          <p style={{ margin: 0, fontSize: 12 }}>Click "Add Freelancer" to invite your first editor.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {items.map(f => {
            const avail = AVAILABILITY_COLORS[f.availability_state] || AVAILABILITY_COLORS.available;
            const inactive = f.active === false;
            return (
              <div key={f.id} className="card" onClick={() => { setEditing(f); setDialogOpen(true); }}
                style={{ padding: 16, cursor: 'pointer', position: 'relative', opacity: inactive ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{f.display_name}</h3>
                    {f.email && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--tx-3)' }}>{f.email}</p>}
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: avail.bg, color: avail.text }}>
                    {inactive ? 'Inactive' : avail.label}
                  </span>
                </div>

                {(f.skills || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {f.skills.slice(0, 5).map((s, i) => (
                      <span key={i} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>{s}</span>
                    ))}
                    {f.skills.length > 5 && <span style={{ padding: '2px 7px', fontSize: 10, color: 'var(--tx-3)' }}>+{f.skills.length - 5}</span>}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, fontSize: 11.5, color: 'var(--tx-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} style={{ color: 'var(--tx-3)' }} />
                    <strong>{f.current_open_briefs ?? 0}</strong> open
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={11} style={{ color: 'var(--tx-3)' }} />
                    <strong>{f.total_briefs_completed ?? 0}</strong> completed
                  </div>
                  {f.avg_rating != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={11} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                      <strong>{f.avg_rating}</strong> ({f.rating_count})
                    </div>
                  )}
                  {f.hourly_rate != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <DollarSign size={11} style={{ color: 'var(--tx-3)' }} />
                      <strong>{f.hourly_rate}</strong>/hr
                    </div>
                  )}
                </div>

                {f.last_assigned_at && (
                  <div style={{ fontSize: 10.5, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={10} /> Last assigned {fmtDate(f.last_assigned_at)}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <button onClick={e => { e.stopPropagation(); setEditing(f); setDialogOpen(true); }}
                    style={{ flex: 1, padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Edit3 size={11} /> Edit
                  </button>
                  {!inactive && (
                    <button onClick={e => { e.stopPropagation(); handleDeactivate(f); }}
                      style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#ef4444', border: '1px solid var(--border)' }}>
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <FreelancerDialog
          existing={editing}
          onSave={handleSave}
          onClose={() => { setDialogOpen(false); setEditing(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}

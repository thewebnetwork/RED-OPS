import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, X, Loader2, Filter, ClipboardList, Calendar, AlertCircle,
  Video, Image, Smartphone, Palette, FileText, MoreHorizontal, ChevronRight,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const BRIEF_TYPE_ICONS = {
  'video-edit': Video,
  thumbnail: Image,
  'shorts-cut': Smartphone,
  design: Palette,
  writing: FileText,
  other: MoreHorizontal,
};

const STATUS_PILL = {
  draft:                 { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: 'Draft' },
  sent:                  { bg: 'rgba(59,130,246,0.15)',  fg: '#3b82f6', label: 'Sent' },
  acknowledged:          { bg: 'rgba(59,130,246,0.15)',  fg: '#3b82f6', label: 'Acknowledged' },
  'in-progress':         { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b', label: 'In Progress' },
  submitted:             { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b', label: 'Submitted' },
  'in-review':           { bg: 'rgba(245,158,11,0.15)',  fg: '#f59e0b', label: 'In Review' },
  'revisions-requested': { bg: 'rgba(239,68,68,0.15)',   fg: '#ef4444', label: 'Revisions' },
  approved:              { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Approved' },
  paid:                  { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Paid' },
  closed:                { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: 'Closed' },
  cancelled:             { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: 'Cancelled' },
};

const COLUMNS = [
  { id: 'active',  label: 'Active',  statuses: ['draft', 'sent', 'acknowledged', 'in-progress'] },
  { id: 'review',  label: 'Review',  statuses: ['submitted', 'in-review', 'revisions-requested'] },
  { id: 'done',    label: 'Done',    statuses: ['approved', 'paid', 'closed'] },
];

function StatusPill({ status }) {
  const cfg = STATUS_PILL[status] || STATUS_PILL.draft;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  );
}

function deadlineRender(deadline) {
  if (!deadline) return null;
  const dd = new Date(deadline);
  const now = new Date();
  const days = Math.ceil((dd - now) / (1000 * 60 * 60 * 24));
  const overdue = days < 0;
  const labelText = overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `${days}d`;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 600, color: overdue ? '#ef4444' : 'var(--tx-3)' }}>
      <Calendar size={10} /> {labelText}
    </span>
  );
}

// ── New Brief Modal — two steps: template, then form ─────────────────────────
function NewBriefDialog({ onClose, onCreated, freelancers, currentUserId }) {
  const [step, setStep] = useState('template'); // template | form
  const [templates, setTemplates] = useState([]);
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    brief_type: 'other',
    deliverable_spec: {},
    deadline: '',
    payment_amount: '',
    payment_currency: 'CAD',
    payment_terms: 'on-approval',
    source_files_text: '',
    output_target_path: '',
    assigned_freelancer_id: '',
    internal_notes: '',
  });

  useEffect(() => {
    ax().get(`${API}/brief-templates`)
      .then(r => setTemplates(r.data.items || []))
      .catch(() => setTemplates([]));
  }, []);

  const lblStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' };
  const inpStyle = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' };

  const pickTemplate = (t) => {
    setPicked(t);
    let deadline = '';
    if (t.recommended_deadline_days) {
      const d = new Date();
      d.setDate(d.getDate() + t.recommended_deadline_days);
      deadline = d.toISOString().slice(0, 10);
    }
    setForm(f => ({
      ...f,
      title: t.label === 'Custom (free-form)' ? '' : t.label,
      description: t.description || '',
      brief_type: t.brief_type || 'other',
      deliverable_spec: t.deliverable_spec || {},
      deadline,
      payment_amount: t.recommended_payment_min ?? '',
    }));
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const source_files = form.source_files_text
        .split('\n').map(s => s.trim()).filter(Boolean)
        .map(p => ({ path: p, label: '', added_by: currentUserId, added_at: now }));
      const body = {
        title: form.title.trim(),
        description: form.description,
        brief_type: form.brief_type,
        deliverable_spec: form.deliverable_spec || {},
        deadline: form.deadline || null,
        payment_amount: form.payment_amount === '' ? null : Number(form.payment_amount),
        payment_currency: form.payment_currency,
        payment_terms: form.payment_terms,
        source_files,
        output_target: form.output_target_path ? { nextcloud_folder_path: form.output_target_path } : {},
        assigned_freelancer_id: form.assigned_freelancer_id || null,
        template_id: picked?.id || null,
        internal_notes: form.internal_notes || null,
      };
      const { data } = await ax().post(`${API}/briefs`, body);
      toast.success('Brief created');
      onCreated(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create brief');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: 720, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>
            {step === 'template' ? 'New brief — pick a template' : `New brief — ${picked?.label || 'Custom'}`}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 4 }}><X size={18} /></button>
        </div>

        {step === 'template' && (
          <div style={{ padding: 20 }}>
            {templates.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--tx-3)' }}><Loader2 size={16} className="spin" /></div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {templates.map(t => {
                const Icon = BRIEF_TYPE_ICONS[t.brief_type] || MoreHorizontal;
                return (
                  <button key={t.id} onClick={() => pickTemplate(t)}
                    style={{ padding: 14, borderRadius: 10, fontSize: 13, textAlign: 'left', background: 'var(--bg-elevated)', color: 'var(--tx-1)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color .12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon size={14} style={{ color: 'var(--accent)' }} />
                      <strong style={{ fontSize: 13 }}>{t.label}</strong>
                    </div>
                    {t.description && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--tx-3)', lineHeight: 1.4 }}>
                        {t.description.slice(0, 120)}{t.description.length > 120 ? '…' : ''}
                      </p>
                    )}
                    {t.recommended_deadline_days && (
                      <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--tx-3)' }}>
                        ~{t.recommended_deadline_days}d turnaround · ${t.recommended_payment_min}–${t.recommended_payment_max}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'form' && (
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={lblStyle}>Title *</label>
              <input style={inpStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Edit Episode 12 — Calgary Buyer Guide" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lblStyle}>Description (markdown)</label>
              <textarea style={{ ...inpStyle, minHeight: 100, resize: 'vertical', fontFamily: 'inherit' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lblStyle}>Brief type</label>
                <select style={inpStyle} value={form.brief_type} onChange={e => setForm(f => ({ ...f, brief_type: e.target.value }))}>
                  <option value="video-edit">Video edit</option>
                  <option value="thumbnail">Thumbnail</option>
                  <option value="shorts-cut">Shorts cut</option>
                  <option value="design">Design</option>
                  <option value="writing">Writing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={lblStyle}>Assign freelancer</label>
                <select style={inpStyle} value={form.assigned_freelancer_id} onChange={e => setForm(f => ({ ...f, assigned_freelancer_id: e.target.value }))}>
                  <option value="">— unassigned —</option>
                  {(freelancers || []).filter(f => f.active !== false).map(f => (
                    <option key={f.id} value={f.user_id}>{f.display_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lblStyle}>Deadline</label>
                <input style={inpStyle} type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div>
                <label style={lblStyle}>Payment amount</label>
                <input style={inpStyle} type="number" min="0" value={form.payment_amount} onChange={e => setForm(f => ({ ...f, payment_amount: e.target.value }))} />
              </div>
              <div>
                <label style={lblStyle}>Currency</label>
                <select style={inpStyle} value={form.payment_currency} onChange={e => setForm(f => ({ ...f, payment_currency: e.target.value }))}>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lblStyle}>Payment terms</label>
              <select style={inpStyle} value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}>
                <option value="on-approval">On approval</option>
                <option value="50-50">50% upfront / 50% on approval</option>
                <option value="net-30">Net 30</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lblStyle}>Source files (one Nextcloud path per line — Phase 1: text only)</label>
              <textarea style={{ ...inpStyle, minHeight: 70, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} value={form.source_files_text} onChange={e => setForm(f => ({ ...f, source_files_text: e.target.value }))} placeholder="/RED OPS Briefs/Taryn/2026-05/raw-footage.mp4" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lblStyle}>Output target folder (Nextcloud path)</label>
              <input style={{ ...inpStyle, fontFamily: 'monospace', fontSize: 12 }} value={form.output_target_path} onChange={e => setForm(f => ({ ...f, output_target_path: e.target.value }))} placeholder="/Clients/Taryn/2026-05/Deliverables/" />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lblStyle}>Internal notes (operator-only, hidden from freelancer)</label>
              <textarea style={{ ...inpStyle, minHeight: 60, resize: 'vertical' }} value={form.internal_notes} onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setStep('template')} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>← Back to templates</button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving && <Loader2 size={13} className="spin" />}
                Create as draft
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page — kanban ───────────────────────────────────────────────────────
export default function Briefs() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [filters, setFilters] = useState({ freelancer: '', brief_type: '', status: '', deadline: 'all' });
  const [showCancelled, setShowCancelled] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [me, setMe] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.freelancer) params.freelancer = filters.freelancer;
      if (filters.brief_type) params.brief_type = filters.brief_type;
      if (filters.status) params.status = filters.status;
      if (filters.deadline === 'overdue') {
        params.deadline_before = new Date().toISOString().slice(0, 10);
      } else if (filters.deadline === 'this-week') {
        const d = new Date(); d.setDate(d.getDate() + 7);
        params.deadline_before = d.toISOString().slice(0, 10);
      } else if (filters.deadline === 'this-month') {
        const d = new Date(); d.setMonth(d.getMonth() + 1);
        params.deadline_before = d.toISOString().slice(0, 10);
      }
      const [bRes, fRes, meRes] = await Promise.allSettled([
        ax().get(`${API}/briefs`, { params }),
        ax().get(`${API}/freelancers`),
        ax().get(`${API}/auth/me`),
      ]);
      if (bRes.status === 'fulfilled') setItems(bRes.value.data.items || []);
      if (fRes.status === 'fulfilled') setFreelancers(Array.isArray(fRes.value.data) ? fRes.value.data : []);
      if (meRes.status === 'fulfilled') setMe(meRes.value.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load briefs');
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = items.filter(b => showCancelled || b.status !== 'cancelled');
  const cancelledCount = items.filter(b => b.status === 'cancelled').length;
  const grouped = COLUMNS.map(col => ({
    ...col,
    items: filtered.filter(b => col.statuses.includes(b.status)),
  }));

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  const selStyle = { padding: '6px 10px', fontSize: 12, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>Briefs</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--tx-3)' }}>{filtered.length} brief{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <button onClick={() => setDialogOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none' }}>
          <Plus size={14} /> New Brief
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--tx-3)' }} />
        <select style={selStyle} value={filters.freelancer} onChange={e => setFilters(f => ({ ...f, freelancer: e.target.value }))}>
          <option value="">All freelancers</option>
          {freelancers.map(f => <option key={f.id} value={f.user_id}>{f.display_name}</option>)}
        </select>
        <select style={selStyle} value={filters.brief_type} onChange={e => setFilters(f => ({ ...f, brief_type: e.target.value }))}>
          <option value="">All types</option>
          <option value="video-edit">Video edit</option>
          <option value="thumbnail">Thumbnail</option>
          <option value="shorts-cut">Shorts cut</option>
          <option value="design">Design</option>
          <option value="writing">Writing</option>
          <option value="other">Other</option>
        </select>
        <select style={selStyle} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_PILL).map(s => <option key={s} value={s}>{STATUS_PILL[s].label}</option>)}
        </select>
        <select style={selStyle} value={filters.deadline} onChange={e => setFilters(f => ({ ...f, deadline: e.target.value }))}>
          <option value="all">Any deadline</option>
          <option value="overdue">Overdue</option>
          <option value="this-week">This week</option>
          <option value="this-month">This month</option>
        </select>
        {cancelledCount > 0 && (
          <button onClick={() => setShowCancelled(v => !v)} style={{ ...selStyle, cursor: 'pointer' }}>
            {showCancelled ? 'Hide' : 'Show'} cancelled ({cancelledCount})
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS.length}, 1fr)`, gap: 14, alignItems: 'flex-start' }}>
        {grouped.map(col => (
          <div key={col.id} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 12, minHeight: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{col.label}</h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)' }}>{col.items.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.items.length === 0 && (
                <p style={{ margin: 0, padding: 14, fontSize: 11.5, color: 'var(--tx-3)', textAlign: 'center' }}>No briefs</p>
              )}
              {col.items.map(b => {
                const Icon = BRIEF_TYPE_ICONS[b.brief_type] || MoreHorizontal;
                const freelancer = freelancers.find(f => f.user_id === b.assigned_freelancer_id);
                return (
                  <div key={b.id} onClick={() => navigate(`/briefs/${b.id}`)}
                    style={{ padding: 10, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color .12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <Icon size={12} style={{ color: 'var(--tx-3)', flexShrink: 0 }} />
                        <strong style={{ fontSize: 12.5, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title || '(untitled)'}</strong>
                      </div>
                      <StatusPill status={b.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                        {freelancer ? freelancer.display_name : '— unassigned —'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {deadlineRender(b.deadline)}
                        {b.payment_amount != null && (
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--tx-2)' }}>
                            ${Number(b.payment_amount).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {dialogOpen && me && (
        <NewBriefDialog
          freelancers={freelancers}
          currentUserId={me.id}
          onClose={() => setDialogOpen(false)}
          onCreated={(b) => { setDialogOpen(false); navigate(`/briefs/${b.id}`); }}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, X, Loader2, Send, FolderOpen, FileText, MessageSquare,
  Clock, Star, AlertCircle, CheckCircle2, Trash2, RefreshCw, DollarSign,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

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

function StatusPill({ status }) {
  const cfg = STATUS_PILL[status] || STATUS_PILL.draft;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  );
}

// ── Rate Freelancer Modal ────────────────────────────────────────────────────
function RateDialog({ briefId, onClose, onRated }) {
  const [form, setForm] = useState({ quality: 5, speed: 5, communication: 5, rehire: true, notes: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await ax().post(`${API}/briefs/${briefId}/rate`, form);
      toast.success('Rating saved');
      onRated();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save rating');
    } finally { setSaving(false); }
  };

  const Slider = ({ label, value, onChange }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)' }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>{value}/5</span>
      </div>
      <input type="range" min="1" max="5" value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#f59e0b' }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: 480, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Rate freelancer</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={18} /></button>
        </div>
        <Slider label="Quality" value={form.quality} onChange={v => setForm(f => ({ ...f, quality: v }))} />
        <Slider label="Speed" value={form.speed} onChange={v => setForm(f => ({ ...f, speed: v }))} />
        <Slider label="Communication" value={form.communication} onChange={v => setForm(f => ({ ...f, communication: v }))} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 13, color: 'var(--tx-1)' }}>
          <input type="checkbox" checked={form.rehire} onChange={e => setForm(f => ({ ...f, rehire: e.target.checked }))} />
          Would re-hire
        </label>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Internal notes (not shown to freelancer)</label>
          <textarea style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', minHeight: 70, resize: 'vertical', boxSizing: 'border-box' }}
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#f59e0b', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
            {saving && <Loader2 size={13} className="spin" />}
            <Star size={13} /> Save rating
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reassign / Notes Prompt (shared minimal dialog) ──────────────────────────
function PromptDialog({ title, label, placeholder, onClose, onSubmit, submitText = 'Submit' }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => { setSaving(true); try { await onSubmit(value); } finally { setSaving(false); } };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: 460, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>{title}</h3>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</label>
        <textarea autoFocus style={{ width: '100%', minHeight: 90, padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
          placeholder={placeholder} value={value} onChange={e => setValue(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
            {saving && <Loader2 size={13} className="spin" />}
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reassign Dialog (selectable freelancer) ──────────────────────────────────
function ReassignDialog({ freelancers, currentId, onClose, onSubmit }) {
  const [pick, setPick] = useState(currentId || '');
  const [saving, setSaving] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: 420, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Reassign brief</h3>
        <select autoFocus value={pick} onChange={e => setPick(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none' }}>
          <option value="">— unassigned —</option>
          {freelancers.filter(f => f.active !== false).map(f => (
            <option key={f.id} value={f.user_id}>{f.display_name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={async () => { setSaving(true); try { await onSubmit(pick); } finally { setSaving(false); } }}
            disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
            {saving && <Loader2 size={13} className="spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function BriefDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState(null);
  const [freelancers, setFreelancers] = useState([]);
  const [tab, setTab] = useState('overview');
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [posting, setPosting] = useState(false);

  // Modal state
  const [rateOpen, setRateOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(null); // 'cancel' | 'revisions' | null

  const fetchBrief = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, fRes] = await Promise.allSettled([
        ax().get(`${API}/briefs/${id}`),
        ax().get(`${API}/freelancers`),
      ]);
      if (bRes.status === 'fulfilled') setBrief(bRes.value.data);
      else throw bRes.reason;
      if (fRes.status === 'fulfilled') setFreelancers(Array.isArray(fRes.value.data) ? fRes.value.data : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load brief');
      navigate('/briefs');
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { fetchBrief(); }, [fetchBrief]);

  useEffect(() => {
    if (!brief) return;
    if (tab === 'comments') {
      ax().get(`${API}/briefs/${id}/messages`).then(r => setMessages(r.data || [])).catch(() => {});
    }
    if (tab === 'history') {
      ax().get(`${API}/briefs/${id}/history`).then(r => setHistory(r.data || [])).catch(() => {});
    }
  }, [tab, id, brief]);

  const transition = async (to_status, extra = {}) => {
    try {
      await ax().post(`${API}/briefs/${id}/transition`, { to_status, ...extra });
      toast.success(`Moved to ${to_status}`);
      fetchBrief();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transition failed');
    }
  };

  const reassign = async (newId) => {
    try {
      await ax().patch(`${API}/briefs/${id}`, { assigned_freelancer_id: newId || null });
      toast.success('Reassigned');
      setReassignOpen(false);
      fetchBrief();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reassign');
    }
  };

  const deleteBrief = async () => {
    if (!window.confirm('Delete this draft brief permanently?')) return;
    try {
      await ax().delete(`${API}/briefs/${id}`);
      toast.success('Deleted');
      navigate('/briefs');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete'); }
  };

  const postMessage = async () => {
    const body = msgInput.trim();
    if (!body) return;
    setPosting(true);
    try {
      const { data } = await ax().post(`${API}/briefs/${id}/messages`, { body, attachments: [] });
      setMessages(m => [...m, data]);
      setMsgInput('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post');
    } finally { setPosting(false); }
  };

  if (loading || !brief) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={20} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  const freelancer = freelancers.find(f => f.user_id === brief.assigned_freelancer_id);

  // Action buttons by status
  const actions = [];
  if (brief.status === 'draft') {
    actions.push({ label: 'Send to freelancer', icon: Send, fn: () => transition('sent'), primary: true, disabled: !brief.assigned_freelancer_id });
    actions.push({ label: 'Delete', icon: Trash2, fn: deleteBrief, danger: true });
  } else if (['sent','acknowledged','in-progress','revisions-requested'].includes(brief.status)) {
    actions.push({ label: 'Reassign', icon: RefreshCw, fn: () => setReassignOpen(true) });
    actions.push({ label: 'Cancel brief', icon: X, fn: () => setReasonOpen('cancel'), danger: true });
  } else if (['submitted','in-review'].includes(brief.status)) {
    actions.push({ label: 'Approve', icon: CheckCircle2, fn: () => transition('approved'), primary: true });
    actions.push({ label: 'Request revisions', icon: RefreshCw, fn: () => setReasonOpen('revisions') });
    if (brief.status === 'submitted') {
      actions.push({ label: 'Open for review', icon: AlertCircle, fn: () => transition('in-review') });
    }
  } else if (brief.status === 'approved') {
    actions.push({ label: 'Mark paid', icon: DollarSign, fn: () => transition('paid'), primary: true });
  } else if (brief.status === 'paid') {
    actions.push({ label: 'Close', icon: CheckCircle2, fn: () => transition('closed'), primary: true });
  } else if (brief.status === 'closed') {
    actions.push({ label: 'Rate freelancer', icon: Star, fn: () => setRateOpen(true), primary: true });
  }

  const tabs = [
    { id: 'overview',     label: 'Overview',     icon: FileText },
    { id: 'source-files', label: 'Source Files', icon: FolderOpen },
    { id: 'deliverables', label: 'Deliverables', icon: FolderOpen },
    { id: 'comments',     label: 'Comments',     icon: MessageSquare },
    { id: 'history',      label: 'History',      icon: Clock },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '20px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={() => navigate('/briefs')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={14} /> All briefs
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'flex-start' }}>
        {/* Main content */}
        <div>
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx-1)', margin: 0 }}>{brief.title}</h1>
            <StatusPill status={brief.status} />
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: tab === t.id ? 'var(--accent)' : 'var(--tx-3)', border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="card" style={{ padding: 18 }}>
              <Grid label="Description" value={brief.description || <em style={{ color: 'var(--tx-3)' }}>(no description)</em>} pre />
              <Grid label="Brief type" value={brief.brief_type} />
              <Grid label="Deadline" value={brief.deadline || '—'} />
              <Grid label="Payment" value={brief.payment_amount != null ? `${brief.payment_amount} ${brief.payment_currency || ''} (${brief.payment_terms})` : '—'} />
              <Grid label="Assigned to" value={freelancer ? freelancer.display_name : '— unassigned —'} />
              {brief.client_id && <Grid label="Client (internal)" value={brief.client_id} />}
              {brief.deliverable_spec && Object.keys(brief.deliverable_spec).length > 0 && (
                <Grid label="Deliverable spec" value={
                  <pre style={{ margin: 0, padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 11.5, overflowX: 'auto' }}>
                    {JSON.stringify(brief.deliverable_spec, null, 2)}
                  </pre>
                } />
              )}
              {brief.internal_notes && <Grid label="Internal notes (admin/operator only)" value={brief.internal_notes} pre />}
              {brief.revision_count > 0 && <Grid label="Revisions" value={String(brief.revision_count)} />}
            </div>
          )}

          {tab === 'source-files' && (
            <div className="card" style={{ padding: 18 }}>
              {(brief.source_files || []).length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-3)' }}>No source files attached. <em>(Phase 1: text paths only — Nextcloud bridge in Phase 2.)</em></p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {brief.source_files.map((sf, i) => (
                    <li key={i} style={{ padding: '8px 0', borderBottom: i + 1 < brief.source_files.length ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <code style={{ fontSize: 12, color: 'var(--tx-1)', wordBreak: 'break-all' }}>{sf.path}</code>
                      {sf.label && <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{sf.label}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'deliverables' && (
            <div className="card" style={{ padding: 18 }}>
              {(brief.deliverables || []).length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-3)' }}>
                  No deliverables submitted yet. They'll appear here when the freelancer submits.
                </p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {brief.deliverables.map((d, i) => (
                    <li key={i} style={{ padding: '8px 0', borderBottom: i + 1 < brief.deliverables.length ? '1px solid var(--border)' : 'none' }}>
                      <code style={{ fontSize: 12, color: 'var(--tx-1)', wordBreak: 'break-all' }}>{d.path || JSON.stringify(d)}</code>
                      {d.label && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--tx-3)' }}>{d.label}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div>
              <div className="card" style={{ padding: 18, marginBottom: 12 }}>
                {messages.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-3)', textAlign: 'center' }}>No messages yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {messages.map(m => (
                      <div key={m.id} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-elevated)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <strong style={{ fontSize: 12, color: 'var(--tx-1)' }}>{m.author_name || 'Unknown'} <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>· {m.author_role}</span></strong>
                          <span style={{ fontSize: 10.5, color: 'var(--tx-3)' }}>{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-2)', whiteSpace: 'pre-wrap' }}>{m.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card" style={{ padding: 14 }}>
                <textarea value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Write a message…"
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', minHeight: 70, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={postMessage} disabled={posting || !msgInput.trim()}
                    style={{ padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 5, opacity: posting || !msgInput.trim() ? 0.5 : 1 }}>
                    <Send size={11} /> Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="card" style={{ padding: 18 }}>
              {history.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-3)' }}>No history yet.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {history.map((h, i) => (
                    <li key={h.id || i} style={{ display: 'flex', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottom: i + 1 < history.length ? '1px dashed var(--border)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 12.5, color: 'var(--tx-1)' }}>{h.event}</strong>
                        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>
                          {h.by_user_name || 'system'} · {new Date(h.created_at).toLocaleString()}
                        </div>
                        {h.payload && Object.keys(h.payload).length > 0 && (
                          <pre style={{ margin: '4px 0 0', padding: 6, fontSize: 10.5, background: 'var(--bg-elevated)', borderRadius: 4, color: 'var(--tx-2)' }}>
                            {JSON.stringify(h.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right rail */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Assignee</div>
            <div style={{ fontSize: 13, color: 'var(--tx-1)' }}>{freelancer ? freelancer.display_name : '— unassigned —'}</div>
          </div>

          {actions.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actions.map((a, i) => (
                  <button key={i} onClick={a.fn} disabled={a.disabled}
                    title={a.disabled ? 'Assign a freelancer first' : ''}
                    style={{ padding: '8px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: a.disabled ? 'not-allowed' : 'pointer',
                      background: a.primary ? 'var(--accent)' : (a.danger ? 'transparent' : 'var(--bg-elevated)'),
                      color: a.primary ? '#fff' : (a.danger ? '#ef4444' : 'var(--tx-1)'),
                      border: a.primary ? 'none' : '1px solid var(--border)', opacity: a.disabled ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                    <a.icon size={12} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {rateOpen && <RateDialog briefId={id} onClose={() => setRateOpen(false)} onRated={() => { setRateOpen(false); fetchBrief(); }} />}
      {reassignOpen && <ReassignDialog freelancers={freelancers} currentId={brief.assigned_freelancer_id} onClose={() => setReassignOpen(false)} onSubmit={reassign} />}
      {reasonOpen && (
        <PromptDialog
          title={reasonOpen === 'cancel' ? 'Cancel brief' : 'Request revisions'}
          label="Reason / notes (sent to freelancer)"
          placeholder={reasonOpen === 'cancel' ? 'Why is this being cancelled?' : 'What needs to change?'}
          submitText={reasonOpen === 'cancel' ? 'Cancel brief' : 'Request revisions'}
          onClose={() => setReasonOpen(null)}
          onSubmit={async (notes) => {
            const target = reasonOpen === 'cancel' ? 'cancelled' : 'revisions-requested';
            await transition(target, { notes });
            setReasonOpen(null);
          }}
        />
      )}
    </div>
  );
}

function Grid({ label, value, pre }) {
  return (
    <div style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', paddingTop: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--tx-1)', whiteSpace: pre ? 'pre-wrap' : 'normal' }}>{value}</div>
    </div>
  );
}

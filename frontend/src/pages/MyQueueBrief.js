import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, X, Loader2, Send, FolderOpen, FileText, MessageSquare,
  Clock, CheckCircle2, PlayCircle, Upload,
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
  'revisions-requested': { bg: 'rgba(239,68,68,0.15)',   fg: '#ef4444', label: 'Revisions requested' },
  approved:              { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Approved' },
  paid:                  { bg: 'rgba(34,197,94,0.15)',   fg: '#22c55e', label: 'Paid' },
  closed:                { bg: 'rgba(160,160,160,0.15)', fg: '#a0a0a0', label: 'Closed' },
};

function StatusPill({ status }) {
  const cfg = STATUS_PILL[status] || STATUS_PILL.draft;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.fg }}>
      {cfg.label}
    </span>
  );
}

// ── Submit Modal — paste deliverable paths ───────────────────────────────────
function SubmitDialog({ onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const paths = text.split('\n').map(s => s.trim()).filter(Boolean);
    if (paths.length === 0) {
      toast.error('Add at least one deliverable path');
      return;
    }
    setSaving(true);
    try {
      const deliverables = paths.map(p => ({ path: p, label: '' }));
      await onSubmit({ deliverables, notes });
    } finally { setSaving(false); }
  };

  const inpStyle = { width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--tx-1)', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'relative', width: 540, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Submit work</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 12, color: 'var(--tx-2)' }}>
          Phase 1: paste Nextcloud paths to deliverables (one per line). Phase 2 will let you upload files directly.
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Deliverable paths *</label>
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
            placeholder="/Clients/Taryn/2026-05/Deliverables/episode-12.mp4"
            style={{ ...inpStyle, minHeight: 110, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Anything the reviewer should know"
            style={{ ...inpStyle, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>Cancel</button>
          <button onClick={submit} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'var(--accent)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.6 : 1 }}>
            {saving && <Loader2 size={13} className="spin" />}
            <Upload size={12} /> Submit work
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function MyQueueBrief() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState(null);
  const [tab, setTab] = useState('overview');
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);

  const fetchBrief = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ax().get(`${API}/briefs/${id}`);
      setBrief(data);
      // Auto-acknowledge on first view if currently sent
      if (data.status === 'sent') {
        try {
          await ax().post(`${API}/briefs/${id}/transition`, { to_status: 'acknowledged' });
          const refreshed = await ax().get(`${API}/briefs/${id}`);
          setBrief(refreshed.data);
        } catch { /* non-blocking */ }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load brief');
      navigate('/my-queue');
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
      toast.success(to_status === 'submitted' ? 'Work submitted' : `Moved to ${to_status}`);
      setSubmitOpen(false);
      fetchBrief();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Transition failed');
    }
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

  // Action buttons by status (freelancer-side; no Reassign / Cancel / Approve)
  const actions = [];
  if (brief.status === 'sent') {
    actions.push({ label: 'Acknowledge', icon: CheckCircle2, fn: () => transition('acknowledged'), primary: true });
  } else if (brief.status === 'acknowledged') {
    actions.push({ label: 'Start work', icon: PlayCircle, fn: () => transition('in-progress'), primary: true });
  } else if (brief.status === 'in-progress' || brief.status === 'revisions-requested') {
    actions.push({ label: 'Submit work', icon: Upload, fn: () => setSubmitOpen(true), primary: true });
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
        <button onClick={() => navigate('/my-queue')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={14} /> My Queue
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'flex-start' }}>
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
              {brief.deliverable_spec && Object.keys(brief.deliverable_spec).length > 0 && (
                <Grid label="Deliverable spec" value={
                  <pre style={{ margin: 0, padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 11.5, overflowX: 'auto' }}>
                    {JSON.stringify(brief.deliverable_spec, null, 2)}
                  </pre>
                } />
              )}
              {brief.revision_count > 0 && <Grid label="Revisions" value={String(brief.revision_count)} />}
            </div>
          )}

          {tab === 'source-files' && (
            <div className="card" style={{ padding: 18 }}>
              {(brief.source_files || []).length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-3)' }}>No source files attached.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {brief.source_files.map((sf, i) => (
                    <li key={i} style={{ padding: '8px 0', borderBottom: i + 1 < brief.source_files.length ? '1px solid var(--border)' : 'none' }}>
                      <code style={{ fontSize: 12, color: 'var(--tx-1)', wordBreak: 'break-all' }}>{sf.path}</code>
                      {sf.label && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--tx-3)' }}>{sf.label}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'deliverables' && (
            <div className="card" style={{ padding: 18 }}>
              {(brief.deliverables || []).length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--tx-3)' }}>No deliverables submitted yet.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {brief.deliverables.map((d, i) => (
                    <li key={i} style={{ padding: '8px 0', borderBottom: i + 1 < brief.deliverables.length ? '1px solid var(--border)' : 'none' }}>
                      <code style={{ fontSize: 12, color: 'var(--tx-1)', wordBreak: 'break-all' }}>{d.path || JSON.stringify(d)}</code>
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
                <textarea value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Write a message to the operator…"
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
          {actions.length > 0 && (
            <div className="card" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actions.map((a, i) => (
                  <button key={i} onClick={a.fn}
                    style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      background: a.primary ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: a.primary ? '#fff' : 'var(--tx-1)',
                      border: a.primary ? 'none' : '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                    <a.icon size={13} /> {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {brief.deadline && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Deadline</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>{brief.deadline}</div>
            </div>
          )}
        </div>
      </div>

      {submitOpen && (
        <SubmitDialog
          onClose={() => setSubmitOpen(false)}
          onSubmit={(payload) => transition('submitted', payload)}
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

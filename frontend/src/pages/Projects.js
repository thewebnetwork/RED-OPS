import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Search, ChevronRight, CheckCircle2, Circle, Clock,
  FolderKanban, Users, Calendar, MoreHorizontal, X, Loader2,
  Layers, TrendingUp, AlertTriangle, Sparkles
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const token = () => localStorage.getItem('token');
const req = (path, opts = {}) => fetch(`${API}${path}`, {
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
  ...opts,
}).then(r => r.ok ? r.json() : Promise.reject(r));

// ── RRM Onboarding Checklist (16-step) ──
const ONBOARDING_STEPS = [
  { step: 1,  title: 'Initial kickoff call booked',           category: 'Setup' },
  { step: 2,  title: 'Client intake form completed',          category: 'Setup' },
  { step: 3,  title: 'GHL sub-account created',               category: 'GHL' },
  { step: 4,  title: 'GHL pipeline configured',               category: 'GHL' },
  { step: 5,  title: 'ISA workflow activated',                category: 'GHL' },
  { step: 6,  title: 'Facebook Ad Account access granted',    category: 'Meta' },
  { step: 7,  title: 'Meta Business Manager connected',       category: 'Meta' },
  { step: 8,  title: 'Pixel installed and verified',          category: 'Meta' },
  { step: 9,  title: 'Ad creative assets collected',          category: 'Creative' },
  { step: 10, title: 'First ad campaign drafted',             category: 'Creative' },
  { step: 11, title: 'Campaign reviewed and approved',        category: 'Launch' },
  { step: 12, title: 'Campaign live (ads running)',           category: 'Launch' },
  { step: 13, title: 'First leads flowing into GHL',         category: 'Live' },
  { step: 14, title: 'ISA follow-up sequence tested',        category: 'Live' },
  { step: 15, title: 'Week 1 performance review done',       category: 'Review' },
  { step: 16, title: 'Client onboarding complete ✓',         category: 'Review' },
];

const PROJECT_TYPES = [
  { key: 'client_onboarding', label: 'Client Onboarding', icon: '🚀', desc: 'Auto-generates 16-step RRM onboarding checklist' },
  { key: 'campaign_build',    label: 'Campaign Build',    icon: '📣', desc: 'Ad campaign from brief to launch' },
  { key: 'creative_sprint',   label: 'Creative Sprint',   icon: '🎨', desc: 'Batch of creative deliverables' },
  { key: 'internal',          label: 'Internal',          icon: '⚙️',  desc: 'Team projects, process builds' },
];

const STATUS_CONFIG = {
  active:    { label: 'Active',     color: '#10b981' },
  planning:  { label: 'Planning',   color: '#3b82f6' },
  on_hold:   { label: 'On Hold',    color: '#f59e0b' },
  complete:  { label: 'Complete',   color: '#6b7280' },
};

function StatusBadge({ s }) {
  const cfg = STATUS_CONFIG[s] || { label: s, color: '#6b7280' };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: cfg.color + '20', color: cfg.color, letterSpacing: '.03em' }}>
      {cfg.label}
    </span>
  );
}

function ProgressBar({ value, color = '#10b981' }) {
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 2, transition: 'width .4s ease' }} />
    </div>
  );
}

// ── New Project Modal ──
function NewProjectModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', type: 'client_onboarding', client_name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 500 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>New Project</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Project Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Project Name</label>
            <input className="input-field" placeholder="e.g. Taryn Pessanha — Onboarding" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>

          {/* Project Type */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Project Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PROJECT_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => set('type', t.key)}
                  style={{
                    padding: '10px 12px',
                    background: form.type === t.key ? 'rgba(201,42,62,.12)' : 'var(--bg-elevated)',
                    border: `1px solid ${form.type === t.key ? 'var(--red)' : 'var(--border)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 3 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>{t.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Client name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', letterSpacing: '.05em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Client Name <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>(optional)</span></label>
            <input className="input-field" placeholder="e.g. Taryn Pessanha" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
          </div>

          {form.type === 'client_onboarding' && (
            <div style={{ padding: '10px 12px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={12} /> Auto-generates 16-step checklist
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--tx-3)' }}>GHL setup → Meta ads → Launch → Live review. All tasks created automatically.</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '8px 16px' }}>Cancel</button>
          <button onClick={save} className="btn-primary" style={{ padding: '8px 18px' }} disabled={!form.name.trim() || saving}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project Detail Panel ──
function ProjectDetail({ project, onClose, onChecklistUpdate }) {
  const steps = project.checklist || ONBOARDING_STEPS.map(s => ({ ...s, done: false }));
  const done = steps.filter(s => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  const toggle = async (stepIdx) => {
    const newSteps = steps.map((s, i) => i === stepIdx ? { ...s, done: !s.done } : s);
    onChecklistUpdate(project.id, newSteps);
  };

  const categories = [...new Set(steps.map(s => s.category))];

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
      background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 200, animation: 'slideInRight .2s ease',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx-1)' }}>{project.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 2 }}>
            {project.type?.replace('_', ' ')} · {project.client_name || 'Internal'}
          </div>
        </div>
        <StatusBadge s={project.status || 'active'} />
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)' }}>
          <X size={16} />
        </button>
      </div>

      {/* Progress */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-2)' }}>Onboarding Progress</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? '#10b981' : 'var(--tx-1)' }}>{pct}%</span>
        </div>
        <ProgressBar value={pct} color={pct === 100 ? '#10b981' : 'var(--red)'} />
        <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 5 }}>{done} of {steps.length} steps complete</div>
      </div>

      {/* Checklist */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        {categories.map(cat => {
          const catSteps = steps.map((s, i) => ({ ...s, _idx: i })).filter(s => s.category === cat);
          const catDone = catSteps.filter(s => s.done).length;
          return (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{cat}</span>
                <span style={{ color: catDone === catSteps.length ? '#10b981' : 'var(--tx-3)' }}>{catDone}/{catSteps.length}</span>
              </div>
              {catSteps.map(step => (
                <div
                  key={step._idx}
                  className={`checklist-step ${step.done ? 'step-done' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggle(step._idx)}
                >
                  <div style={{ flexShrink: 0, color: step.done ? '#10b981' : 'var(--tx-3)', transition: 'color .15s' }}>
                    {step.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'var(--tx-3)' : 'var(--tx-1)', transition: 'all .15s' }}>
                    {step.title}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>#{step.step}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Try to load from API; fall back to empty
      const res = await req('/projects?limit=50').catch(() => null);
      const list = res?.projects || res?.items || (Array.isArray(res) ? res : []);
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const createProject = async (data) => {
    try {
      const payload = {
        ...data,
        status: 'active',
        checklist: data.type === 'client_onboarding' ? ONBOARDING_STEPS.map(s => ({ ...s, done: false })) : [],
        created_at: new Date().toISOString(),
      };
      const res = await req('/projects', { method: 'POST', body: JSON.stringify(payload) }).catch(() => ({ ...payload, id: Date.now().toString() }));
      setProjects(prev => [res, ...prev]);
    } catch (e) { console.error(e); }
  };

  const updateChecklist = async (id, checklist) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, checklist } : p));
    if (selected?.id === id) setSelected(prev => ({ ...prev, checklist }));
    try {
      await req(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ checklist }) });
    } catch (e) {}
  };

  const filtered = projects.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-content" style={{ animation: 'fadeInUp .3s ease' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-.02em' }}>Projects</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--tx-3)' }}>{projects.length} active projects</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', pointerEvents: 'none' }} />
          <input className="input-field" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 28, width: 200, height: 34, fontSize: 12 }} />
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm" style={{ gap: 6 }}>
          <Plus size={13} /> New Project
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 size={24} style={{ color: 'var(--red)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--tx-3)' }}>
          <FolderKanban size={40} style={{ opacity: .2, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--tx-2)', marginBottom: 6 }}>No projects yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Start with a Client Onboarding — it auto-builds the 16-step checklist</div>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm" style={{ gap: 6 }}>
            <Plus size={13} /> Create first project
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {filtered.map(project => {
            const steps = project.checklist || [];
            const done = steps.filter(s => s.done).length;
            const pct = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
            const typeConfig = PROJECT_TYPES.find(t => t.key === project.type) || { icon: '📁', label: 'Project' };

            return (
              <div
                key={project.id}
                onClick={() => setSelected(project)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'border-color .15s, transform .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{typeConfig.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx-3)', marginTop: 2 }}>
                      {project.client_name || typeConfig.label} · {project.type?.replace('_', ' ')}
                    </div>
                  </div>
                  <StatusBadge s={project.status || 'active'} />
                </div>

                {steps.length > 0 && (
                  <>
                    <div style={{ marginBottom: 6 }}>
                      <ProgressBar value={pct} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--tx-3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{done} of {steps.length} steps</span>
                      <span style={{ fontWeight: 700, color: pct === 100 ? '#10b981' : 'var(--tx-2)' }}>{pct}%</span>
                    </div>
                  </>
                )}

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {project.created_at && (
                    <span style={{ fontSize: 11, color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={10} />
                      {new Date(project.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <ChevronRight size={14} style={{ color: 'var(--tx-3)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewProjectModal onSave={createProject} onClose={() => setShowNew(false)} />}
      {selected && <ProjectDetail project={selected} onClose={() => setSelected(null)} onChecklistUpdate={updateChecklist} />}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users, Plus, Search, X, ChevronRight, FileText, Activity,
  Mail, Phone, Globe, Building2, UserCheck, CreditCard,
  CheckCircle2, Circle, AlertCircle, MoreHorizontal,
  Copy, RefreshCw, ShieldOff, Send, Eye, Lock,
  Zap, Star, TrendingUp, Clock, DollarSign,
  Edit3, Save, MessageSquare, ArrowUpRight, Calendar,
  Layers, Trash2, PenLine, Hash, ExternalLink, LayoutGrid, List,
  BarChart3, Upload,
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok  = () => localStorage.getItem('token');
const ax   = () => axios.create({ headers:{ Authorization:`Bearer ${tok()}` } });

// ── Helpers ──────────────────────────────────────────────────────────────────
const health = s => s >= 70
  ? { color:'#22c55e', label:'Healthy', bg:'#22c55e18' }
  : s >= 40
  ? { color:'#f59e0b', label:'Watch',   bg:'#f59e0b18' }
  : { color:'#ef4444', label:'At Risk', bg:'#ef444418' };

const PLAN_CONFIG = {
  Starter: { price:1200, color:'#3b82f6', desc:'Up to 15 requests/mo · 1 user' },
  Growth:  { price:2500, color:'#a855f7', desc:'Up to 30 requests/mo · 3 users' },
  Pro:     { price:3800, color:'#f59e0b', desc:'Unlimited requests · 5 users' },
};

const PORTAL_STATUS = {
  active:   { label:'Portal Active',  color:'#22c55e', bg:'#22c55e18', icon: CheckCircle2 },
  invited:  { label:'Invite Sent',    color:'#f59e0b', bg:'#f59e0b18', icon: Send },
  none:     { label:'No Portal',      color:'#606060', bg:'var(--bg-overlay)', icon: Circle },
};

const STAGE_COLORS = {
  'Submitted':'#3b82f6','Assigned':'#a855f7','In Progress':'#f59e0b',
  'Pending Review':'#06b6d4','Revision':'#ef4444','Delivered':'#22c55e','Closed':'#606060',
};

const PRI_COLORS = { Urgent:'#c92a3e', High:'#f59e0b', Normal:'#3b82f6', Low:'#606060' };

// ── API Configuration ────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('token');
const getHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

// ── Static Config ────────────────────────────────────────────────────────────
// INDUSTRIES: Dropdown options list (static config, not mock data)
const INDUSTRIES   = ['Real Estate','Coaching','Finance','E-Commerce','Health & Wellness','Marketing Agency','Law Firm','Consulting','Retail','Technology'];

// ── Sub-components ────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const h = health(score);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:20, background:h.bg, width:'fit-content' }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background:h.color }}/>
      <span style={{ fontSize:11, fontWeight:600, color:h.color }}>{score}</span>
      <span style={{ fontSize:10, color:h.color, opacity:.8 }}>{h.label}</span>
    </div>
  );
}

function TagPill({ tag }) {
  const colors = { VIP:'#f59e0b', 'At Risk':'#ef4444', Watch:'#f59e0b', New:'#3b82f6', Paused:'#a855f7' };
  const c = colors[tag] || 'var(--tx-3)';
  return <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:4, background:`${c}18`, color:c }}>{tag}</span>;
}

function PortalBadge({ status }) {
  const cfg = PORTAL_STATUS[status] || PORTAL_STATUS.none;
  const Icon = cfg.icon;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'2px 7px', borderRadius:4, background:cfg.bg, width:'fit-content' }}>
      <Icon size={10} color={cfg.color} />
      <span style={{ fontSize:10, fontWeight:600, color:cfg.color }}>{cfg.label}</span>
    </div>
  );
}

function StagePill({ stage }) {
  const c = STAGE_COLORS[stage] || 'var(--tx-3)';
  return <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4, background:`${c}22`, color:c }}>{stage}</span>;
}

function PriPill({ priority }) {
  const c = PRI_COLORS[priority] || 'var(--tx-3)';
  return <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4, background:`${c}22`, color:c }}>{priority}</span>;
}

const ACTIVITY_ICONS = {
  request:  { icon: FileText,      color:'#3b82f6' },
  delivery: { icon: CheckCircle2,  color:'#22c55e' },
  note:     { icon: MessageSquare, color:'#a855f7' },
  login:    { icon: ArrowUpRight,  color:'#06b6d4' },
  payment:  { icon: DollarSign,    color:'#22c55e' },
  alert:    { icon: AlertCircle,   color:'#ef4444' },
};

// ── Multi-step Add Client Wizard ──────────────────────────────────────────────
const WIZARD_STEPS = [
  { id:1, label:'Business',  icon: Building2,   title:'Business Info',       sub:'Company name, industry, website' },
  { id:2, label:'Contact',   icon: UserCheck,   title:'Portal Contact',      sub:'Who logs in to the client portal' },
  { id:3, label:'Plan',      icon: CreditCard,  title:'Plan & Billing',      sub:'Select their service package' },
  { id:4, label:'Team',      icon: Users,       title:'Assign Team',         sub:'Account manager & team' },
  { id:5, label:'Launch',    icon: Zap,         title:'Review & Launch',     sub:'Create account & send invite' },
];

function AddClientWizard({ onClose, onCreated, teamMembers = [] }) {
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: '', industry: '', website: '', phone: '',
    contact_name: '', contact_email: '', contact_phone: '',
    plan: '', am: '', notes: '', send_invite: true, tags: [],
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const canNext = () => {
    if (step === 1) return form.name.trim().length > 0;
    if (step === 2) return form.contact_name.trim() && form.contact_email.includes('@');
    if (step === 3) return form.plan !== '';
    return true;
  };

  const handleLaunch = async () => {
    setSending(true);
    try {
      // Generate a temporary password for the new client user
      const tempPass = `RRG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      // Create the user account via the real API
      const res = await ax().post(`${API}/users`, {
        name: form.contact_name,
        email: form.contact_email,
        password: tempPass,
        role: 'Standard User',
        account_type: 'Media Client',
        force_password_change: true,
        force_otp_setup: false,
        send_welcome_email: form.send_invite,
        company_name: form.name,
        industry: form.industry,
        website: form.website,
        phone: form.contact_phone || form.phone,
        subscription_plan_name: form.plan,
        account_manager: form.am,
        tags: form.tags,
        notes: form.notes,
      });

      const userId = res.data?.id || res.data?._id;

      // Build client object for local state
      const newClient = {
        _id: userId || `c${Date.now()}`,
        name: form.name,
        plan: form.plan,
        mrr: PLAN_CONFIG[form.plan]?.price || 0,
        score: 75,
        renewal: new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0],
        requests_open: 0,
        deliveries: 0,
        last_delivery: '—',
        am: form.am,
        tags: ['New'],
        notes: form.notes,
        portal: form.send_invite ? 'invited' : 'none',
        contact: { name: form.contact_name, email: form.contact_email, phone: form.contact_phone },
        industry: form.industry,
        website: form.website,
        last_login: 'Never',
        login_count: 0,
      };

      setDone(true);
      if (onCreated) onCreated(newClient);
      toast.success(`Client account created for ${form.contact_name}`);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to create client account';
      toast.error(detail);
    } finally {
      setSending(false);
    }
  };

  if (done) return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width:460, textAlign:'center', padding:'40px 32px' }}>
        <div style={{ width:64, height:64, borderRadius:'50%', background:'#22c55e18', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <CheckCircle2 size={32} color="#22c55e" />
        </div>
        <h2 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>Client Created!</h2>
        <p style={{ color:'var(--tx-2)', fontSize:14, marginBottom:4 }}><strong style={{ color:'var(--tx-1)' }}>{form.name}</strong> has been added to Red Ops.</p>
        {form.send_invite && (
          <p style={{ color:'var(--tx-3)', fontSize:13, marginBottom:24 }}>
            Portal credentials created for <strong style={{ color:'var(--tx-2)' }}>{form.contact_email}</strong>. Email delivery requires SMTP to be configured in settings.
          </p>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
          <button className="btn-ghost" onClick={onClose}>Done</button>
          <button className="btn-primary" onClick={() => { setDone(false); setStep(1); setForm({ name:'',industry:'',website:'',phone:'',contact_name:'',contact_email:'',contact_phone:'',plan:'',am:'',notes:'',send_invite:true,tags:[] }); }}>Add Another</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width:560, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'20px 24px 0', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <h2 style={{ fontSize:16, fontWeight:800, margin:0 }}>Add New Client</h2>
              <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--tx-3)' }}>Set up client record + portal access in one flow</p>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4 }}><X size={16} /></button>
          </div>
          <div style={{ display:'flex', gap:0, marginBottom:-1 }}>
            {WIZARD_STEPS.map((s) => {
              const isActive   = step === s.id;
              const isComplete = step >  s.id;
              return (
                <button key={s.id} onClick={() => step > s.id && setStep(s.id)}
                  style={{ flex:1, padding:'8px 4px 10px', background:'transparent', border:'none', borderBottom: isActive ? '2px solid var(--red)' : '2px solid transparent', cursor: step > s.id ? 'pointer' : 'default', display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all .12s' }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background: isComplete ? '#22c55e18' : isActive ? 'var(--red-bg)' : 'var(--bg-overlay)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {isComplete
                      ? <CheckCircle2 size={12} color="#22c55e" />
                      : <s.icon size={11} color={ isActive ? 'var(--red)' : 'var(--tx-3)' } />
                    }
                  </div>
                  <span style={{ fontSize:10, fontWeight:600, color: isActive ? 'var(--tx-1)' : isComplete ? '#22c55e' : 'var(--tx-3)', letterSpacing:'0.02em' }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding:'24px 24px 16px', minHeight:280 }}>
          <div style={{ marginBottom:16 }}>
            <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 3px' }}>{WIZARD_STEPS[step-1].title}</h3>
            <p style={{ fontSize:12, color:'var(--tx-3)', margin:0 }}>{WIZARD_STEPS[step-1].sub}</p>
          </div>

          {step === 1 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={labelStyle}>Company Name *</label>
                <input autoFocus className="input-field" placeholder="e.g. Sunrise Realty Group" value={form.name} onChange={e => f('name', e.target.value)} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={labelStyle}>Industry</label>
                  <select className="input-field" value={form.industry} onChange={e => f('industry', e.target.value)}>
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Website</label>
                  <input className="input-field" placeholder="example.ca" value={form.website} onChange={e => f('website', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Business Phone</label>
                <input className="input-field" placeholder="403-555-0000" value={form.phone} onChange={e => f('phone', e.target.value)} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ padding:'10px 12px', background:'#3b82f618', border:'1px solid #3b82f630', borderRadius:8, fontSize:12, color:'#3b82f6', display:'flex', alignItems:'center', gap:8 }}>
                <Eye size={13} /><span>This person will receive the portal login invite and access the client dashboard.</span>
              </div>
              <div>
                <label style={labelStyle}>Contact Full Name *</label>
                <input autoFocus className="input-field" placeholder="e.g. Mike Thompson" value={form.contact_name} onChange={e => f('contact_name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email Address *</label>
                <input type="email" className="input-field" placeholder="mike@example.ca" value={form.contact_email} onChange={e => f('contact_email', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Contact Phone</label>
                <input className="input-field" placeholder="403-555-0000" value={form.contact_phone} onChange={e => f('contact_phone', e.target.value)} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.entries(PLAN_CONFIG).map(([name, cfg]) => (
                <div key={name} onClick={() => f('plan', name)}
                  style={{ padding:'14px 16px', borderRadius:10, border:`2px solid ${form.plan === name ? cfg.color : 'var(--border)'}`, background: form.plan === name ? `${cfg.color}0d` : 'var(--bg-elevated)', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all .12s' }}>
                  <div style={{ width:36, height:36, borderRadius:9, background:`${cfg.color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Star size={16} color={cfg.color} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--tx-1)', marginBottom:2 }}>{name}</div>
                    <div style={{ fontSize:12, color:'var(--tx-3)' }}>{cfg.desc}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:16, fontWeight:800, color:cfg.color }}>${cfg.price.toLocaleString()}</div>
                    <div style={{ fontSize:10, color:'var(--tx-3)' }}>/month</div>
                  </div>
                  <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${form.plan === name ? cfg.color : 'var(--border)'}`, background: form.plan === name ? cfg.color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {form.plan === name && <div style={{ width:8, height:8, borderRadius:'50%', background:'#fff' }} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 4 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={labelStyle}>Account Manager</label>
                <select className="input-field" value={form.am} onChange={e => f('am', e.target.value)}>
                  <option value="">Select account manager...</option>
                  {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Internal Notes</label>
                <textarea className="input-field" rows={3} placeholder="Context about this client, how they found you, goals, etc." value={form.notes} onChange={e => f('notes', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Tags</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {['VIP','New','Watch','Paused'].map(t => (
                    <button key={t} onClick={() => f('tags', form.tags.includes(t) ? form.tags.filter(x => x!==t) : [...form.tags, t])}
                      style={{ padding:'4px 10px', borderRadius:5, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: form.tags.includes(t) ? 'var(--red)' : 'var(--border)', background: form.tags.includes(t) ? 'var(--red-bg)' : 'transparent', color: form.tags.includes(t) ? 'var(--red)' : 'var(--tx-3)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:40, height:40, borderRadius:9, background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'var(--red)' }}>{form.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{form.name}</div>
                    <div style={{ fontSize:12, color:'var(--tx-3)' }}>{form.industry} {form.website ? `· ${form.website}` : ''}</div>
                  </div>
                </div>
                <div style={{ height:1, background:'var(--border)' }} />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                  {[
                    ['Contact',   form.contact_name || '—'],
                    ['Email',     form.contact_email || '—'],
                    ['Plan',      form.plan ? `${form.plan} · $${PLAN_CONFIG[form.plan]?.price?.toLocaleString()}/mo` : '—'],
                    ['Manager',   form.am || 'Unassigned'],
                  ].map(([l,v]) => (
                    <div key={l}>
                      <div style={{ color:'var(--tx-3)', marginBottom:1 }}>{l}</div>
                      <div style={{ fontWeight:500, color:'var(--tx-1)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:'12px 14px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--tx-1)' }}>Send Portal Invite</div>
                  <div style={{ fontSize:11.5, color:'var(--tx-3)', marginTop:2 }}>Email {form.contact_email} their login credentials</div>
                </div>
                <button onClick={() => f('send_invite', !form.send_invite)} style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', padding:2, background: form.send_invite ? 'var(--red)' : 'var(--bg-overlay)', transition:'background .2s', display:'flex', alignItems:'center' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'#fff', transition:'transform .2s', transform: form.send_invite ? 'translateX(20px)' : 'translateX(0)' }} />
                </button>
              </div>
              <div style={{ padding:'10px 12px', background:'#a855f718', border:'1px solid #a855f730', borderRadius:8, fontSize:12, color:'#a855f7', display:'flex', alignItems:'center', gap:8 }}>
                <Zap size={13} /><span>A 16-step onboarding project will be auto-created for this client.</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding:'12px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={() => step > 1 ? setStep(s => s-1) : onClose()} className="btn-ghost btn-sm">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:11.5, color:'var(--tx-3)' }}>Step {step} of {WIZARD_STEPS.length}</span>
            {step < 5
              ? <button className="btn-primary btn-sm" onClick={() => setStep(s => s+1)} disabled={!canNext()}>Continue →</button>
              : <button className="btn-primary btn-sm" onClick={handleLaunch} disabled={sending} style={{ minWidth:120 }}>
                  {sending ? 'Creating...' : 'Create & Launch'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize:11, fontWeight:600, color:'var(--tx-3)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' };

// ── Detail Panel Tabs ────────────────────────────────────────────────────────
const TABS = [
  { id:'overview',  label:'Overview',  icon: Eye },
  { id:'requests',  label:'Requests',  icon: Layers },
  { id:'activity',  label:'Activity',  icon: Activity },
  { id:'notes',     label:'Notes',     icon: MessageSquare },
  { id:'billing',   label:'Billing',   icon: DollarSign },
  { id:'ads',       label:'Ad Tracking', icon: BarChart3 },
];

function ClientDetailPanel({ client, onClose, onUpdate, teamMembers = [] }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [newNote, setNewNote] = useState('');
  const [notes, setNotes] = useState([]);
  const [adEntries, setAdEntries] = useState([]);
  const [adLoading, setAdLoading] = useState(false);
  const [adForm, setAdForm] = useState({ platform:'', campaign:'', spend:'', impressions:'', clicks:'', conversions:'', date:'' });

  // Reset tab & load saved notes when client changes
  useEffect(() => {
    setTab('overview');
    setEditing(false);
    // Load persisted notes from localStorage
    try {
      const saved = localStorage.getItem(`client_notes_${client._id}`);
      setNotes(saved ? JSON.parse(saved) : []);
    } catch { setNotes([]); }
    // Load ad tracking entries from backend
    setAdLoading(true);
    ax().get(`${API}/ad-performance/snapshots`, { params: { client_id: client._id } })
      .then(res => {
        const snaps = (res.data || []).map(s => ({
          id: s.id,
          platform: s.platform || '—',
          campaign: s.campaigns?.[0]?.name || '—',
          spend: s.metrics?.ad_spend || 0,
          impressions: s.metrics?.impressions || 0,
          clicks: s.metrics?.clicks || 0,
          conversions: s.metrics?.conversions || 0,
          leads: s.metrics?.leads || 0,
          date: s.period || s.created_at?.split('T')[0] || '—',
        }));
        setAdEntries(snaps);
      })
      .catch(() => setAdEntries([]))
      .finally(() => setAdLoading(false));
  }, [client._id]);

  const startEdit = () => {
    setEditForm({
      name: client.name,
      industry: client.industry || '',
      website: client.website || '',
      plan: client.plan,
      am: client.am || '',
      notes: client.notes || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    try {
      await ax().patch(`${API}/users/${client._id}`, {
        company_name: editForm.name,
        industry: editForm.industry || null,
        website: editForm.website || null,
        subscription_plan_name: editForm.plan,
        account_manager: editForm.am || null,
        notes: editForm.notes || null,
      });
      onUpdate({
        ...client,
        ...editForm,
        mrr: PLAN_CONFIG[editForm.plan]?.price || client.mrr,
      });
      setEditing(false);
      toast.success('Client updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update client');
    }
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const note = { id: `n${Date.now()}`, text: newNote, author: 'You', ts: new Date().toLocaleString() };
    const updated = [note, ...notes];
    setNotes(updated);
    setNewNote('');
    // Persist to localStorage until a dedicated notes API is built
    try { localStorage.setItem(`client_notes_${client._id}`, JSON.stringify(updated)); } catch {}
    toast.success('Note added');
  };

  // Empty states for activities without real API endpoints
  // In the future, these would come from real API calls:
  // - requests: /api/tasks?client_id=X
  // - activity: /api/crm/contacts/{id}/activity
  // - billing: /api/billing/invoices?client_id=X
  const requests  = [];
  const activity  = [];
  const billing   = [];

  return (
    <div style={{ width:480, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto', background:'var(--bg-card)', animation:'slideRight 0.18s ease both' }}>

      {/* Panel header */}
      <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'var(--red)', flexShrink:0 }}>
              {client.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, marginBottom:2 }}>{client.name}</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                <span style={{ fontSize:11, padding:'1px 7px', background:`${PLAN_CONFIG[client.plan]?.color || '#606060'}18`, borderRadius:4, color:PLAN_CONFIG[client.plan]?.color || 'var(--tx-3)', fontWeight:600 }}>{client.plan}</span>
                <PortalBadge status={client.portal || 'none'} />
                {client.tags?.map(t=><TagPill key={t} tag={t}/>)}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => navigate(`/clients/${client._id}`)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4, borderRadius:5 }}
              title="Open full profile">
              <ExternalLink size={14} />
            </button>
            <button onClick={startEdit} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4, borderRadius:5 }}
              title="Edit client">
              <Edit3 size={14} />
            </button>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4, borderRadius:5 }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Score + quick stats */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <ScoreBadge score={client.score||0} />
          <span style={{ fontSize:11, color:'var(--tx-3)' }}>·</span>
          <span style={{ fontSize:11, color:'var(--tx-2)' }}>${(client.mrr||0).toLocaleString()}/mo</span>
          <span style={{ fontSize:11, color:'var(--tx-3)' }}>·</span>
          <span style={{ fontSize:11, color:'var(--tx-2)' }}>{client.requests_open||0} open</span>
          <span style={{ fontSize:11, color:'var(--tx-3)' }}>·</span>
          <span style={{ fontSize:11, color:'var(--tx-2)' }}>{client.deliveries||0} delivered</span>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, marginBottom:-1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1, padding:'6px 4px 8px', background:'transparent', border:'none', borderBottom: tab === t.id ? '2px solid var(--red)' : '2px solid transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all .12s' }}>
              <t.icon size={12} color={tab === t.id ? 'var(--red)' : 'var(--tx-3)'} />
              <span style={{ fontSize:11, fontWeight:600, color: tab === t.id ? 'var(--tx-1)' : 'var(--tx-3)' }}>{t.label}</span>
              {t.id === 'requests' && requests.length > 0 && (
                <span style={{ fontSize:9, fontWeight:700, background:'var(--red-bg)', color:'var(--red)', padding:'0 5px', borderRadius:8, lineHeight:'16px' }}>{requests.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>

        {/* ─── OVERVIEW TAB ─── */}
        {tab === 'overview' && !editing && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Contact info */}
            <div>
              <div style={sectionHeader}>Contact</div>
              <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                {client.contact && (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <UserCheck size={11} color="var(--tx-3)" />
                      <span style={{ fontSize:12, color:'var(--tx-1)', fontWeight:500 }}>{client.contact.name}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Mail size={11} color="var(--tx-3)" />
                      <span style={{ fontSize:11.5, color:'var(--tx-2)' }}>{client.contact.email}</span>
                    </div>
                    {client.contact.phone && (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <Phone size={11} color="var(--tx-3)" />
                        <span style={{ fontSize:11.5, color:'var(--tx-2)' }}>{client.contact.phone}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Portal access */}
            <div>
              <div style={sectionHeader}>Portal Access</div>
              <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <PortalBadge status={client.portal || 'none'} />
                  {client.portal === 'active' && (
                    <span style={{ fontSize:11, color:'var(--tx-3)' }}>Last login: <strong style={{ color:'var(--tx-2)' }}>{client.last_login}</strong></span>
                  )}
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {(!client.portal || client.portal === 'none') && (
                    <button className="btn-primary btn-sm" style={{ gap:4 }}
                      onClick={async () => {
                        try {
                          await ax().patch(`${API}/users/${client._id}`, { portal_status: 'invited' });
                          onUpdate({ ...client, portal:'invited' });
                          toast.success(`Portal enabled for ${client.contact?.email || 'client'}`);
                        } catch (err) { toast.error(err.response?.data?.detail || 'Failed to send invite'); }
                      }}>
                      <Send size={11}/> Send Invite
                    </button>
                  )}
                  {client.portal === 'invited' && (
                    <button className="btn-ghost btn-sm" style={{ gap:4 }} onClick={async () => {
                      try {
                        await ax().patch(`${API}/users/${client._id}`, { portal_status: 'invited' });
                        onUpdate({ ...client, portal:'invited' });
                        toast.success(`Invite resent to ${client.contact?.email || 'client'}`);
                      } catch (err) { toast.error(err.response?.data?.detail || 'Failed to resend invite'); }
                    }}>
                      <RefreshCw size={11}/> Resend Invite
                    </button>
                  )}
                  {client.portal === 'active' && (
                    <button className="btn-ghost btn-sm" style={{ gap:4 }} onClick={() => {
                      const domain = new URL(process.env.REACT_APP_BACKEND_URL || window.location.origin).hostname;
                      const protocol = new URL(process.env.REACT_APP_BACKEND_URL || window.location.origin).protocol;
                      const portalUrl = `${protocol}//${domain}/login`;
                      navigator.clipboard?.writeText(portalUrl);
                      toast.success('Portal link copied!');
                    }}>
                      <Copy size={11}/> Copy Login Link
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div>
              <div style={sectionHeader}>Stats</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Monthly Retainer', value:`$${(client.mrr||0).toLocaleString()}`, icon: DollarSign, color:'#22c55e' },
                  { label:'Open Requests',    value:client.requests_open||0,                icon: Layers,     color:'#3b82f6' },
                  { label:'Total Deliveries', value:client.deliveries||0,                   icon: CheckCircle2,color:'#22c55e' },
                  { label:'Last Delivery',    value:client.last_delivery||'—',              icon: Clock,      color:'#f59e0b' },
                  { label:'Renewal',          value:client.renewal?new Date(client.renewal).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'—', icon: Calendar, color:'#06b6d4' },
                  { label:'Account Manager',  value:client.am||'—',                         icon: Users,      color:'#a855f7' },
                ].map(m=>(
                  <div key={m.label} style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', display:'flex', alignItems:'flex-start', gap:8 }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:`${m.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <m.icon size={13} color={m.color} />
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:'var(--tx-3)', marginBottom:2 }}>{m.label}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--tx-1)' }}>{m.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Business info */}
            {(client.website || client.industry) && (
              <div>
                <div style={sectionHeader}>Business Info</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5, background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px' }}>
                  {client.industry && (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Building2 size={11} color="var(--tx-3)" />
                      <span style={{ fontSize:12, color:'var(--tx-2)' }}>{client.industry}</span>
                    </div>
                  )}
                  {client.website && (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Globe size={11} color="var(--tx-3)" />
                      <span style={{ fontSize:12, color:'var(--tx-2)' }}>{client.website}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Internal notes */}
            {client.notes && (
              <div>
                <div style={sectionHeader}>Internal Notes</div>
                <div style={{ fontSize:12, color:'var(--tx-2)', lineHeight:1.6, background:'var(--bg-elevated)', padding:'10px 12px', borderRadius:8 }}>
                  {client.notes}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display:'flex', gap:7 }}>
              <button onClick={() => navigate('/requests')} className="btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', gap:4 }}><FileText size={11}/> View Requests</button>
              <button onClick={() => navigate('/projects')} className="btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', gap:4 }}><Activity size={11}/> View Projects</button>
            </div>
          </div>
        )}

        {/* ─── EDIT MODE (overlay on overview) ─── */}
        {tab === 'overview' && editing && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--tx-1)' }}>Edit Client</span>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn-primary btn-sm" onClick={saveEdit} style={{ gap:4 }}><Save size={11}/> Save</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Company Name</label>
              <input className="input-field" value={editForm.name} onChange={e => setEditForm(p=>({...p,name:e.target.value}))} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={labelStyle}>Industry</label>
                <select className="input-field" value={editForm.industry} onChange={e => setEditForm(p=>({...p,industry:e.target.value}))}>
                  <option value="">—</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Website</label>
                <input className="input-field" value={editForm.website} onChange={e => setEditForm(p=>({...p,website:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={labelStyle}>Plan</label>
                <select className="input-field" value={editForm.plan} onChange={e => setEditForm(p=>({...p,plan:e.target.value}))}>
                  {Object.keys(PLAN_CONFIG).map(p => <option key={p} value={p}>{p} — ${PLAN_CONFIG[p].price}/mo</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Account Manager</label>
                <select className="input-field" value={editForm.am} onChange={e => setEditForm(p=>({...p,am:e.target.value}))}>
                  <option value="">Unassigned</option>
                  {teamMembers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Internal Notes</label>
              <textarea className="input-field" rows={3} value={editForm.notes} onChange={e => setEditForm(p=>({...p,notes:e.target.value}))} />
            </div>
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, marginTop:4 }}>
              <button onClick={async () => {
                if (!window.confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
                try {
                  await ax().delete(`${API}/users/${client._id}`);
                  toast.success(`Client "${client.name}" deleted`);
                  onClose();
                } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete client'); }
              }} style={{ width:'100%', padding:'8px 0', borderRadius:7, border:'1px solid var(--red)', background:'transparent', color:'var(--red)', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                <Trash2 size={13} /> Delete Client
              </button>
            </div>
          </div>
        )}

        {/* ─── REQUESTS TAB ─── */}
        {tab === 'requests' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)' }}>{requests.length} Linked Request{requests.length !== 1 ? 's' : ''}</span>
              <button className="btn-primary btn-sm" style={{ gap:4 }} onClick={() => navigate('/requests')}>
                <Plus size={11}/> New Request
              </button>
            </div>

            {requests.length === 0 && (
              <div style={{ padding:'32px 16px', textAlign:'center', background:'var(--bg-elevated)', borderRadius:10 }}>
                <Layers size={24} color="var(--tx-3)" style={{ marginBottom:8 }} />
                <p style={{ fontSize:13, color:'var(--tx-3)', margin:0 }}>No requests yet for this client.</p>
              </div>
            )}

            {requests.map(r => (
              <div key={r.id} style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', border:'1px solid var(--border)', transition:'border-color .12s' }}
                onClick={() => navigate('/requests')}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--red)' }}>{r.id}</span>
                  <StagePill stage={r.stage} />
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--tx-1)' }}>{r.title}</div>
                <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:11, color:'var(--tx-3)' }}>
                  <PriPill priority={r.priority} />
                  <span>{r.assignee}</span>
                  <span style={{ marginLeft:'auto' }}>Due: {r.due}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── ACTIVITY TAB ─── */}
        {tab === 'activity' && (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:12 }}>Recent Activity</div>
            {activity.length === 0 && (
              <div style={{ padding:'32px 16px', textAlign:'center', background:'var(--bg-elevated)', borderRadius:10 }}>
                <Activity size={24} color="var(--tx-3)" style={{ marginBottom:8 }} />
                <p style={{ fontSize:13, color:'var(--tx-3)', margin:0 }}>No activity recorded yet.</p>
              </div>
            )}
            {activity.map((a, i) => {
              const cfg = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.note;
              const Icon = cfg.icon;
              return (
                <div key={i} style={{ display:'flex', gap:12, paddingBottom:16, position:'relative' }}>
                  {/* Timeline line */}
                  {i < activity.length - 1 && (
                    <div style={{ position:'absolute', left:14, top:28, bottom:0, width:1, background:'var(--border)' }} />
                  )}
                  {/* Icon */}
                  <div style={{ width:28, height:28, borderRadius:7, background:`${cfg.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', zIndex:1 }}>
                    <Icon size={12} color={cfg.color} />
                  </div>
                  {/* Content */}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, color:'var(--tx-1)', lineHeight:1.5 }}>{a.text}</div>
                    <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:3, display:'flex', gap:8 }}>
                      <span>{a.actor}</span>
                      <span>·</span>
                      <span>{a.ts}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── NOTES TAB ─── */}
        {tab === 'notes' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Add note */}
            <div style={{ display:'flex', gap:8 }}>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Add a note about this client..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }}}
                style={{ flex:1, resize:'none' }}
              />
              <button className="btn-primary btn-sm" onClick={addNote} disabled={!newNote.trim()} style={{ alignSelf:'flex-end', height:34 }}>
                <Send size={12} />
              </button>
            </div>

            <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)' }}>{notes.length} Note{notes.length !== 1 ? 's' : ''}</div>

            {notes.map(n => (
              <div key={n.id} style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'12px 14px', borderLeft:'3px solid #a855f7' }}>
                <div style={{ fontSize:12.5, color:'var(--tx-1)', lineHeight:1.6, marginBottom:6 }}>{n.text}</div>
                <div style={{ fontSize:10.5, color:'var(--tx-3)', display:'flex', gap:8 }}>
                  <span style={{ fontWeight:600 }}>{n.author}</span>
                  <span>·</span>
                  <span>{n.ts}</span>
                </div>
              </div>
            ))}

            {notes.length === 0 && (
              <div style={{ padding:'32px 16px', textAlign:'center', background:'var(--bg-elevated)', borderRadius:10 }}>
                <MessageSquare size={24} color="var(--tx-3)" style={{ marginBottom:8 }} />
                <p style={{ fontSize:13, color:'var(--tx-3)', margin:0 }}>No notes yet. Add one above.</p>
              </div>
            )}
          </div>
        )}

        {/* ─── BILLING TAB ─── */}
        {tab === 'billing' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* MRR card */}
            <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:'16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:10, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, marginBottom:4 }}>Monthly Retainer</div>
                <div style={{ fontSize:24, fontWeight:800, color:'#22c55e' }}>${(client.mrr||0).toLocaleString()}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:10, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, marginBottom:4 }}>Plan</div>
                <span style={{ fontSize:13, padding:'3px 10px', background:`${PLAN_CONFIG[client.plan]?.color || '#606060'}18`, borderRadius:5, color:PLAN_CONFIG[client.plan]?.color || 'var(--tx-3)', fontWeight:700 }}>{client.plan}</span>
              </div>
            </div>

            {/* Renewal */}
            <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <Calendar size={12} color="var(--tx-3)" />
                <span style={{ fontSize:12, color:'var(--tx-2)' }}>Renewal Date</span>
              </div>
              <span style={{ fontSize:12, fontWeight:600, color:'var(--tx-1)' }}>
                {client.renewal ? new Date(client.renewal).toLocaleDateString('en-CA',{month:'long',day:'numeric',year:'numeric'}) : '—'}
              </span>
            </div>

            {/* Invoice history */}
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:10 }}>Payment History</div>
              {billing.length === 0 && (
                <div style={{ padding:'24px 16px', textAlign:'center', background:'var(--bg-elevated)', borderRadius:10 }}>
                  <DollarSign size={24} color="var(--tx-3)" style={{ marginBottom:8 }} />
                  <p style={{ fontSize:13, color:'var(--tx-3)', margin:0 }}>No payment records.</p>
                </div>
              )}
              {billing.map((b, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-elevated)', borderRadius:8, marginBottom:6 }}>
                  <div style={{ width:28, height:28, borderRadius:7, background: b.status === 'paid' ? '#22c55e18' : '#ef444418', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {b.status === 'paid'
                      ? <CheckCircle2 size={13} color="#22c55e" />
                      : <AlertCircle size={13} color="#ef4444" />
                    }
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--tx-1)' }}>${b.amount.toLocaleString()}</div>
                    <div style={{ fontSize:10.5, color:'var(--tx-3)' }}>{b.invoice} · {new Date(b.date).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4, background: b.status === 'paid' ? '#22c55e18' : '#ef444418', color: b.status === 'paid' ? '#22c55e' : '#ef4444' }}>
                    {b.status === 'paid' ? 'Paid' : 'Late'}
                  </span>
                </div>
              ))}
            </div>

            {/* LTV */}
            {billing.length > 0 && (
              <div style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <TrendingUp size={12} color="#22c55e" />
                  <span style={{ fontSize:12, color:'var(--tx-2)' }}>Lifetime Value</span>
                </div>
                <span style={{ fontSize:14, fontWeight:800, color:'#22c55e' }}>
                  ${billing.reduce((s,b) => s + b.amount, 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Ad Tracking Tab ── */}
        {tab === 'ads' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Sync status bar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg-elevated)', borderRadius:8, fontSize:11 }}>
              <span style={{ color:'var(--tx-3)' }}>
                {adLoading ? 'Loading...' : `${adEntries.length} snapshot${adEntries.length !== 1 ? 's' : ''} synced`}
              </span>
              <button onClick={async () => {
                setAdLoading(true);
                try {
                  const res = await ax().get(`${API}/ad-performance/snapshots`, { params: { client_id: client._id } });
                  setAdEntries((res.data || []).map(s => ({ id: s.id, platform: s.platform || '—', campaign: s.campaigns?.[0]?.name || '—', spend: s.metrics?.ad_spend || 0, impressions: s.metrics?.impressions || 0, clicks: s.metrics?.clicks || 0, conversions: s.metrics?.conversions || 0, leads: s.metrics?.leads || 0, date: s.period || '—' })));
                  toast.success('Refreshed');
                } catch { toast.error('Failed to refresh'); }
                setAdLoading(false);
              }} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:'var(--red)', fontSize:11, fontWeight:600 }}>
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {/* CSV Upload */}
            <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                <Upload size={13} /> Import CSV
              </div>
              <label style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px 0',
                border:'2px dashed var(--border)', borderRadius:8, cursor:'pointer', fontSize:12, color:'var(--tx-3)',
                transition:'all .15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--tx-3)'; }}
              >
                <Upload size={14} /> Drop CSV or click to upload
                <input type="file" accept=".csv" style={{ display:'none' }} onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  try {
                    const text = await file.text();
                    const lines = text.split('\n').filter(l => l.trim());
                    if (lines.length < 2) { toast.error('CSV must have a header + data rows'); return; }
                    const hdrs = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g,'_'));
                    let success = 0, failed = 0;
                    for (let idx = 1; idx < lines.length; idx++) {
                      const cols = lines[idx].split(',').map(c => c.trim());
                      const row = {};
                      hdrs.forEach((h, i) => { row[h] = cols[i] || ''; });
                      const platform = row.platform || row.source || 'Other';
                      const spend = parseFloat((row.spend || row.cost || row.ad_spend || '0').replace(/[$,]/g,'')) || 0;
                      const impressions = parseInt((row.impressions || '0').replace(/,/g,'')) || 0;
                      const clicks = parseInt((row.clicks || '0').replace(/,/g,'')) || 0;
                      const conversions = parseInt((row.conversions || row.conv || '0').replace(/,/g,'')) || 0;
                      const leads = parseInt((row.leads || '0').replace(/,/g,'')) || conversions;
                      const dateStr = row.date || row.period || new Date().toISOString().split('T')[0];
                      const period = dateStr.length >= 7 ? dateStr.slice(0, 7) : new Date().toISOString().slice(0, 7);
                      try {
                        await ax().post(`${API}/ad-performance/snapshots`, {
                          client_id: client._id,
                          platform,
                          period,
                          metrics: { ad_spend: spend, impressions, clicks, leads, conversions, roas: spend > 0 ? 1 : 0 },
                          campaigns: row.campaign ? [{ name: row.campaign || row.campaign_name || '—', status: 'active', spend, leads, cpl: leads > 0 ? spend / leads : 0 }] : [],
                          notes: row.notes || '',
                        });
                        success++;
                      } catch { failed++; }
                    }
                    if (success > 0) {
                      toast.success(`Imported ${success} snapshots${failed > 0 ? `, ${failed} failed` : ''}`);
                      // Reload from backend
                      const res = await ax().get(`${API}/ad-performance/snapshots`, { params: { client_id: client._id } });
                      setAdEntries((res.data || []).map(s => ({ id: s.id, platform: s.platform || '—', campaign: s.campaigns?.[0]?.name || '—', spend: s.metrics?.ad_spend || 0, impressions: s.metrics?.impressions || 0, clicks: s.metrics?.clicks || 0, conversions: s.metrics?.conversions || 0, leads: s.metrics?.leads || 0, date: s.period || '—' })));
                    } else { toast.error(`All ${failed} rows failed to import`); }
                  } catch { toast.error('Failed to parse CSV'); }
                }} />
              </label>
              <p style={{ fontSize:10, color:'var(--tx-3)', marginTop:6 }}>
                Expected columns: platform, campaign, spend, impressions, clicks, conversions, date
              </p>
            </div>

            {/* Manual Entry */}
            <div style={{ background:'var(--bg-elevated)', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                <PenLine size={13} /> Manual Entry
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <input className="input-field" placeholder="Platform" value={adForm.platform} onChange={e => setAdForm(p=>({...p,platform:e.target.value}))} style={{ fontSize:12 }} />
                <input className="input-field" placeholder="Campaign" value={adForm.campaign} onChange={e => setAdForm(p=>({...p,campaign:e.target.value}))} style={{ fontSize:12 }} />
                <input className="input-field" placeholder="Spend ($)" type="number" value={adForm.spend} onChange={e => setAdForm(p=>({...p,spend:e.target.value}))} style={{ fontSize:12 }} />
                <input className="input-field" placeholder="Impressions" type="number" value={adForm.impressions} onChange={e => setAdForm(p=>({...p,impressions:e.target.value}))} style={{ fontSize:12 }} />
                <input className="input-field" placeholder="Clicks" type="number" value={adForm.clicks} onChange={e => setAdForm(p=>({...p,clicks:e.target.value}))} style={{ fontSize:12 }} />
                <input className="input-field" placeholder="Conversions" type="number" value={adForm.conversions} onChange={e => setAdForm(p=>({...p,conversions:e.target.value}))} style={{ fontSize:12 }} />
                <input className="input-field" type="date" value={adForm.date} onChange={e => setAdForm(p=>({...p,date:e.target.value}))} style={{ fontSize:12 }} />
                <button className="btn-primary btn-sm" onClick={async () => {
                  if (!adForm.platform) { toast.error('Platform required'); return; }
                  const spend = parseFloat(adForm.spend) || 0;
                  const clicks = parseInt(adForm.clicks) || 0;
                  const impressions = parseInt(adForm.impressions) || 0;
                  const conversions = parseInt(adForm.conversions) || 0;
                  const dateStr = adForm.date || new Date().toISOString().split('T')[0];
                  const period = dateStr.slice(0, 7);
                  try {
                    await ax().post(`${API}/ad-performance/snapshots`, {
                      client_id: client._id,
                      platform: adForm.platform,
                      period,
                      metrics: { ad_spend: spend, impressions, clicks, leads: conversions, conversions, roas: spend > 0 ? 1 : 0 },
                      campaigns: adForm.campaign ? [{ name: adForm.campaign, status: 'active', spend, leads: conversions, cpl: conversions > 0 ? spend / conversions : 0 }] : [],
                    });
                    // Reload from backend
                    const res = await ax().get(`${API}/ad-performance/snapshots`, { params: { client_id: client._id } });
                    setAdEntries((res.data || []).map(s => ({ id: s.id, platform: s.platform || '—', campaign: s.campaigns?.[0]?.name || '—', spend: s.metrics?.ad_spend || 0, impressions: s.metrics?.impressions || 0, clicks: s.metrics?.clicks || 0, conversions: s.metrics?.conversions || 0, leads: s.metrics?.leads || 0, date: s.period || '—' })));
                    setAdForm({ platform:'', campaign:'', spend:'', impressions:'', clicks:'', conversions:'', date:'' });
                    toast.success('Snapshot added');
                  } catch (err) { toast.error(err.response?.data?.detail || 'Failed to add snapshot'); }
                }} style={{ fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>

            {/* Summary Stats */}
            {adEntries.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  { label:'Total Spend', value:`$${adEntries.reduce((s,a)=>s+a.spend,0).toLocaleString(undefined,{maximumFractionDigits:2})}`, color:'#ef4444' },
                  { label:'Total Leads', value:adEntries.reduce((s,a)=>s+(a.leads||0),0).toLocaleString(), color:'#3b82f6' },
                  { label:'Total Conv.', value:adEntries.reduce((s,a)=>s+a.conversions,0).toLocaleString(), color:'#22c55e' },
                ].map(s => (
                  <div key={s.label} style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:10, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Ad Entries Table */}
            {adEntries.length > 0 ? (
              <div style={{ borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'70px 1fr 70px 55px 50px 45px 45px 55px 28px', padding:'8px 12px', fontSize:10, fontWeight:700, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'.05em', background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)' }}>
                  <span>Platform</span><span>Campaign</span><span>Spend</span><span>Impr.</span><span>Clicks</span><span>Leads</span><span>Conv.</span><span>Period</span><span />
                </div>
                {adEntries.slice(0, 50).map(a => (
                  <div key={a.id} style={{ display:'grid', gridTemplateColumns:'70px 1fr 70px 55px 50px 45px 45px 55px 28px', padding:'8px 12px', fontSize:12, color:'var(--tx-1)', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                    <span style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.platform}</span>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--tx-2)' }}>{a.campaign}</span>
                    <span style={{ color:'#ef4444', fontWeight:600 }}>${a.spend.toLocaleString(undefined,{maximumFractionDigits:2})}</span>
                    <span>{a.impressions.toLocaleString()}</span>
                    <span>{a.clicks.toLocaleString()}</span>
                    <span style={{ color:'#3b82f6', fontWeight:600 }}>{a.leads || 0}</span>
                    <span style={{ color:'#22c55e', fontWeight:600 }}>{a.conversions}</span>
                    <span style={{ fontSize:10, color:'var(--tx-3)' }}>{a.date}</span>
                    <button onClick={async () => {
                      try {
                        await ax().delete(`${API}/ad-performance/snapshots/${a.id}`);
                        setAdEntries(prev => prev.filter(x => x.id !== a.id));
                        toast.success('Snapshot deleted');
                      } catch { toast.error('Failed to delete'); }
                    }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:2, display:'flex' }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding:'32px 16px', textAlign:'center', background:'var(--bg-elevated)', borderRadius:10 }}>
                <BarChart3 size={28} color="var(--tx-3)" style={{ marginBottom:8 }} />
                <p style={{ fontSize:13, color:'var(--tx-3)', margin:0 }}>No ad tracking data yet.</p>
                <p style={{ fontSize:11, color:'var(--tx-3)', margin:'4px 0 0' }}>Upload a CSV or add entries manually above.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionHeader = { fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 };

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Clients() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const [clients,  setClients]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [sort,     setSort]     = useState('score');
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [showWizard, setShowWizard] = useState(searchParams.get('new') === '1');
  const [portalFilter, setPortalFilter] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [view, setView] = useState(() => localStorage.getItem('clients_view') || 'grid');
  const [onboardingMap, setOnboardingMap] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch all users and onboarding checklists in parallel
        const [r, obRes] = await Promise.all([
          ax().get(`${API}/users`),
          ax().get(`${API}/onboarding`).catch(() => ({ data: [] })),
        ]);
        const d = r.data;
        const arr = Array.isArray(d) ? d : d?.items || [];

        // Build onboarding lookup by client_id
        const obMap = {};
        for (const cl of (obRes.data || [])) {
          obMap[cl.client_id] = cl;
        }
        setOnboardingMap(obMap);

        // Extract team members (staff)
        const staff = arr
          .filter(u => u.account_type === 'Staff')
          .map(u => u.name || u.email);
        setTeamMembers(staff);

        // Map API user objects to the shape the page expects (Media Clients)
        const mapped = arr
          .filter(u => u.account_type === 'Media Client')
          .map(u => ({
            _id: u.id || u._id,
            name: u.company_name || u.name || u.email,
            plan: u.subscription_plan_name || 'Starter',
            mrr: PLAN_CONFIG[u.subscription_plan_name]?.price || 0,
            score: 70,
            renewal: '',
            requests_open: 0,
            deliveries: 0,
            last_delivery: '—',
            am: u.account_manager || '—',
            tags: u.tags || [],
            notes: u.notes || '',
            portal: u.active ? 'active' : 'none',
            contact: { name: u.name, email: u.email, phone: u.phone || '' },
            industry: u.industry || '',
            website: u.website || '',
            last_login: '—',
            login_count: 0,
          }));
        setClients(mapped);
      } catch(_) {}
      setLoading(false);
    };
    load();
  }, []);

  const source = clients;

  const display = source
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.contact?.email?.toLowerCase().includes(search.toLowerCase()))
    .filter(c => !portalFilter || c.portal === portalFilter)
    .sort((a,b) => sort==='mrr' ? b.mrr-a.mrr : sort==='name' ? a.name.localeCompare(b.name) : (b.score||0)-(a.score||0));

  const sel = selected ? source.find(c => c._id === selected) : null;

  const totalMRR   = display.reduce((s,c) => s + (c.mrr||0), 0);
  const active     = display.filter(c => c.portal === 'active').length;
  const invited    = display.filter(c => c.portal === 'invited').length;
  const noPortal   = display.filter(c => c.portal === 'none' || !c.portal).length;

  const handleCreated = (newClient) => {
    setClients(prev => [newClient, ...prev]);
    setShowWizard(false);
    setSelected(newClient._id);
    toast.success(`${newClient.name} created — ${newClient.portal === 'invited' ? 'invite sent!' : 'no invite sent'}`);
  };

  const handleUpdateClient = (updated) => {
    setClients(prev => {
      const src = [...prev];
      return src.map(c => c._id === updated._id ? updated : c);
    });
  };

  return (
    <div className="page-fill" style={{ flexDirection:'row' }}>
      {showWizard && <AddClientWizard onClose={() => setShowWizard(false)} onCreated={handleCreated} teamMembers={teamMembers} />}

      {/* ── Main list ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <h1 style={{ fontSize:17, fontWeight:800, letterSpacing:'-.03em', margin:0 }}>Clients</h1>
          <span style={{ fontSize:12, color:'var(--tx-3)', padding:'2px 8px', background:'var(--bg-elevated)', borderRadius:10 }}>{display.length}</span>
          <div style={{ flex:1 }}/>
          <div style={{ position:'relative' }}>
            <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--tx-3)' }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients or email..."
              style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 10px 6px 28px', fontSize:12.5, color:'var(--tx-1)', outline:'none', width:200 }} />
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {[['','All'],['active','Active'],['invited','Invited'],['none','No Portal']].map(([v,l]) => (
              <button key={v} onClick={() => setPortalFilter(v)}
                style={{ padding:'4px 9px', borderRadius:5, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: portalFilter===v ? 'var(--red)' : 'var(--border)', background: portalFilter===v ? 'var(--red-bg)' : 'transparent', color: portalFilter===v ? 'var(--red)' : 'var(--tx-3)', transition:'all .1s' }}>
                {l}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', borderRadius:8, border:'1px solid var(--border)', overflow:'hidden' }}>
            {[{v:'grid',icon:LayoutGrid,label:'Cards'},{v:'table',icon:List,label:'Table'}].map(({v,icon:Icon,label},i)=>(
              <button key={v} onClick={()=>{ setView(v); localStorage.setItem('clients_view', v); }}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 10px', fontSize:12, fontWeight:600, background: view===v?'var(--red)':'var(--bg-elevated)', color: view===v?'#fff':'var(--tx-3)', border:'none', cursor:'pointer', borderRight: i===0?'1px solid var(--border)':'none' }}>
                <Icon size={13}/> {label}
              </button>
            ))}
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 10px', fontSize:12, color:'var(--tx-2)', outline:'none', cursor:'pointer' }}>
            <option value="score">Health</option><option value="mrr">MRR</option><option value="name">Name</option>
          </select>
          <button onClick={() => setShowWizard(true)} className="btn-primary btn-sm" style={{ gap:5 }}>
            <Plus size={13}/> Add Client
          </button>
        </div>

        {/* Summary strip */}
        <div style={{ display:'flex', gap:0, padding:'8px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {[
            { label:'Total MRR',    value:`$${totalMRR.toLocaleString()}`, color:'var(--tx-1)' },
            { label:'Portal Active',value:active,                          color:'#22c55e' },
            { label:'Invited',      value:invited,                         color:'#f59e0b' },
            { label:'No Portal',    value:noPortal,                        color:'#606060' },
            { label:'Healthy',      value:display.filter(c=>(c.score||0)>=70).length, color:'#22c55e' },
            { label:'At Risk',      value:display.filter(c=>(c.score||0)<40).length,  color:'#ef4444' },
          ].map((m,i) => (
            <div key={i} style={{ paddingRight:20, marginRight:20, borderRight:i<5?'1px solid var(--border)':'none' }}>
              <div style={{ fontSize:15, fontWeight:700, color:m.color }}>{m.value}</div>
              <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:1 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Content: Grid or Table */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {display.length === 0 ? (
            <div style={{ padding:'48px 0', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:10, opacity:0.5 }}>👥</div>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--tx-1)', marginBottom:6 }}>No clients yet</div>
              <div style={{ fontSize:13, color:'var(--tx-3)', marginBottom:16 }}>Add your first client to start managing their work and tracking delivery.</div>
            </div>
          ) : view === 'grid' ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14, padding:'16px 20px' }}>
              {display.map(c => {
                const planCfg = PLAN_CONFIG[c.plan] || {};
                return (
                  <div key={c._id} onClick={() => navigate(`/clients/${c._id || c.id}`)}
                    style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:10, padding:'16px', cursor:'pointer', transition:'box-shadow .15s, transform .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.2)'; e.currentTarget.style.transform='translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:38, height:38, borderRadius:9, background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'var(--red)', flexShrink:0 }}>
                        {c.name.charAt(0)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--tx-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</div>
                        <div style={{ fontSize:11, color:'var(--tx-3)' }}>{c.contact?.email || ''}</div>
                      </div>
                      <PortalBadge status={c.portal || 'none'} />
                    </div>
                    <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:`${planCfg.color || '#606060'}18`, color:planCfg.color || 'var(--tx-3)', fontWeight:600 }}>{c.plan}</span>
                      <ScoreBadge score={c.score||0} />
                      {onboardingMap[c._id] && (() => {
                        const ob = onboardingMap[c._id];
                        const done = ob.status === 'completed';
                        return (
                          <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background: done ? '#22c55e18' : '#f59e0b18', color: done ? '#22c55e' : '#f59e0b', fontWeight:600 }}>
                            {done ? 'Onboarded' : `${ob.completed_steps}/${ob.total_steps}`}
                          </span>
                        );
                      })()}
                      {c.tags?.map(t => <TagPill key={t} tag={t} />)}
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                      <div><div style={{ fontSize:16, fontWeight:700, color:'var(--tx-1)' }}>${(c.mrr||0).toLocaleString()}</div><div style={{ fontSize:10, color:'var(--tx-3)' }}>MRR</div></div>
                      <div style={{ textAlign:'center' }}><div style={{ fontSize:14, fontWeight:600, color: (c.requests_open||0)>2?'#f59e0b':'var(--tx-2)' }}>{c.requests_open||0}</div><div style={{ fontSize:10, color:'var(--tx-3)' }}>Open</div></div>
                      <div style={{ textAlign:'right' }}><div style={{ fontSize:12, fontWeight:500, color:'var(--tx-2)' }}>{c.am||'—'}</div><div style={{ fontSize:10, color:'var(--tx-3)' }}>AM</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th><th>Portal</th><th>Plan</th><th>MRR</th><th>Health</th>
                  <th>Open</th><th>Last Delivery</th><th>Renewal</th><th>AM</th><th></th>
                </tr>
              </thead>
              <tbody>
                {display.map(c => {
                  const isSelected = selected === c._id;
                  return (
                    <tr key={c._id} onClick={() => navigate(`/clients/${c._id || c.id}`)}
                      style={{ background: isSelected ? 'var(--bg-elevated)' : 'transparent', cursor:'pointer' }}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:30, height:30, borderRadius:7, background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'var(--red)', flexShrink:0 }}>
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                            <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:1 }}>
                              {c.tags?.map(t=><TagPill key={t} tag={t}/>)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><PortalBadge status={c.portal || 'none'} /></td>
                      <td>
                        <span style={{ fontSize:11.5, padding:'2px 8px', background:`${PLAN_CONFIG[c.plan]?.color || '#606060'}18`, borderRadius:4, color:PLAN_CONFIG[c.plan]?.color || 'var(--tx-3)', fontWeight:600 }}>
                          {c.plan}
                        </span>
                      </td>
                      <td style={{ fontWeight:700, color:'var(--tx-1)' }}>${(c.mrr||0).toLocaleString()}</td>
                      <td><ScoreBadge score={c.score||0}/></td>
                      <td style={{ color:(c.requests_open||0)>2?'#f59e0b':'var(--tx-2)', fontWeight:(c.requests_open||0)>2?600:400 }}>{c.requests_open||0}</td>
                      <td style={{ color:'var(--tx-2)', fontSize:12 }}>{c.last_delivery||'—'}</td>
                      <td style={{ fontSize:12, color:'var(--tx-3)' }}>{c.renewal ? new Date(c.renewal).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : '—'}</td>
                      <td style={{ fontSize:12, color:'var(--tx-2)' }}>{c.am||'—'}</td>
                      <td>
                        <button onClick={e=>{e.stopPropagation();setSelected(isSelected?null:c._id);}}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4, borderRadius:5 }}>
                          <ChevronRight size={13} style={{ transform: isSelected ? 'rotate(180deg)' : 'none', transition:'transform .15s' }}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {sel && (
        <ClientDetailPanel
          client={sel}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdateClient}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}

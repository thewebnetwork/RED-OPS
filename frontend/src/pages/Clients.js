import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, Plus, Search, X, ChevronRight, FileText, Activity,
  Mail, Phone, Globe, Building2, UserCheck, CreditCard,
  CheckCircle2, Circle, AlertCircle, MoreHorizontal,
  Copy, RefreshCw, ShieldOff, Send, Eye, Lock,
  Zap, Star, TrendingUp, Clock, DollarSign,
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

// ── Mock data (enriched with portal fields) ──────────────────────────────────
const MOCK_CLIENTS = [
  { _id:'c1', name:'Thompson Real Estate',   plan:'Growth', mrr:2500, score:82, renewal:'2026-05-15', requests_open:2,  deliveries:18, last_delivery:'Today',       am:'Jordan K.',  tags:['VIP'],     notes:'Strong Q1, needs Q2 strategy call.', portal:'active',  contact:{ name:'Mike Thompson',  email:'mike@thompsonre.ca',   phone:'403-555-0101' }, industry:'Real Estate', website:'thompsonre.ca',   last_login:'2 hours ago',   login_count:47 },
  { _id:'c2', name:'Riverside Realty Group', plan:'Starter',mrr:1200, score:91, renewal:'2026-06-01', requests_open:1,  deliveries:9,  last_delivery:'Yesterday',   am:'Jordan K.',  tags:['New'],     notes:'Just onboarded. First campaign live.', portal:'active', contact:{ name:'Sarah Riverside', email:'sarah@riverside.ca',   phone:'403-555-0202' }, industry:'Real Estate', website:'riverside.ca',    last_login:'Yesterday',     login_count:12 },
  { _id:'c3', name:'Apex Home Group',        plan:'Pro',    mrr:3800, score:55, renewal:'2026-04-30', requests_open:4,  deliveries:31, last_delivery:'5 days ago',  am:'Vitto P.',   tags:['Watch'],   notes:'4 open requests aging. Follow up.', portal:'invited',  contact:{ name:'David Apex',     email:'david@apexhomes.ca',   phone:'403-555-0303' }, industry:'Real Estate', website:'apexhomes.ca',    last_login:'Never',         login_count:0  },
  { _id:'c4', name:'Dani K. Coaching',       plan:'Growth', mrr:2500, score:38, renewal:'2026-05-10', requests_open:0,  deliveries:22, last_delivery:'12 days ago', am:'Vitto P.',   tags:['At Risk'], notes:'No delivery in 12 days. Need to escalate.', portal:'active', contact:{ name:'Dani Kowalski', email:'dani@danik.ca',        phone:'403-555-0404' }, industry:'Coaching',    website:'danik.ca',        last_login:'5 days ago',    login_count:31 },
  { _id:'c5', name:'Burnham & Associates',   plan:'Starter',mrr:1200, score:76, renewal:'2026-07-01', requests_open:1,  deliveries:11, last_delivery:'2 days ago',  am:'Jordan K.',  tags:[],          notes:'Quiet but consistent.', portal:'active',          contact:{ name:'Chris Burnham',  email:'chris@burnham.ca',     phone:'403-555-0505' }, industry:'Finance',     website:'burnham.ca',      last_login:'3 days ago',    login_count:8  },
  { _id:'c6', name:'Lakeside Homes Group',   plan:'Pro',    mrr:3800, score:88, renewal:'2026-08-15', requests_open:3,  deliveries:44, last_delivery:'Today',       am:'Vitto P.',   tags:['VIP'],     notes:'Top performer. Considering upgrade.', portal:'active',  contact:{ name:'Lisa Lakeside',  email:'lisa@lakeside.ca',     phone:'403-555-0606' }, industry:'Real Estate', website:'lakeside.ca',     last_login:'1 hour ago',    login_count:89 },
  { _id:'c7', name:'Summit Realty Calgary',  plan:'Growth', mrr:2500, score:62, renewal:'2026-06-20', requests_open:2,  deliveries:15, last_delivery:'4 days ago',  am:'Jordan K.',  tags:[],          notes:'Average engagement. Needs check-in.', portal:'none',    contact:{ name:'Tom Summit',     email:'tom@summitrealty.ca',  phone:'403-555-0707' }, industry:'Real Estate', website:'summitrealty.ca', last_login:'Never',         login_count:0  },
  { _id:'c8', name:'Park Ave Properties',    plan:'Starter',mrr:1200, score:71, renewal:'2026-07-10', requests_open:0,  deliveries:7,  last_delivery:'3 days ago',  am:'Jordan K.',  tags:['New'],     notes:'Second month in. Progressing well.', portal:'invited',  contact:{ name:'Amy Park',       email:'amy@parkave.ca',       phone:'403-555-0808' }, industry:'Real Estate', website:'parkave.ca',      last_login:'Never',         login_count:0  },
];

const TEAM_MEMBERS = ['Jordan Kim','Vitto Pessanha','Taryn Pessanha','Lucca Rossini','Sarah Chen','Marcus Obi'];
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

// ── Multi-step Add Client Wizard ──────────────────────────────────────────────
const WIZARD_STEPS = [
  { id:1, label:'Business',  icon: Building2,   title:'Business Info',       sub:'Company name, industry, website' },
  { id:2, label:'Contact',   icon: UserCheck,   title:'Portal Contact',      sub:'Who logs in to the client portal' },
  { id:3, label:'Plan',      icon: CreditCard,  title:'Plan & Billing',      sub:'Select their service package' },
  { id:4, label:'Team',      icon: Users,       title:'Assign Team',         sub:'Account manager & team' },
  { id:5, label:'Launch',    icon: Zap,         title:'Review & Launch',     sub:'Create account & send invite' },
];

function AddClientWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    // Step 1
    name: '', industry: '', website: '', phone: '',
    // Step 2
    contact_name: '', contact_email: '', contact_phone: '',
    // Step 3
    plan: '',
    // Step 4
    am: '', notes: '',
    // Step 5
    send_invite: true,
    tags: [],
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const canNext = () => {
    if (step === 1) return form.name.trim().length > 0;
    if (step === 2) return form.contact_name.trim() && form.contact_email.includes('@');
    if (step === 3) return form.plan !== '';
    if (step === 4) return true;
    return true;
  };

  const handleLaunch = async () => {
    setSending(true);
    await new Promise(r => setTimeout(r, 1400)); // simulate API
    setSending(false);
    setDone(true);
    if (onCreated) onCreated({
      _id: `c${Date.now()}`,
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
    });
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
            An invite was sent to <strong style={{ color:'var(--tx-2)' }}>{form.contact_email}</strong> with their portal login credentials.
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

        {/* ── Wizard Header ── */}
        <div style={{ padding:'20px 24px 0', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <h2 style={{ fontSize:16, fontWeight:800, margin:0 }}>Add New Client</h2>
              <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--tx-3)' }}>Set up client record + portal access in one flow</p>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4 }}><X size={16} /></button>
          </div>

          {/* Step indicators */}
          <div style={{ display:'flex', gap:0, marginBottom:-1 }}>
            {WIZARD_STEPS.map((s, i) => {
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

        {/* ── Step content ── */}
        <div style={{ padding:'24px 24px 16px', minHeight:280 }}>
          <div style={{ marginBottom:16 }}>
            <h3 style={{ fontSize:14, fontWeight:700, margin:'0 0 3px' }}>{WIZARD_STEPS[step-1].title}</h3>
            <p style={{ fontSize:12, color:'var(--tx-3)', margin:0 }}>{WIZARD_STEPS[step-1].sub}</p>
          </div>

          {/* STEP 1 – Business Info */}
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

          {/* STEP 2 – Portal Contact */}
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

          {/* STEP 3 – Plan */}
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

          {/* STEP 4 – Team */}
          {step === 4 && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={labelStyle}>Account Manager</label>
                <select className="input-field" value={form.am} onChange={e => f('am', e.target.value)}>
                  <option value="">Select account manager...</option>
                  {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
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

          {/* STEP 5 – Review & Launch */}
          {step === 5 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Summary card */}
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
              {/* Invite toggle */}
              <div style={{ padding:'12px 14px', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--tx-1)' }}>Send Portal Invite</div>
                  <div style={{ fontSize:11.5, color:'var(--tx-3)', marginTop:2 }}>Email {form.contact_email} their login credentials</div>
                </div>
                <button onClick={() => f('send_invite', !form.send_invite)} style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', padding:2, background: form.send_invite ? 'var(--red)' : 'var(--bg-overlay)', transition:'background .2s', display:'flex', alignItems:'center' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:'#fff', transition:'transform .2s', transform: form.send_invite ? 'translateX(20px)' : 'translateX(0)' }} />
                </button>
              </div>
              {/* Onboarding note */}
              <div style={{ padding:'10px 12px', background:'#a855f718', border:'1px solid #a855f730', borderRadius:8, fontSize:12, color:'#a855f7', display:'flex', alignItems:'center', gap:8 }}>
                <Zap size={13} /><span>A 16-step onboarding project will be auto-created for this client.</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding:'12px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={() => step > 1 ? setStep(s => s-1) : onClose()} className="btn-ghost btn-sm">
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:11.5, color:'var(--tx-3)' }}>Step {step} of {WIZARD_STEPS.length}</span>
            {step < 5
              ? <button className="btn-primary btn-sm" onClick={() => setStep(s => s+1)} disabled={!canNext()}>Continue →</button>
              : <button className="btn-primary btn-sm" onClick={handleLaunch} disabled={sending} style={{ minWidth:120 }}>
                  {sending ? <><div style={{ width:12, height:12, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite', marginRight:6 }} />Creating...</> : '🚀 Create & Launch'}
                </button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { fontSize:11, fontWeight:600, color:'var(--tx-3)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' };

// ── Inline style injection ────────────────────────────────────────────────────
const SPIN_CSS = `@keyframes spin { to { transform: rotate(360deg) } }`;

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
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const r = await ax().get(`${API}/users?role=Media+Client`);
        const d = r.data;
        const arr = Array.isArray(d) ? d : d?.items || [];
        if (arr.length > 0) setClients(arr);
      } catch(_) {}
      setLoading(false);
    };
    load();
  }, []);

  const toast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500); };

  const source = clients.length > 0 ? clients : MOCK_CLIENTS;

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
    setClients(prev => [newClient, ...prev.length > 0 ? prev : MOCK_CLIENTS]);
    setShowWizard(false);
    setSelected(newClient._id);
    toast(`✓ ${newClient.name} created — ${newClient.portal === 'invited' ? 'invite sent!' : 'no invite sent'}`);
  };

  const handleCopyLink = (c) => {
    navigator.clipboard?.writeText(`https://redops.redribbongroup.ca/login`).catch(()=>{});
    toast('Portal login link copied!');
  };

  const handleResendInvite = (c) => {
    toast(`Invite resent to ${c.contact?.email || 'client'}`);
  };

  const handleRevokePortal = (c) => {
    setClients(prev => (prev.length > 0 ? prev : MOCK_CLIENTS).map(x => x._id === c._id ? { ...x, portal:'none' } : x));
    toast(`Portal access revoked for ${c.name}`);
    setSelected(null);
  };

  return (
    <div className="page-fill" style={{ flexDirection:'row' }}>
      <style>{SPIN_CSS}</style>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 18px', fontSize:13, fontWeight:500, color:'var(--tx-1)', zIndex:9999, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', animation:'fadeUp 0.2s ease' }}>
          {toastMsg}
        </div>
      )}

      {showWizard && <AddClientWizard onClose={() => setShowWizard(false)} onCreated={handleCreated} />}

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
          {/* Portal filter */}
          <div style={{ display:'flex', gap:4 }}>
            {[['','All'],['active','Active'],['invited','Invited'],['none','No Portal']].map(([v,l]) => (
              <button key={v} onClick={() => setPortalFilter(v)}
                style={{ padding:'4px 9px', borderRadius:5, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: portalFilter===v ? 'var(--red)' : 'var(--border)', background: portalFilter===v ? 'var(--red-bg)' : 'transparent', color: portalFilter===v ? 'var(--red)' : 'var(--tx-3)', transition:'all .1s' }}>
                {l}
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

        {/* Table */}
        <div style={{ flex:1, overflowY:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Portal</th>
                <th>Plan</th>
                <th>MRR</th>
                <th>Health</th>
                <th>Open</th>
                <th>Last Delivery</th>
                <th>Renewal</th>
                <th>AM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {display.map(c => {
                const isSelected = selected === c._id;
                return (
                  <tr key={c._id} onClick={() => setSelected(isSelected ? null : c._id)}
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
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4, borderRadius:5 }}
                        onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-overlay)';e.currentTarget.style.color='var(--tx-1)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--tx-3)';}}>
                        <ChevronRight size={13}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {display.length === 0 && (
                <tr><td colSpan={10}><div className="empty-state">No clients found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {sel && (
        <div style={{ width:340, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto', background:'var(--bg-card)', animation:'slideRight 0.18s ease both' }}>
          {/* Panel header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Client Profile</span>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', display:'flex', padding:2 }}><X size={15}/></button>
          </div>

          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:16, flex:1 }}>

            {/* Identity */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:48, height:48, borderRadius:10, background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'var(--red)', flexShrink:0 }}>
                {sel.name.charAt(0)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:800, marginBottom:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sel.name}</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, padding:'1px 7px', background:`${PLAN_CONFIG[sel.plan]?.color || '#606060'}18`, borderRadius:4, color:PLAN_CONFIG[sel.plan]?.color || 'var(--tx-3)', fontWeight:600 }}>{sel.plan}</span>
                  {sel.tags?.map(t=><TagPill key={t} tag={t}/>)}
                </div>
              </div>
            </div>

            <ScoreBadge score={sel.score||0} />

            {/* Portal Access Section */}
            <div style={{ background:'var(--bg-elevated)', borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
              <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)' }}>Portal Access</span>
                <PortalBadge status={sel.portal || 'none'} />
              </div>
              <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                {sel.contact && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <UserCheck size={11} color="var(--tx-3)" />
                      <span style={{ fontSize:12, color:'var(--tx-1)', fontWeight:500 }}>{sel.contact.name}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Mail size={11} color="var(--tx-3)" />
                      <span style={{ fontSize:11.5, color:'var(--tx-2)' }}>{sel.contact.email}</span>
                    </div>
                    {sel.contact.phone && (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <Phone size={11} color="var(--tx-3)" />
                        <span style={{ fontSize:11.5, color:'var(--tx-2)' }}>{sel.contact.phone}</span>
                      </div>
                    )}
                  </div>
                )}
                {(sel.portal === 'active') && (
                  <div style={{ display:'flex', gap:5, fontSize:11, color:'var(--tx-3)', paddingTop:4, borderTop:'1px solid var(--border)' }}>
                    <Clock size={11} /><span>Last login: <strong style={{ color:'var(--tx-2)' }}>{sel.last_login || 'Unknown'}</strong></span>
                    <span style={{ marginLeft:'auto' }}>{sel.login_count || 0} sessions</span>
                  </div>
                )}
                {/* Portal actions */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', paddingTop:4 }}>
                  {(!sel.portal || sel.portal === 'none') && (
                    <button onClick={() => { const updated = { ...sel, portal:'invited' }; setClients(prev => (prev.length>0?prev:MOCK_CLIENTS).map(x=>x._id===sel._id?updated:x)); setSelected(sel._id); toast(`Invite sent to ${sel.contact?.email||'client'}`); }}
                      className="btn-primary btn-sm" style={{ gap:4 }}>
                      <Send size={11}/> Send Invite
                    </button>
                  )}
                  {sel.portal === 'invited' && (
                    <button onClick={() => handleResendInvite(sel)} className="btn-ghost btn-sm" style={{ gap:4 }}>
                      <RefreshCw size={11}/> Resend Invite
                    </button>
                  )}
                  {sel.portal === 'active' && (
                    <button onClick={() => handleCopyLink(sel)} className="btn-ghost btn-sm" style={{ gap:4 }}>
                      <Copy size={11}/> Copy Login Link
                    </button>
                  )}
                  {sel.portal !== 'none' && sel.portal && (
                    <button onClick={() => handleRevokePortal(sel)} className="btn-ghost btn-sm" style={{ gap:4, color:'#ef4444', borderColor:'#ef444430' }}
                      onMouseEnter={e=>{e.currentTarget.style.background='#ef444410';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
                      <ShieldOff size={11}/> Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'Monthly Retainer', value:`$${(sel.mrr||0).toLocaleString()}` },
                { label:'Open Requests',    value:sel.requests_open||0 },
                { label:'Total Deliveries', value:sel.deliveries||0 },
                { label:'Last Delivery',    value:sel.last_delivery||'—' },
                { label:'Renewal Date',     value:sel.renewal?new Date(sel.renewal).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'—' },
                { label:'Account Manager',  value:sel.am||'—' },
              ].map(m=>(
                <div key={m.label} style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'9px 11px' }}>
                  <div style={{ fontSize:10, color:'var(--tx-3)', marginBottom:3 }}>{m.label}</div>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'var(--tx-1)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Business info */}
            {(sel.website || sel.industry) && (
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {sel.industry && (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Building2 size={11} color="var(--tx-3)" />
                    <span style={{ fontSize:12, color:'var(--tx-2)' }}>{sel.industry}</span>
                  </div>
                )}
                {sel.website && (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Globe size={11} color="var(--tx-3)" />
                    <span style={{ fontSize:12, color:'var(--tx-2)' }}>{sel.website}</span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {sel.notes && (
              <div>
                <div style={{ fontSize:11, color:'var(--tx-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>Notes</div>
                <div style={{ fontSize:12, color:'var(--tx-2)', lineHeight:1.6, background:'var(--bg-elevated)', padding:'9px 11px', borderRadius:8 }}>{sel.notes}</div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display:'flex', gap:7 }}>
              <button onClick={() => navigate('/requests')} className="btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', gap:4 }}><FileText size={11}/> Requests</button>
              <button onClick={() => navigate('/projects')} className="btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', gap:4 }}><Activity size={11}/> Projects</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

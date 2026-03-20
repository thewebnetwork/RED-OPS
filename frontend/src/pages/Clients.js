import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, Plus, Search, TrendingUp, AlertTriangle, CheckCircle2,
  DollarSign, Clock, Star, X, RefreshCw, ChevronRight, MoreHorizontal,
  Filter, Tag, Calendar, FileText, Activity,
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok  = () => localStorage.getItem('token');
const ax   = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const health = s => s >= 70 ? { color:'#22c55e', label:'Healthy', bg:'#22c55e18' }
                 : s >= 40 ? { color:'#f59e0b', label:'Watch',   bg:'#f59e0b18' }
                 :           { color:'#ef4444', label:'At Risk',  bg:'#ef444418' };

const MOCK_CLIENTS = [
  { _id:'c1', name:'Thompson Real Estate',   plan:'Growth',   mrr:2500, score:82, renewal:'2025-05-15', requests_open:2,  deliveries:18, last_delivery:'Today',      am:'Jordan K.', tags:['VIP'],      notes:'Strong Q1, needs Q2 strategy call.' },
  { _id:'c2', name:'Riverside Realty Group', plan:'Starter',  mrr:1200, score:91, renewal:'2025-06-01', requests_open:1,  deliveries:9,  last_delivery:'Yesterday',  am:'Jordan K.', tags:['New'],      notes:'Just onboarded. First campaign live.' },
  { _id:'c3', name:'Apex Home Group',        plan:'Pro',      mrr:3800, score:55, renewal:'2025-04-30', requests_open:4,  deliveries:31, last_delivery:'5 days ago', am:'Vitto P.',  tags:['Watch'],    notes:'4 open requests aging. Follow up.' },
  { _id:'c4', name:'Dani K. Real Estate',    plan:'Growth',   mrr:2500, score:38, renewal:'2025-05-10', requests_open:0,  deliveries:22, last_delivery:'12 days ago',am:'Vitto P.',  tags:['At Risk'],  notes:'No delivery in 12 days. Need to escalate.' },
  { _id:'c5', name:'Burnham & Associates',   plan:'Starter',  mrr:1200, score:76, renewal:'2025-07-01', requests_open:1,  deliveries:11, last_delivery:'2 days ago', am:'Jordan K.', tags:[],           notes:'Quiet but consistent. Good account.' },
  { _id:'c6', name:'Lakeside Homes Group',   plan:'Pro',      mrr:3800, score:88, renewal:'2025-08-15', requests_open:3,  deliveries:44, last_delivery:'Today',      am:'Vitto P.',  tags:['VIP'],      notes:'Top performer. Considering upgrade.' },
  { _id:'c7', name:'Summit Realty Calgary',  plan:'Growth',   mrr:2500, score:62, renewal:'2025-06-20', requests_open:2,  deliveries:15, last_delivery:'4 days ago', am:'Jordan K.', tags:[],           notes:'Average engagement. Needs check-in.' },
  { _id:'c8', name:'Park Ave Properties',    plan:'Starter',  mrr:1200, score:71, renewal:'2025-07-10', requests_open:0,  deliveries:7,  last_delivery:'3 days ago', am:'Jordan K.', tags:['New'],      notes:'Second month in. Progressing well.' },
];

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
  return <span style={{ fontSize:10, fontWeight:600, padding:'1px 7px', borderRadius:4, background:`${c}18`, color:c }}>{tag}</span>;
}

function NewClientModal({ onClose }) {
  const [form, setForm] = useState({ name:'', plan:'Starter', mrr:'', am:'' });
  const f = (k,v) => setForm(p => ({...p,[k]:v}));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:460 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <h2 style={{ fontSize:16, fontWeight:700 }}>Add New Client</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', display:'flex' }}><X size={16}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Company Name *</label>
            <input className="input-field" placeholder="e.g. Sunrise Realty Group" value={form.name} onChange={e=>f('name',e.target.value)} autoFocus />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Plan</label>
              <select className="input-field" value={form.plan} onChange={e=>f('plan',e.target.value)}>
                <option>Starter</option><option>Growth</option><option>Pro</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Monthly Retainer</label>
              <input className="input-field" placeholder="$1,200" value={form.mrr} onChange={e=>f('mrr',e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Assigned Account Manager</label>
            <input className="input-field" placeholder="Team member name" value={form.am} onChange={e=>f('am',e.target.value)} />
          </div>
          <div style={{ padding:'10px 12px', background:'#3b82f618', border:'1px solid #3b82f630', borderRadius:8, fontSize:12.5, color:'#3b82f6', marginTop:2 }}>
            💡 Adding this client will auto-generate the 16-step onboarding checklist as a project.
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={onClose} className="btn-primary" disabled={!form.name.trim()}>Add Client</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [search,  setSearch]  = useState('');
  const [sort,    setSort]    = useState('score');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew]   = useState(searchParams.get('new') === '1');

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

  const display = (clients.length > 0 ? clients : MOCK_CLIENTS)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sort==='mrr' ? b.mrr-a.mrr : sort==='name' ? a.name.localeCompare(b.name) : (b.score||0)-(a.score||0));

  const sel = selected ? (clients.length > 0 ? clients : MOCK_CLIENTS).find(c => c._id === selected) : null;

  return (
    <div className="page-fill" style={{ flexDirection:'row' }}>
      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}

      {/* Main list */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <h1 style={{ fontSize:17, fontWeight:800, letterSpacing:'-.03em', margin:0 }}>Clients</h1>
          <span style={{ fontSize:12, color:'var(--tx-3)', padding:'2px 8px', background:'var(--bg-elevated)', borderRadius:10 }}>{display.length}</span>
          <div style={{ flex:1 }}/>
          <div style={{ position:'relative' }}>
            <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--tx-3)' }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients..."
              style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 10px 6px 28px', fontSize:12.5, color:'var(--tx-1)', outline:'none', width:180 }} />
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 10px', fontSize:12, color:'var(--tx-2)', outline:'none', cursor:'pointer' }}>
            <option value="score">Sort: Health</option>
            <option value="mrr">Sort: MRR</option>
            <option value="name">Sort: Name</option>
          </select>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm" style={{ gap:5 }}><Plus size={12}/> Add Client</button>
        </div>

        {/* Summary strip */}
        <div style={{ display:'flex', gap:0, padding:'8px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {[
            { label:'Total MRR', value:`$${(display.reduce((s,c)=>s+(c.mrr||0),0)).toLocaleString()}`, color:'var(--tx-1)' },
            { label:'Healthy', value:display.filter(c=>(c.score||0)>=70).length, color:'#22c55e' },
            { label:'Watch',   value:display.filter(c=>(c.score||0)>=40&&(c.score||0)<70).length, color:'#f59e0b' },
            { label:'At Risk', value:display.filter(c=>(c.score||0)<40).length, color:'#ef4444' },
          ].map((m,i) => (
            <div key={i} style={{ paddingRight:24, marginRight:24, borderRight:i<3?'1px solid var(--border)':'none' }}>
              <div style={{ fontSize:16, fontWeight:700, color:m.color }}>{m.value}</div>
              <div style={{ fontSize:11, color:'var(--tx-3)', marginTop:1 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Client table */}
        <div style={{ flex:1, overflowY:'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Plan</th>
                <th>MRR</th>
                <th>Health</th>
                <th>Open Requests</th>
                <th>Last Delivery</th>
                <th>Renewal</th>
                <th>AM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {display.map(c => {
                const h = health(c.score || 0);
                const isSelected = selected === c._id;
                return (
                  <tr key={c._id} onClick={() => setSelected(isSelected ? null : c._id)}
                    style={{ background: isSelected ? 'var(--bg-elevated)' : 'transparent', cursor:'pointer' }}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:7, background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--red)', flexShrink:0 }}>
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                          {c.tags?.map(t=><TagPill key={t} tag={t}/>)}
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize:12, padding:'2px 8px', background:'var(--bg-overlay)', borderRadius:4, color:'var(--tx-2)' }}>{c.plan}</span></td>
                    <td style={{ fontWeight:600, color:'var(--tx-1)' }}>${(c.mrr||0).toLocaleString()}</td>
                    <td><ScoreBadge score={c.score||0}/></td>
                    <td style={{ color: (c.requests_open||0) > 2 ? '#f59e0b' : 'var(--tx-2)' }}>{c.requests_open||0}</td>
                    <td style={{ color:'var(--tx-2)', fontSize:12 }}>{c.last_delivery||'—'}</td>
                    <td style={{ fontSize:12, color:'var(--tx-3)' }}>{c.renewal ? new Date(c.renewal).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : '—'}</td>
                    <td style={{ fontSize:12, color:'var(--tx-2)' }}>{c.am||'—'}</td>
                    <td>
                      <button onClick={e=>{e.stopPropagation();setSelected(isSelected?null:c._id);}} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', display:'flex', padding:4, borderRadius:5 }}
                        onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-overlay)';e.currentTarget.style.color='var(--tx-1)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--tx-3)';}}>
                        <ChevronRight size={13}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Panel */}
      {sel && (
        <div style={{ width:320, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto', background:'var(--bg-card)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Client Details</span>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', display:'flex' }}><X size={15}/></button>
          </div>
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <div style={{ width:44, height:44, borderRadius:10, background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'var(--red)', marginBottom:10 }}>
                {sel.name.charAt(0)}
              </div>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{sel.name}</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, padding:'2px 8px', background:'var(--bg-overlay)', borderRadius:4, color:'var(--tx-2)' }}>{sel.plan}</span>
                {sel.tags?.map(t=><TagPill key={t} tag={t}/>)}
              </div>
            </div>

            <ScoreBadge score={sel.score||0}/>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'Monthly Retainer', value:`$${(sel.mrr||0).toLocaleString()}` },
                { label:'Open Requests',    value:sel.requests_open||0 },
                { label:'Total Deliveries', value:sel.deliveries||0 },
                { label:'Last Delivery',    value:sel.last_delivery||'—' },
                { label:'Renewal Date',     value:sel.renewal?new Date(sel.renewal).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'—' },
                { label:'Account Manager',  value:sel.am||'—' },
              ].map(m=>(
                <div key={m.label} style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10.5, color:'var(--tx-3)', marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--tx-1)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {sel.notes && (
              <div>
                <div style={{ fontSize:11, color:'var(--tx-3)', marginBottom:6 }}>Internal Notes</div>
                <div style={{ fontSize:12.5, color:'var(--tx-2)', lineHeight:1.5, background:'var(--bg-elevated)', padding:'10px 12px', borderRadius:8 }}>{sel.notes}</div>
              </div>
            )}

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => navigate('/requests')} className="btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', gap:5 }}><FileText size={12}/> Requests</button>
              <button onClick={() => navigate('/projects')} className="btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', gap:5 }}><Activity size={12}/> Projects</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

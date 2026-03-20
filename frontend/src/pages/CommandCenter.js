import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, CheckSquare, FileText, FolderKanban, Users,
  AlertCircle, Zap, ArrowRight, Circle, CheckCircle2,
  Activity, DollarSign, Package, UserPlus, Star,
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok  = () => localStorage.getItem('token');
const ax   = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });
const health = s => s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444';
const PRIORITY_COLORS = { Urgent:'#ef4444', High:'#f59e0b', Normal:'var(--tx-2)', Low:'var(--tx-3)' };

function PulseCard({ icon: Icon, label, value, sub, color='var(--red)', trend }) {
  return (
    <div className="metric-card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ width:32, height:32, background:`${color}22`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={15} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span style={{ fontSize:11, color: trend >= 0 ? '#22c55e' : '#ef4444', fontWeight:600 }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="metric-value">{value}</div>
      <div style={{ fontSize:11.5, color:'var(--tx-3)', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'var(--tx-3)', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, to, color='var(--red)' }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:7,
      padding:'14px 8px', background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:10, cursor:'pointer', transition:'all .12s',
    }}
    onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-elevated)';e.currentTarget.style.borderColor='var(--border-hi)';}}
    onMouseLeave={e=>{e.currentTarget.style.background='var(--bg-card)';e.currentTarget.style.borderColor='var(--border)';}}>
      <div style={{ width:34, height:34, background:`${color}22`, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span style={{ fontSize:11.5, color:'var(--tx-2)', fontWeight:500, textAlign:'center', lineHeight:1.3 }}>{label}</span>
    </button>
  );
}

const MOCK_ACTIVITY = [
  { id:1, type:'task',    text:'Taryn completed "April Ad Creative Pack — final round"',   time:'2 min ago' },
  { id:2, type:'request', text:'New request submitted — Video Edit (Thompson RE)',          time:'14 min ago' },
  { id:3, type:'file',    text:'Lucca uploaded 3 files to "Dani K. May Campaign"',         time:'38 min ago' },
  { id:4, type:'task',    text:'Vitto closed "Set up GHL pipeline — Burnham"',             time:'1 hr ago' },
  { id:5, type:'client',  text:'New client onboarded — Riverside Realty Group',            time:'2 hrs ago' },
  { id:6, type:'request', text:'Revision requested — Email Copy (Apex Home Group)',        time:'3 hrs ago' },
  { id:7, type:'task',    text:'Lucca completed "Design thumbnail set — Apex May batch"',  time:'4 hrs ago' },
];

const MOCK_CLIENTS = [
  { id:1, name:'Thompson Real Estate',   mrr:2500, score:82, open:2, last:'Today' },
  { id:2, name:'Riverside Realty Group', mrr:1200, score:91, open:1, last:'Yesterday' },
  { id:3, name:'Apex Home Group',        mrr:3800, score:55, open:4, last:'5 days ago' },
  { id:4, name:'Dani K. Real Estate',    mrr:2500, score:38, open:0, last:'12 days ago' },
  { id:5, name:'Burnham & Associates',   mrr:1200, score:76, open:1, last:'2 days ago' },
];

const MOCK_TASKS = [
  { _id:'t1', title:'Review April ad creative — Thompson RE',     priority:'Urgent', status:'In Progress' },
  { _id:'t2', title:'Write email sequence — Riverside campaign',  priority:'High',   status:'Todo' },
  { _id:'t3', title:'Record Loom walkthrough — Burnham strategy', priority:'Normal', status:'Todo' },
  { _id:'t4', title:'Update GHL pipeline — Apex Home Group',      priority:'Normal', status:'Backlog' },
  { _id:'t5', title:'QA deliverables — Dani K. package',          priority:'High',   status:'In Review' },
];

export default function CommandCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [doneIds, setDoneIds] = useState(new Set());
  const [pulse, setPulse]     = useState({ requests:3, overdue:2, utilization:68, mrr:18400, target:22000 });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Vitto';

  useEffect(() => {
    const load = async () => {
      try {
        const [tRes, dRes] = await Promise.allSettled([
          ax().get(`${API}/tasks?limit=6`),
          ax().get(`${API}/dashboard`),
        ]);
        if (tRes.status === 'fulfilled') {
          const d = tRes.value.data;
          setTasks(Array.isArray(d) ? d : d?.items || []);
        }
        if (dRes.status === 'fulfilled') {
          const d = dRes.value.data;
          setPulse({ requests:d.new_requests_today??3, overdue:d.overdue_tasks??2, utilization:d.team_utilization??68, mrr:d.mrr??18400, target:d.mrr_target??22000 });
        }
      } catch(_) {}
      setLoading(false);
    };
    load();
  }, []);

  const dt = tasks.length > 0 ? tasks : MOCK_TASKS;
  const mrrPct = Math.round((pulse.mrr / pulse.target) * 100);
  const toggleTask = id => setDoneIds(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });

  return (
    <div className="page-content" style={{ paddingBottom:40 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, letterSpacing:'-.04em', marginBottom:4 }}>
            {greeting}, {firstName}. 👋
          </h1>
          <p style={{ fontSize:13.5, color:'var(--tx-3)', margin:0 }}>
            {new Date().toLocaleDateString('en-CA',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => navigate('/requests?new=1')} className="btn-primary" style={{ gap:6 }}><Plus size={13}/>New Request</button>
          <button onClick={() => navigate('/tasks?new=1')}    className="btn-ghost"   style={{ gap:6 }}><Plus size={13}/>New Task</button>
        </div>
      </div>

      {/* Pulse */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <PulseCard icon={FileText}    label="Requests today"   value={pulse.requests}          color='#3b82f6' trend={12} />
        <PulseCard icon={AlertCircle} label="Overdue items"    value={pulse.overdue}           color='#ef4444' />
        <PulseCard icon={Users}       label="Team utilization" value={`${pulse.utilization}%`} color='#22c55e' />
        <PulseCard icon={DollarSign}  label="MRR vs target"    value={`$${pulse.mrr.toLocaleString()}`} sub={`${mrrPct}% of $${pulse.target.toLocaleString()}`} color='var(--red)' trend={8} />
      </div>

      {/* Quick actions */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <QuickAction icon={FileText}     label="New Request"  to="/requests?new=1" color='#3b82f6' />
        <QuickAction icon={CheckSquare}  label="New Task"     to="/tasks?new=1"    color='#22c55e' />
        <QuickAction icon={FolderKanban} label="New Project"  to="/projects?new=1" color='#a855f7' />
        <QuickAction icon={UserPlus}     label="New Client"   to="/clients?new=1"  color='var(--red)' />
        <QuickAction icon={Star}         label="RRG Services" to="/services"       color='#f59e0b' />
        <QuickAction icon={Zap}          label="AI Brief"     to="/ai?mode=brief"  color='#a855f7' />
      </div>

      {/* 3-col */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>

        {/* Tasks */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>My Tasks</span>
            <button onClick={() => navigate('/tasks')} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11.5, color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer' }}>
              All <ArrowRight size={10}/>
            </button>
          </div>
          {loading ? <div style={{color:'var(--tx-3)',fontSize:13,padding:'16px 0',textAlign:'center'}}>Loading…</div> :
            dt.slice(0,5).map(t => {
              const done = doneIds.has(t._id) || t.status==='Done';
              return (
                <div key={t._id} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <button onClick={() => toggleTask(t._id)} style={{ background:'none', border:'none', cursor:'pointer', color:done?'#22c55e':'var(--tx-3)', padding:0, flexShrink:0, display:'flex' }}>
                    {done ? <CheckCircle2 size={14}/> : <Circle size={14}/>}
                  </button>
                  <span style={{ flex:1, fontSize:12.5, color:done?'var(--tx-3)':'var(--tx-1)', textDecoration:done?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.title}
                  </span>
                  <span style={{ fontSize:10, fontWeight:700, color:PRIORITY_COLORS[t.priority], flexShrink:0 }}>{t.priority}</span>
                </div>
              );
            })
          }
          <button onClick={() => navigate('/tasks?new=1')} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 0 0', color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer', fontSize:12 }}>
            <Plus size={12}/> Add task
          </button>
        </div>

        {/* Clients */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Active Clients</span>
            <button onClick={() => navigate('/clients')} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11.5, color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer' }}>
              All <ArrowRight size={10}/>
            </button>
          </div>
          {MOCK_CLIENTS.map(c => (
            <div key={c.id} onClick={() => navigate('/clients')} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.opacity='.75'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:health(c.score), flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:1 }}>{c.open} open · {c.last}</div>
              </div>
              <span style={{ fontSize:11.5, color:'var(--tx-3)', flexShrink:0 }}>${c.mrr.toLocaleString()}</span>
            </div>
          ))}
          <button onClick={() => navigate('/clients?new=1')} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 0 0', color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer', fontSize:12 }}>
            <Plus size={12}/> Add client
          </button>
        </div>

        {/* Activity */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Team Activity</span>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 5px #22c55e80' }}/>
          </div>
          {MOCK_ACTIVITY.map(e => {
            const icons = { task:<CheckSquare size={12}/>, request:<FileText size={12}/>, file:<Package size={12}/>, client:<UserPlus size={12}/> };
            return (
              <div key={e.id} style={{ display:'flex', gap:9, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:22, height:22, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--tx-3)', flexShrink:0, marginTop:1 }}>
                  {icons[e.type]||<Activity size={12}/>}
                </div>
                <div>
                  <div style={{ fontSize:12, color:'var(--tx-1)', lineHeight:1.4 }}>{e.text}</div>
                  <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:2 }}>{e.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* At-risk */}
      <div className="insight danger" style={{ marginTop:14 }}>
        <AlertCircle size={14} style={{ color:'#ef4444', flexShrink:0 }}/>
        <span style={{ flex:1, fontSize:13 }}>
          <strong style={{ color:'var(--tx-1)' }}>2 clients need attention</strong>
          <span style={{ color:'var(--tx-2)' }}> — Dani K. hasn't received a delivery in 12 days. Apex has 4 open unassigned requests.</span>
        </span>
        <button onClick={() => navigate('/clients')} className="btn-ghost btn-sm">Review</button>
      </div>

    </div>
  );
}

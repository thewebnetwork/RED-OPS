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
const health = s => s >= 70 ? 'var(--green)' : s >= 40 ? 'var(--yellow)' : 'var(--red)';
const PRIORITY_COLORS = { Urgent:'#ef4444', High:'#f59e0b', Normal:'var(--tx-2)', Low:'var(--tx-3)' };

function PulseCard({ icon: Icon, label, value, sub, color='var(--red)', trend }) {
  return (
    <div className="metric-card">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ width:32, height:32, background:`${color}22`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }} className="icon-box">
          <Icon size={15} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span style={{ fontSize:11, color: trend >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>
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


export default function CommandCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks]       = useState([]);
  const [clients, setClients]   = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [doneIds, setDoneIds]   = useState(new Set());
  const [pulse, setPulse]       = useState({ requests:0, overdue:0, utilization:0, mrr:0, target:0, sla_on_track:0, sla_breached:0 });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';

  useEffect(() => {
    const load = async () => {
      try {
        const instance = ax();
        const [tRes, cRes, aRes, dRes] = await Promise.allSettled([
          instance.get(`${API}/tasks?limit=6`),
          instance.get(`${API}/organizations/me/current/members`),
          instance.get(`${API}/dashboard/activity?limit=10`),
          instance.get(`${API}/dashboard/financial-stats`),
        ]);

        // Load tasks
        if (tRes.status === 'fulfilled') {
          const d = tRes.value.data;
          setTasks(Array.isArray(d) ? d : d?.items || []);
        }

        // Load clients/members
        if (cRes.status === 'fulfilled') {
          const d = cRes.value.data;
          setClients(Array.isArray(d) ? d : d?.members || d?.items || []);
        }

        // Load activity
        if (aRes.status === 'fulfilled') {
          const d = aRes.value.data;
          const items = Array.isArray(d) ? d : d?.activity || [];
          // Transform order data to activity format
          setActivity(items.map((item, idx) => ({
            id: item.id || item._id || idx,
            type: item.request_type ? 'request' : 'task',
            text: item.title || item.order_code || '',
            time: item.updated_at ? formatTimeAgo(new Date(item.updated_at)) : 'recently',
          })));
        }

        // Load financial stats
        if (dRes.status === 'fulfilled') {
          const d = dRes.value.data;
          setPulse({
            requests: d.requests_mtd ?? 0,
            overdue: d.overdue ?? 0,
            utilization: d.team_utilization ?? 0,
            mrr: d.mrr ?? 0,
            target: d.mrr_target ?? 0,
            sla_on_track: d.sla_on_track ?? 0,
            sla_breached: d.sla_breached ?? 0,
            requests_trend: d.requests_trend ?? null,
            mrr_trend: d.mrr_trend ?? null,
          });
        }
      } catch(_) {}
      setLoading(false);
    };
    load();
  }, []);

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const mrrPct = pulse.target > 0 ? Math.round((pulse.mrr / pulse.target) * 100) : null;
  const toggleTask = async (id) => {
    const task = tasks.find(t => (t._id || t.id) === id);
    if (!task) return;
    const isDone = doneIds.has(id) || ['done','Done','delivered'].includes(task.status);
    const newStatus = isDone ? 'todo' : 'done';
    // Optimistic toggle
    setDoneIds(p => { const n = new Set(p); isDone ? n.delete(id) : n.add(id); return n; });
    try {
      await ax().patch(`${API}/tasks/${id}`, { status: newStatus });
    } catch {
      // Revert on failure
      setDoneIds(p => { const n = new Set(p); isDone ? n.add(id) : n.delete(id); return n; });
    }
  };

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
      <div className="metrics-grid-4" style={{ marginBottom:20 }}>
        <PulseCard icon={FileText}    label="Requests this month" value={pulse.requests}          color='#3b82f6' trend={pulse.requests_trend} />
        <PulseCard icon={AlertCircle} label="Overdue items"       value={pulse.overdue}           color={pulse.overdue > 0 ? '#ef4444' : '#22c55e'} />
        <PulseCard icon={Users}       label="Team utilization"    value={`${pulse.utilization}%`} color='#22c55e' />
        <PulseCard icon={DollarSign}  label={pulse.target > 0 ? 'MRR vs target' : 'Monthly Revenue'} value={`$${pulse.mrr.toLocaleString()}`} sub={mrrPct !== null ? `${mrrPct}% of $${pulse.target.toLocaleString()}` : null} color='var(--red)' trend={pulse.mrr_trend} />
      </div>

      {/* Quick actions */}
      <div className="quick-actions-grid" style={{ marginBottom:20 }}>
        <QuickAction icon={FileText}     label="New Request"  to="/requests?new=1" color='#3b82f6' />
        <QuickAction icon={CheckSquare}  label="New Task"     to="/tasks?new=1"    color='#22c55e' />
        <QuickAction icon={FolderKanban} label="New Project"  to="/projects?new=1" color='#a855f7' />
        <QuickAction icon={UserPlus}     label="New Client"   to="/clients?new=1"  color='var(--red)' />
        <QuickAction icon={Star}         label="RRG Services" to="/services"       color='#f59e0b' />
        <QuickAction icon={Zap}          label="AI Brief"     to="/ai?mode=brief"  color='#a855f7' />
      </div>

      {/* 3-col */}
      <div className="responsive-grid-3">

        {/* Tasks */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>My Tasks</span>
            <button onClick={() => navigate('/tasks')} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11.5, color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer' }}>
              All <ArrowRight size={10}/>
            </button>
          </div>
          {loading ? (
            <div style={{color:'var(--tx-3)',fontSize:13,padding:'16px 0',textAlign:'center'}}>Loading…</div>
          ) : tasks.length > 0 ? (
            tasks.slice(0,5).map(t => {
              const tid = t._id || t.id;
              const done = doneIds.has(tid) || ['Done','done','delivered'].includes(t.status);
              return (
                <div key={tid} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <button onClick={() => toggleTask(tid)} style={{ background:'none', border:'none', cursor:'pointer', color:done?'var(--green)':'var(--tx-3)', padding:0, flexShrink:0, display:'flex' }}>
                    {done ? <CheckCircle2 size={14} style={{color:'var(--green)'}}/> : <Circle size={14}/>}
                  </button>
                  <span style={{ flex:1, fontSize:12.5, color:done?'var(--tx-3)':'var(--tx-1)', textDecoration:done?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.title}
                  </span>
                  <span style={{ fontSize:10, fontWeight:700, color:PRIORITY_COLORS[t.priority], flexShrink:0 }}>{t.priority}</span>
                </div>
              );
            })
          ) : (
            <div style={{color:'var(--tx-3)',fontSize:12.5,padding:'20px 0',textAlign:'center'}}>
              <div style={{ fontSize:20, marginBottom:6, opacity:0.4 }}>✅</div>
              <div style={{ marginBottom:4, fontWeight:500, color:'var(--tx-2)' }}>No tasks yet</div>
              <div style={{ fontSize:11.5 }}>Create a task to start tracking work</div>
            </div>
          )}
          <button onClick={() => navigate('/tasks?new=1')} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 0 0', color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer', fontSize:12 }}>
            <Plus size={12}/> Add task
          </button>
        </div>

        {/* Clients */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Team Members</span>
            <button onClick={() => navigate('/clients')} style={{ display:'flex', alignItems:'center', gap:3, fontSize:11.5, color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer' }}>
              All <ArrowRight size={10}/>
            </button>
          </div>
          {loading ? (
            <div style={{color:'var(--tx-3)',fontSize:13,padding:'16px 0',textAlign:'center'}}>Loading…</div>
          ) : clients.length > 0 ? (
            clients.slice(0, 5).map(c => (
              <div key={c.user_id || c.id} onClick={() => navigate('/clients')} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                onMouseEnter={e=>e.currentTarget.style.opacity='.75'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name || c.email}</div>
                  <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:1 }}>{c.org_role || 'Member'}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{color:'var(--tx-3)',fontSize:12.5,padding:'20px 0',textAlign:'center'}}>
              <div style={{ fontSize:20, marginBottom:6, opacity:0.4 }}>👥</div>
              <div style={{ marginBottom:4, fontWeight:500, color:'var(--tx-2)' }}>No team members yet</div>
              <div style={{ fontSize:11.5 }}>Add your team to start collaborating</div>
            </div>
          )}
          <button onClick={() => navigate('/clients?new=1')} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 0 0', color:'var(--tx-3)', background:'none', border:'none', cursor:'pointer', fontSize:12 }}>
            <Plus size={12}/> Add member
          </button>
        </div>

        {/* Activity */}
        <div className="card" style={{ padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Recent Activity</span>
            <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 5px var(--green)80' }}/>
          </div>
          {loading ? (
            <div style={{color:'var(--tx-3)',fontSize:13,padding:'16px 0',textAlign:'center'}}>Loading…</div>
          ) : activity.length > 0 ? (
            activity.slice(0, 6).map(e => {
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
            })
          ) : (
            <div style={{color:'var(--tx-3)',fontSize:12.5,padding:'20px 0',textAlign:'center'}}>
              <div style={{ fontSize:20, marginBottom:6, opacity:0.4 }}>📊</div>
              <div style={{ marginBottom:4, fontWeight:500, color:'var(--tx-2)' }}>No recent activity</div>
              <div style={{ fontSize:11.5 }}>Activity will appear here as your team works</div>
            </div>
          )}
        </div>
      </div>

      {/* At-risk */}
      {pulse.overdue > 0 && (
        <div className="insight danger" style={{ marginTop:14 }}>
          <AlertCircle size={14} style={{ color:'var(--red)', flexShrink:0 }}/>
          <span style={{ flex:1, fontSize:13 }}>
            <strong style={{ color:'var(--tx-1)' }}>{pulse.overdue} overdue item{pulse.overdue !== 1 ? 's' : ''}</strong>
            <span style={{ color:'var(--tx-2)' }}> — Review and prioritize these urgent tasks.</span>
          </span>
          <button onClick={() => navigate('/tasks')} className="btn-ghost btn-sm">Review</button>
        </div>
      )}

    </div>
  );
}

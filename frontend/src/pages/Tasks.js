import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, List, LayoutGrid, Search, Filter, X, ChevronDown,
  Circle, CheckCircle2, Clock, AlertCircle, ArrowUp, Minus, ArrowDown,
  MoreHorizontal, Calendar, Tag, User, Loader2, Grip,
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok  = () => localStorage.getItem('token');
const ax   = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const STATUSES = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'];
const STATUS_COLORS  = { Backlog:'var(--tx-3)', Todo:'#3b82f6', 'In Progress':'#f59e0b', 'In Review':'#a855f7', Done:'#22c55e' };
const STATUS_BG      = { Backlog:'var(--bg-elevated)', Todo:'#3b82f618', 'In Progress':'#f59e0b18', 'In Review':'#a855f718', Done:'#22c55e18' };
const PRIORITY_ICON  = { Urgent:<AlertCircle size={13} style={{color:'#ef4444'}}/>, High:<ArrowUp size={13} style={{color:'#f59e0b'}}/>, Normal:<Minus size={13} style={{color:'var(--tx-3)'}}/>, Low:<ArrowDown size={13} style={{color:'var(--tx-3)'}}/>};
const PRIORITY_ORDER = { Urgent:0, High:1, Normal:2, Low:3 };

const MOCK_TASKS = [
  { _id:'m1', title:'Review April ad creative — Thompson RE',        status:'In Progress', priority:'Urgent', project:'Thompson RE — April Campaign', assignee:'Taryn P.', due_date: new Date(Date.now()+86400*1000).toISOString(), labels:['Creative'] },
  { _id:'m2', title:'Write 5-email welcome sequence — Riverside',    status:'Todo',        priority:'High',   project:'Riverside Onboarding',         assignee:'Sarah C.', due_date: new Date(Date.now()+2*86400*1000).toISOString(), labels:['Copywriting'] },
  { _id:'m3', title:'Set up Meta ad account — Burnham',              status:'In Review',   priority:'High',   project:'Burnham Strategy Build',        assignee:'Lucca R.', due_date: new Date(Date.now()+86400*1000).toISOString(), labels:['Technical'] },
  { _id:'m4', title:'Design thumbnail pack (10) — Apex May',         status:'In Progress', priority:'Normal', project:'Apex Content Sprint — May',     assignee:'Taryn P.', due_date: new Date(Date.now()+3*86400*1000).toISOString(), labels:['Creative'] },
  { _id:'m5', title:'Monthly report — April (all clients)',           status:'Backlog',     priority:'High',   project:'Internal',                      assignee:'Vitto P.', due_date: new Date(Date.now()+5*86400*1000).toISOString(), labels:['Admin'] },
  { _id:'m6', title:'Update GHL pipeline stages — Apex',             status:'Todo',        priority:'Normal', project:'Apex Content Sprint — May',     assignee:'Vitto P.', due_date: new Date(Date.now()+4*86400*1000).toISOString(), labels:['Technical'] },
  { _id:'m7', title:'Record strategy call recap — Dani K.',          status:'Done',        priority:'Normal', project:'Dani K. Rebrand Package',       assignee:'Jordan K.', due_date: new Date(Date.now()-86400*1000).toISOString(), labels:['Strategy'] },
  { _id:'m8', title:'Edit 60s video ad — Riverside May campaign',    status:'In Progress', priority:'High',   project:'Riverside May Content',         assignee:'Marcus O.', due_date: new Date(Date.now()+2*86400*1000).toISOString(), labels:['Creative'] },
  { _id:'m9', title:'Audit SOP docs for Q2 accuracy',               status:'Backlog',     priority:'Low',    project:'Team SOP Audit Q2',             assignee:'Jordan K.', due_date: new Date(Date.now()+10*86400*1000).toISOString(), labels:['Admin'] },
  { _id:'m10',title:'QA final deliverables — Dani K. package',       status:'In Review',   priority:'Urgent', project:'Dani K. Rebrand Package',       assignee:'Vitto P.', due_date: new Date(Date.now()+86400*1000).toISOString(), labels:['Creative'] },
  { _id:'m11',title:'Build content calendar — Riverside May',        status:'Todo',        priority:'Normal', project:'Riverside May Content',         assignee:'Sarah C.', due_date: new Date(Date.now()+5*86400*1000).toISOString(), labels:['Strategy'] },
  { _id:'m12',title:'Upload deliverables to Nextcloud — Thompson',   status:'Done',        priority:'Normal', project:'Thompson RE — April Campaign',  assignee:'Marcus O.', due_date: new Date(Date.now()-2*86400*1000).toISOString(), labels:['Admin'] },
];

// ── Status Dot ───────────────────────────────────────────
function StatusDot({ status, size=9 }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', background:STATUS_COLORS[status], flexShrink:0 }}/>;
}

// ── New Task Modal ───────────────────────────────────────
function NewTaskModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title:'', status:'Todo', priority:'Normal', assignee:'', due_date:'', project:'', labels:[] });
  const f = (k,v) => setForm(p => ({...p,[k]:v}));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:480 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <h2 style={{ fontSize:16, fontWeight:700, letterSpacing:'-.02em' }}>New Task</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', display:'flex' }}><X size={16}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Task Title *</label>
            <input className="input-field" placeholder="What needs to be done?" value={form.title} onChange={e=>f('title',e.target.value)} autoFocus />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Status</label>
              <select className="input-field" value={form.status} onChange={e=>f('status',e.target.value)}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Priority</label>
              <select className="input-field" value={form.priority} onChange={e=>f('priority',e.target.value)}>
                {['Urgent','High','Normal','Low'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Assignee</label>
              <input className="input-field" placeholder="Assign to..." value={form.assignee} onChange={e=>f('assignee',e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Due Date</label>
              <input className="input-field" type="date" value={form.due_date} onChange={e=>f('due_date',e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:11.5, color:'var(--tx-3)', display:'block', marginBottom:5 }}>Project</label>
            <input className="input-field" placeholder="Link to a project..." value={form.project} onChange={e=>f('project',e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:6 }}>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={() => { if(form.title.trim()) { onSave(form); onClose(); } }} className="btn-primary" disabled={!form.title.trim()}>
              Create Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── List Row ─────────────────────────────────────────────
function TaskRow({ task, onToggle, onClick }) {
  const done = task.status === 'Done';
  const overdue = task.due_date && new Date(task.due_date) < new Date() && !done;
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background .08s' }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      <button onClick={e=>{e.stopPropagation();onToggle(task._id);}} style={{ background:'none', border:'none', cursor:'pointer', color:done?'#22c55e':'var(--tx-3)', padding:0, flexShrink:0, display:'flex' }}>
        {done ? <CheckCircle2 size={15}/> : <Circle size={15}/>}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:done?'var(--tx-3)':'var(--tx-1)', textDecoration:done?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 }}>
          {task.title}
        </div>
        {task.project && (
          <div style={{ fontSize:11, color:'var(--tx-3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.project}</div>
        )}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        {PRIORITY_ICON[task.priority]}
        {task.labels?.map(l => (
          <span key={l} style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:4, background:'var(--bg-overlay)', color:'var(--tx-3)' }}>{l}</span>
        ))}
        {task.assignee && (
          <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'white', flexShrink:0 }}>
            {task.assignee.charAt(0)}
          </div>
        )}
        {task.due_date && (
          <span style={{ fontSize:11, color: overdue ? '#ef4444' : 'var(--tx-3)', fontWeight: overdue ? 600 : 400, display:'flex', alignItems:'center', gap:3 }}>
            {overdue && <AlertCircle size={11}/>}
            {new Date(task.due_date).toLocaleDateString('en-CA',{month:'short',day:'numeric'})}
          </span>
        )}
        <div style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, background:STATUS_BG[task.status], color:STATUS_COLORS[task.status] }}>
          {task.status}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────
function KanbanCol({ status, tasks, onToggle }) {
  const color = STATUS_COLORS[status];
  return (
    <div style={{ flex:'0 0 230px', display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:color }}/>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--tx-1)' }}>{status}</span>
        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--tx-3)', background:'var(--bg-overlay)', padding:'1px 7px', borderRadius:10, fontWeight:600 }}>{tasks.length}</span>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:6 }}>
        {tasks.map(task => {
          const done = task.status==='Done';
          const overdue = task.due_date && new Date(task.due_date) < new Date() && !done;
          return (
            <div key={task._id} className="kanban-card">
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:6 }}>
                <span style={{ fontSize:12.5, fontWeight:500, color:done?'var(--tx-3)':'var(--tx-1)', flex:1, lineHeight:1.4 }}>{task.title}</span>
                {PRIORITY_ICON[task.priority]}
              </div>
              {task.project && <div style={{ fontSize:10.5, color:'var(--tx-3)', marginBottom:6 }}>{task.project}</div>}
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {task.assignee && (
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, color:'white' }}>
                    {task.assignee.charAt(0)}
                  </div>
                )}
                <span style={{ fontSize:10, flex:1, color:'var(--tx-3)' }}>{task.assignee?.split(' ')[0]}</span>
                {task.due_date && (
                  <span style={{ fontSize:10, color:overdue?'#ef4444':'var(--tx-3)', fontWeight:overdue?600:400 }}>
                    {new Date(task.due_date).toLocaleDateString('en-CA',{month:'short',day:'numeric'})}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <button style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 8px', color:'var(--tx-3)', background:'none', border:'1px dashed var(--border)', borderRadius:8, cursor:'pointer', fontSize:12, width:'100%', justifyContent:'center' }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border-hi)';e.currentTarget.style.color='var(--tx-2)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--tx-3)';}}>
          <Plus size={12}/> Add
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function Tasks() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView]       = useState('list');
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [doneIds, setDoneIds] = useState(new Set());
  const [showNew, setShowNew] = useState(searchParams.get('new') === '1');
  const [localNew, setLocalNew] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await ax().get(`${API}/tasks?limit=50`);
        const d = r.data;
        setTasks(Array.isArray(d) ? d : d?.items || []);
      } catch(_) {}
      setLoading(false);
    };
    load();
  }, []);

  const allTasks = [...(tasks.length > 0 ? tasks : MOCK_TASKS), ...localNew];

  const filtered = allTasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || t.status === filter || (filter === 'mine' && t.assignee);
    return matchSearch && matchFilter;
  });

  const toggleDone = id => setDoneIds(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });

  const handleSave = (form) => {
    setLocalNew(p => [...p, { ...form, _id: `local-${Date.now()}` }]);
  };

  return (
    <div className="page-fill">
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} onSave={handleSave} />}

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <h1 style={{ fontSize:17, fontWeight:800, letterSpacing:'-.03em', margin:0, marginRight:4 }}>Tasks</h1>

        {/* Filter chips */}
        <div style={{ display:'flex', gap:4 }}>
          {[['all','All'],['Todo','Todo'],['In Progress','In Progress'],['In Review','Review'],['Done','Done']].map(([v,l]) => (
            <button key={v} onClick={()=>setFilter(v)} style={{
              padding:'4px 10px', borderRadius:6, fontSize:12, fontWeight:500, border:'1px solid',
              borderColor: filter===v ? 'var(--red)' : 'var(--border)',
              background:  filter===v ? 'var(--red-bg)' : 'transparent',
              color:       filter===v ? '#e8404e' : 'var(--tx-2)',
              cursor:'pointer', transition:'all .1s',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ flex:1 }}/>

        {/* Search */}
        <div style={{ position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--tx-3)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks..."
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 10px 6px 28px', fontSize:12.5, color:'var(--tx-1)', outline:'none', width:180 }} />
        </div>

        {/* View toggle */}
        <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:7, overflow:'hidden' }}>
          {[['list',<List size={13}/>],['board',<LayoutGrid size={13}/>]].map(([v,ic]) => (
            <button key={v} onClick={()=>setView(v)} style={{
              padding:'6px 10px', background:view===v?'var(--bg-elevated)':'transparent', border:'none',
              cursor:'pointer', color:view===v?'var(--tx-1)':'var(--tx-3)', display:'flex', alignItems:'center',
            }}>{ic}</button>
          ))}
        </div>

        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm" style={{ gap:5 }}>
          <Plus size={12}/> New Task
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--tx-3)' }}>
          <Loader2 size={20} className="spin"/>
        </div>
      ) : view === 'list' ? (
        <div style={{ flex:1, overflowY:'auto', overflowX:'hidden' }}>
          {filtered.length === 0 ? (
            <div className="empty-state">No tasks match your filter.</div>
          ) : filtered.map(t => (
            <TaskRow key={t._id} task={{ ...t, status: doneIds.has(t._id) ? 'Done' : t.status }} onToggle={toggleDone} />
          ))}
        </div>
      ) : (
        // Kanban board
        <div style={{ flex:1, display:'flex', overflowX:'auto', overflowY:'hidden', gap:12, padding:12 }}>
          {STATUSES.map(s => {
            const col = filtered.filter(t => (doneIds.has(t._id) ? 'Done' : t.status) === s);
            return (
              <div key={s} className="kanban-col" style={{ flex:'0 0 230px', height:'100%' }}>
                <KanbanCol status={s} tasks={col} onToggle={toggleDone} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

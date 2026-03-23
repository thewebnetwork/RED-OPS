import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  Plus,
  Search,
  X,
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  MessageSquare,
} from 'lucide-react';

// ── API Configuration ────────────────────────────────────────────────────────────
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const getToken = () => localStorage.getItem('token');
const getHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const STAGES = ['Submitted','Assigned','In Progress','Pending Review','Revision','Delivered','Closed'];

const STAGE_COLORS = {
  'Submitted':     '#3b82f6',
  'Assigned':      '#a855f7',
  'In Progress':   '#f59e0b',
  'Pending Review':'#06b6d4',
  'Revision':      '#ef4444',
  'Delivered':     '#22c55e',
  'Closed':        '#606060',
};

// ── Static Config ────────────────────────────────────────────────────────────
// SERVICES: Dropdown options list (static config, not mock data)
const SERVICES = ['Video Editing','Graphic Design','Copywriting','Social Media Pack','Meta Ads Setup','Email Sequence','Blog Post','Landing Page','Branding Package'];

const PRIORITY_COLOR = { Urgent:'#c92a3e', High:'#f59e0b', Normal:'#3b82f6', Low:'#606060' };
const PRIORITY_ICON  = { Urgent: AlertCircle, High: ArrowUp, Normal: Minus, Low: ArrowDown };

const fmt = d => d ? new Date(d).toLocaleDateString('en-US',{ month:'short', day:'numeric' }) : '—';
const isOverdue = d => d && new Date(d) < new Date() && new Date(d).toDateString() !== new Date().toDateString();

// ── Sub-components ───────────────────────────────────────────────────────────
function PriorityIcon({ priority, size = 12 }) {
  const Icon = PRIORITY_ICON[priority] || Minus;
  return <Icon size={size} color={PRIORITY_COLOR[priority] || 'var(--tx-3)'} />;
}

function Assignee({ assignee, size = 22 }) {
  return (
    <div title={assignee.name} style={{ width:size, height:size, borderRadius:'50%', background:assignee.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize: size > 26 ? 11 : 9, fontWeight:700, color:'#fff', flexShrink:0 }}>
      {assignee.avatar}
    </div>
  );
}

function StagePill({ stage }) {
  const color = STAGE_COLORS[stage] || 'var(--tx-3)';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:600, background:`${color}22`, color }}>
      {stage}
    </span>
  );
}

// Pure display card — used both inline and inside DragOverlay
function RequestCard({ req, onClick, ghost = false }) {
  const overdue = isOverdue(req.due_date);
  return (
    <div
      className="kanban-card"
      onClick={onClick}
      style={{
        cursor: ghost ? 'grabbing' : 'pointer',
        boxShadow: ghost ? '0 8px 24px rgba(0,0,0,0.5)' : undefined,
        opacity: ghost ? 0.95 : 1,
      }}
    >
      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
        <PriorityIcon priority={req.priority} size={11} />
        <span style={{ fontSize:12, fontWeight:500, color:'var(--tx-1)', lineHeight:1.35, flex:1 }}>{req.title}</span>
      </div>
      <span className="pill pill-gray" style={{ fontSize:10 }}>{req.service}</span>
      <p style={{ margin:'5px 0 0', fontSize:11, color:'var(--tx-2)' }}>{req.client}</p>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' }}>
        <Assignee assignee={req.assignee} size={20} />
        <span style={{ fontSize:10, color: overdue ? '#ef4444' : 'var(--tx-3)', fontWeight: overdue ? 600 : 400 }}>
          {overdue ? '⚠ ' : ''}{fmt(req.due_date)}
        </span>
      </div>
    </div>
  );
}

// Draggable wrapper — hides original while dragging (DragOverlay shows the ghost)
function DraggableCard({ req, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: req.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0 : 1, touchAction: 'none' }}
    >
      <RequestCard req={req} onClick={onOpen} />
    </div>
  );
}

// Droppable column body — highlights on hover
function DroppableColumn({ stage, children, isEmpty }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const color = STAGE_COLORS[stage];
  return (
    <div
      ref={setNodeRef}
      className="kanban-col-body"
      style={{
        minHeight: 80,
        transition: 'background 0.15s, border-color 0.15s',
        background: isOver ? `${color}14` : undefined,
        borderRadius: 6,
        outline: isOver ? `1px dashed ${color}60` : '1px dashed transparent',
      }}
    >
      {children}
      {isEmpty && !isOver && (
        <div style={{ textAlign:'center', padding:'20px 8px', color:'var(--tx-3)', fontSize:12 }}>No requests</div>
      )}
      {isEmpty && isOver && (
        <div style={{ textAlign:'center', padding:'20px 8px', color: color, fontSize:12, fontWeight:500 }}>Drop here</div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Requests() {
  const [requests,    setRequests]    = useState([]);
  const [clients,     setClients]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [view,        setView]        = useState('kanban');
  const [search,      setSearch]      = useState('');
  const [priFilter,   setPriFilter]   = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [activeId,    setActiveId]    = useState(null);
  const [comment,     setComment]     = useState('');
  const [form, setForm] = useState({ title:'', client:'', service:'', priority:'Normal', due_date:'', description:'' });

  useEffect(() => {
    fetchData();
    if (new URLSearchParams(window.location.search).get('new') === '1') setShowModal(true);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch clients (Media Client users)
      const usersRes = await fetch(`${API}/users`, {
        headers: getHeaders(),
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const arr = Array.isArray(usersData) ? usersData : usersData?.items || [];
        const clientNames = arr
          .filter(u => u.account_type === 'Media Client')
          .map(u => u.name || u.email);
        setClients(clientNames);
      }

      // Fetch requests/tasks
      const res = await fetch(`${API}/tasks`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Transform tasks to requests format
      const transformed = data.map(task => ({
        id: task.id,
        title: task.title,
        client: task.project_name || 'Unassigned Project',
        service: task.task_type || 'Task',
        priority: (['Urgent', 'High', 'Normal', 'Low'].includes(task.priority) ? task.priority : 'Normal'),
        assignee: task.assignee_name ?
          { name: task.assignee_name, avatar: task.assignee_name.split(' ').map(w => w[0]).join(''), color: '#3b82f6' } :
          { name: 'Unassigned', avatar: '?', color: '#606060' },
        created_at: task.created_at ? new Date(task.created_at).toISOString().split('T')[0] : '',
        due_date: task.due_at ? new Date(task.due_at).toISOString().split('T')[0] : '',
        stage: task.status ? task.status.charAt(0).toUpperCase() + task.status.slice(1) : 'Submitted',
        description: task.description || '',
      }));

      setRequests(transformed);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    return (!q || r.title.toLowerCase().includes(q) || r.client.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
        && (!priFilter || r.priority === priFilter);
  });

  const byStage   = STAGES.reduce((a, s) => { a[s] = filtered.filter(r => r.stage === s); return a; }, {});
  const open      = filtered.filter(r => !['Delivered','Closed'].includes(r.stage)).length;
  const overdue   = filtered.filter(r => isOverdue(r.due_date) && !['Delivered','Closed'].includes(r.stage)).length;
  const activeDrag = requests.find(r => r.id === activeId) || null;

  const updateStage = (id, stage) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, stage } : r));
    if (selectedReq?.id === id) setSelectedReq(prev => ({ ...prev, stage }));
  };

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const req = requests.find(r => r.id === active.id);
    if (!req || req.stage === over.id) return;
    updateStage(active.id, over.id);
  };

  const handleDragCancel = () => setActiveId(null);

  const createRequest = () => {
    if (!form.title || !form.client || !form.service) return;
    const next = `RRG-${String(requests.length + 1).padStart(5,'0')}`;
    setRequests(prev => [...prev, { ...form, id:next, assignee:{ name:'Unassigned', avatar:'?', color:'#606060' }, created_at: new Date().toISOString().split('T')[0], stage:'Submitted' }]);
    setShowModal(false);
    setForm({ title:'', client:'', service:'', priority:'Normal', due_date:'', description:'' });
  };

  if (loading) {
    return (
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'var(--bg)', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontSize:14, color:'var(--tx-3)' }}>Loading requests...</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Toolbar ── */}
      <div style={{ padding:'10px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexShrink:0, background:'var(--bg)' }}>
        <div>
          <span style={{ fontSize:18, fontWeight:700, color:'var(--tx-1)' }}>Requests</span>
          <span style={{ marginLeft:10, fontSize:12, color:'var(--tx-3)' }}>
            {requests.length === 0 ? 'No requests yet' : `${filtered.length} total · ${open} open${overdue > 0 ? ' · ' : ''}${overdue > 0 ? <span style={{ color:'#ef4444' }}>{overdue} overdue</span> : ''}`}
          </span>
        </div>

        <div style={{ flex:1 }} />

        {/* Search */}
        <div style={{ position:'relative' }}>
          <Search size={13} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--tx-3)', pointerEvents:'none' }} />
          <input className="input-field" placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:28, width:240, height:32, fontSize:12 }} />
        </div>

        {/* Priority filter */}
        {['Urgent','High','Normal','Low'].map(p => (
          <button key={p} onClick={() => setPriFilter(priFilter === p ? '' : p)}
            style={{ padding:'3px 8px', borderRadius:5, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: priFilter === p ? PRIORITY_COLOR[p] : 'var(--border)', background: priFilter === p ? `${PRIORITY_COLOR[p]}22` : 'transparent', color: priFilter === p ? PRIORITY_COLOR[p] : 'var(--tx-3)', transition:'all .12s' }}>
            {p}
          </button>
        ))}

        {/* View toggle */}
        <div style={{ display:'flex', background:'var(--bg-elevated)', borderRadius:6, padding:2, gap:2 }}>
          {['kanban','table'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding:'4px 10px', borderRadius:4, fontSize:12, fontWeight:500, cursor:'pointer', border:'none', background: view === v ? 'var(--red)' : 'transparent', color: view === v ? '#fff' : 'var(--tx-2)', transition:'all .12s', textTransform:'capitalize' }}>
              {v}
            </button>
          ))}
        </div>

        <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> New Request</button>
      </div>

      {/* ── Board / Table ── */}
      <div style={{ flex:1, overflow: view === 'kanban' ? 'hidden' : 'auto', display:'flex', flexDirection:'column' }}>

        {requests.length === 0 ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--tx-1)', marginBottom:8 }}>No requests yet</div>
              <div style={{ fontSize:13, color:'var(--tx-3)', marginBottom:16 }}>Create your first request to get started</div>
              <button className="btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> New Request</button>
            </div>
          </div>
        ) : view === 'kanban' ? (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div style={{ flex:1, overflowX:'auto', overflowY:'hidden', padding:'14px 20px', display:'flex', gap:10 }}>
              {STAGES.map(stage => (
                <div key={stage} className="kanban-col" style={{ flex:'0 0 248px' }}>
                  <div className="kanban-col-header" style={{ gap:8 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:STAGE_COLORS[stage], flexShrink:0, display:'inline-block' }} />
                    <span style={{ fontSize:12, fontWeight:600, color:'var(--tx-1)' }}>{stage}</span>
                    <span style={{ marginLeft:'auto', fontSize:11, color:'var(--tx-3)', background:'var(--bg-overlay)', padding:'1px 6px', borderRadius:4 }}>{byStage[stage].length}</span>
                  </div>
                  <DroppableColumn stage={stage} isEmpty={byStage[stage].length === 0}>
                    {byStage[stage].map(req => (
                      <DraggableCard key={req.id} req={req} onOpen={() => setSelectedReq(req)} />
                    ))}
                  </DroppableColumn>
                </div>
              ))}
            </div>

            {/* Ghost card that follows the cursor */}
            <DragOverlay dropAnimation={null}>
              {activeDrag && <RequestCard req={activeDrag} onClick={() => {}} ghost />}
            </DragOverlay>
          </DndContext>
        ) : (
          <div style={{ margin:16 }}>
            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th><th>Title</th><th>Client</th><th>Service</th>
                    <th>Stage</th><th>Priority</th><th>Assignee</th><th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign:'center', padding:'40px', color:'var(--tx-3)' }}>No requests match your filters</td>
                    </tr>
                  ) : filtered.map(req => (
                    <tr key={req.id} onClick={() => setSelectedReq(req)} style={{ cursor:'pointer' }}>
                      <td style={{ color:'var(--red)', fontWeight:600, fontSize:12 }}>{req.id}</td>
                      <td style={{ fontWeight:500, maxWidth:220 }}>{req.title}</td>
                      <td style={{ color:'var(--tx-2)' }}>{req.client}</td>
                      <td><span className="pill pill-gray" style={{ fontSize:10 }}>{req.service}</span></td>
                      <td><StagePill stage={req.stage} /></td>
                      <td>
                        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12 }}>
                          <PriorityIcon priority={req.priority} />
                          {req.priority}
                        </span>
                      </td>
                      <td>
                        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <Assignee assignee={req.assignee} size={20} />
                          <span style={{ fontSize:12, color:'var(--tx-2)' }}>{req.assignee.name}</span>
                        </span>
                      </td>
                      <td style={{ color: isOverdue(req.due_date) ? '#ef4444' : 'var(--tx-1)', fontSize:12 }}>{fmt(req.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── New Request Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>New Request</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-2)' }}><X size={18} /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--tx-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Title</label>
                <input type="text" className="input-field" placeholder="Request title..." value={form.title} onChange={e => setForm(p => ({ ...p, title:e.target.value }))} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--tx-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Client</label>
                <select className="input-field" value={form.client} onChange={e => setForm(p => ({ ...p, client:e.target.value }))}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--tx-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Service</label>
                <select className="input-field" value={form.service} onChange={e => setForm(p => ({ ...p, service:e.target.value }))}>
                  <option value="">Select service...</option>
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--tx-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Priority</label>
                  <select className="input-field" value={form.priority} onChange={e => setForm(p => ({ ...p, priority:e.target.value }))}>
                    {['Urgent','High','Normal','Low'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--tx-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Due Date</label>
                  <input type="date" className="input-field" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date:e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--tx-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Description</label>
                <textarea className="input-field" rows={3} placeholder="Describe the request..." value={form.description} onChange={e => setForm(p => ({ ...p, description:e.target.value }))} />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
                <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={createRequest}>Create Request</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Panel ── */}
      {selectedReq && (
        <div style={{ position:'fixed', top:0, right:0, width:360, height:'100vh', background:'var(--bg-card)', borderLeft:'1px solid var(--border)', overflowY:'auto', zIndex:200, animation:'slideRight 0.2s ease both' }}>
          {/* Header */}
          <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', gap:10 }}>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:11, color:'var(--red)', fontWeight:600 }}>{selectedReq.id}</span>
              <h3 style={{ margin:'4px 0 0', fontSize:14, fontWeight:700, lineHeight:1.4 }}>{selectedReq.title}</h3>
            </div>
            <button onClick={() => setSelectedReq(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-2)', padding:4 }}><X size={16} /></button>
          </div>
          {/* Body */}
          <div style={{ padding:18, display:'flex', flexDirection:'column', gap:16 }}>
            {/* Stage selector */}
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Stage</label>
              <select className="input-field" value={selectedReq.stage} onChange={e => updateStage(selectedReq.id, e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Info grid */}
            {[
              ['Client',   selectedReq.client],
              ['Service',  selectedReq.service],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:3 }}>{lbl}</label>
                <span style={{ fontSize:13, color:'var(--tx-1)' }}>{val}</span>
              </div>
            ))}
            {/* Priority */}
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Priority</label>
              <div style={{ display:'flex', gap:5 }}>
                {['Urgent','High','Normal','Low'].map(p => (
                  <button key={p} onClick={() => { const u = { ...selectedReq, priority:p }; setSelectedReq(u); setRequests(prev => prev.map(r => r.id === u.id ? u : r)); }}
                    style={{ padding:'3px 9px', borderRadius:5, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: selectedReq.priority === p ? PRIORITY_COLOR[p] : 'var(--border)', background: selectedReq.priority === p ? `${PRIORITY_COLOR[p]}22` : 'transparent', color: selectedReq.priority === p ? PRIORITY_COLOR[p] : 'var(--tx-3)' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {/* Assignee */}
            <div>
              <label style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Assignee</label>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Assignee assignee={selectedReq.assignee} size={30} />
                <span style={{ fontSize:13, color:'var(--tx-1)' }}>{selectedReq.assignee.name}</span>
              </div>
            </div>
            {/* Dates */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:3 }}>Created</label>
                <span style={{ fontSize:13, color:'var(--tx-1)' }}>{fmt(selectedReq.created_at)}</span>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:3 }}>Due</label>
                <span style={{ fontSize:13, color: isOverdue(selectedReq.due_date) ? '#ef4444' : 'var(--tx-1)', fontWeight: isOverdue(selectedReq.due_date) ? 600 : 400 }}>{fmt(selectedReq.due_date)}</span>
              </div>
            </div>
            {/* Description */}
            {selectedReq.description && (
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Description</label>
                <p style={{ margin:0, fontSize:12.5, color:'var(--tx-2)', lineHeight:1.6, background:'var(--bg-elevated)', padding:'10px 12px', borderRadius:7 }}>{selectedReq.description}</p>
              </div>
            )}
            {/* Activity */}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:16 }}>
              <h4 style={{ margin:'0 0 12px', fontSize:12, fontWeight:600, color:'var(--tx-1)' }}>Activity</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { author:'Jordan Kim',     time:'2 hours ago', text:'Moved to In Progress and assigned to team.' },
                  { author:'Vitto Pessanha', time:'1 day ago',   text:'Created this request and set priority to High.' },
                ].map((a,i) => (
                  <div key={i} style={{ padding:'8px 10px', background:'var(--bg-elevated)', borderRadius:7, borderLeft:'2px solid var(--border-hi)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--tx-1)' }}>{a.author}</span>
                      <span style={{ fontSize:11, color:'var(--tx-3)' }}>{a.time}</span>
                    </div>
                    <p style={{ margin:0, fontSize:12, color:'var(--tx-2)' }}>{a.text}</p>
                  </div>
                ))}
              </div>
              {/* Add comment */}
              <div style={{ marginTop:12, display:'flex', gap:8 }}>
                <input
                  className="input-field"
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && comment.trim()) { setComment(''); } }}
                  style={{ flex:1, fontSize:12 }}
                />
                <button className="btn-ghost btn-sm" onClick={() => { if (comment.trim()) setComment(''); }} disabled={!comment.trim()}>
                  <MessageSquare size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

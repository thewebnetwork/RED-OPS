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

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_REQUESTS = [
  { id:'RRG-00001', title:'Thompson RE — April Ad Creative',   client:'Thompson Realty',     service:'Video Editing',    priority:'Urgent', assignee:{ name:'Taryn Pessanha', avatar:'TP', color:'#a855f7' }, created_at:'2026-03-01', due_date:'2026-03-22', stage:'In Progress',    description:'Create 3 promotional videos for spring listing campaign.' },
  { id:'RRG-00002', title:'Dani K. Blog Post Series',          client:'Dani K. Coaching',    service:'Copywriting',      priority:'High',   assignee:{ name:'Sarah Chen',     avatar:'SC', color:'#22c55e' }, created_at:'2026-03-05', due_date:'2026-03-28', stage:'Pending Review', description:'5 long-form blog posts about wellness and transformation.' },
  { id:'RRG-00003', title:'Riverside Realty Social Pack',      client:'Riverside Realty',    service:'Graphic Design',   priority:'High',   assignee:{ name:'Marcus Obi',     avatar:'MO', color:'#f59e0b' }, created_at:'2026-03-08', due_date:'2026-03-30', stage:'Assigned',       description:'Design 20 social media graphics for the monthly campaign.' },
  { id:'RRG-00004', title:'Metro Bank Email Nurture',          client:'Metro Financial',     service:'Email Sequence',   priority:'Normal', assignee:{ name:'Jordan Kim',     avatar:'JK', color:'#3b82f6' }, created_at:'2026-03-10', due_date:'2026-04-05', stage:'Submitted',      description:'8-email nurture sequence for new account holders onboarding.' },
  { id:'RRG-00005', title:'Verde Cafe Meta Ads Q2',            client:'Verde Cafe',          service:'Meta Ads Setup',   priority:'High',   assignee:{ name:'Lucca Rossini',  avatar:'LR', color:'#3b82f6' }, created_at:'2026-03-03', due_date:'2026-03-26', stage:'In Progress',    description:'Full Meta Ads campaign setup and optimization for Q2 growth.' },
  { id:'RRG-00006', title:'Coastal Living Feature Video',      client:'Coastal Living Mag',  service:'Video Editing',    priority:'Urgent', assignee:{ name:'Taryn Pessanha', avatar:'TP', color:'#a855f7' }, created_at:'2026-03-15', due_date:'2026-03-21', stage:'Revision',       description:'Edit and color grade 2-minute feature video — needs revised intro.' },
  { id:'RRG-00007', title:'Bright Futures Landing Page Copy',  client:'Bright Futures',      service:'Copywriting',      priority:'Normal', assignee:{ name:'Sarah Chen',     avatar:'SC', color:'#22c55e' }, created_at:'2026-02-28', due_date:'2026-03-31', stage:'Delivered',      description:'Landing page copy focused on spring enrollment campaign.' },
  { id:'RRG-00008', title:'Luxury Spa Brand Guidelines',       client:'Serenity Spa',        service:'Graphic Design',   priority:'High',   assignee:{ name:'Marcus Obi',     avatar:'MO', color:'#f59e0b' }, created_at:'2026-03-02', due_date:'2026-04-10', stage:'In Progress',    description:'Full brand guidelines, colour system and typography spec.' },
  { id:'RRG-00009', title:'Summit Events Social Calendar',     client:'Summit Events',       service:'Social Media Pack',priority:'Low',    assignee:{ name:'Jordan Kim',     avatar:'JK', color:'#3b82f6' }, created_at:'2026-03-09', due_date:'2026-04-15', stage:'Assigned',       description:'30 social media posts for the April content calendar.' },
  { id:'RRG-00010', title:'TechStart Pitch Deck Redesign',     client:'TechStart Ventures',  service:'Graphic Design',   priority:'Normal', assignee:{ name:'Marcus Obi',     avatar:'MO', color:'#f59e0b' }, created_at:'2026-03-12', due_date:'2026-03-29', stage:'Pending Review', description:'Redesign investor pitch deck with updated 2026 branding.' },
  { id:'RRG-00011', title:'Urban Bistro Website Copy',         client:'Urban Bistro',        service:'Copywriting',      priority:'Low',    assignee:{ name:'Sarah Chen',     avatar:'SC', color:'#22c55e' }, created_at:'2026-03-01', due_date:'2026-04-20', stage:'Closed',         description:'Rewrite website copy emphasising farm-to-table concept.' },
  { id:'RRG-00012', title:'Fitness Plus App Promo Video',      client:'Fitness Plus',        service:'Video Editing',    priority:'High',   assignee:{ name:'Taryn Pessanha', avatar:'TP', color:'#a855f7' }, created_at:'2026-03-17', due_date:'2026-04-02', stage:'Submitted',      description:'30-second promotional video for new app launch campaign.' },
  { id:'RRG-00013', title:'Green Energy Blog Series',          client:'Green Energy Co.',    service:'Copywriting',      priority:'Normal', assignee:{ name:'Sarah Chen',     avatar:'SC', color:'#22c55e' }, created_at:'2026-02-25', due_date:'2026-03-27', stage:'Delivered',      description:'4 in-depth blog posts on renewable energy for B2B audience.' },
  { id:'RRG-00014', title:'Apex Marketing Q2 Ads Creative',   client:'Apex Marketing',      service:'Graphic Design',   priority:'High',   assignee:{ name:'Marcus Obi',     avatar:'MO', color:'#f59e0b' }, created_at:'2026-03-18', due_date:'2026-04-01', stage:'Submitted',      description:'Full creative set for Q2 paid ad campaigns — 12 assets.' },
  { id:'RRG-00015', title:'Burnham Strategy Presentation',    client:'Burnham Capital',     service:'Graphic Design',   priority:'Urgent', assignee:{ name:'Marcus Obi',     avatar:'MO', color:'#f59e0b' }, created_at:'2026-03-19', due_date:'2026-03-24', stage:'In Progress',    description:'Investor presentation for Series A fundraise.' },
];

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

const SERVICES = ['Video Editing','Graphic Design','Copywriting','Social Media Pack','Meta Ads Setup','Email Sequence','Blog Post','Landing Page','Branding Package'];
const CLIENTS  = ['Thompson Realty','Dani K. Coaching','Riverside Realty','Metro Financial','Verde Cafe','Coastal Living Mag','Bright Futures','Serenity Spa','Summit Events','TechStart Ventures','Urban Bistro','Fitness Plus','Green Energy Co.','Apex Marketing','Burnham Capital'];

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
  const [requests,    setRequests]    = useState(MOCK_REQUESTS);
  const [view,        setView]        = useState('kanban');
  const [search,      setSearch]      = useState('');
  const [priFilter,   setPriFilter]   = useState('');
  const [showModal,   setShowModal]   = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [activeId,    setActiveId]    = useState(null);
  const [form, setForm] = useState({ title:'', client:'', service:'', priority:'Normal', due_date:'', description:'' });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setShowModal(true);
  }, []);

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

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Toolbar ── */}
      <div style={{ padding:'10px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexShrink:0, background:'var(--bg)' }}>
        <div>
          <span style={{ fontSize:18, fontWeight:700, color:'var(--tx-1)' }}>Requests</span>
          <span style={{ marginLeft:10, fontSize:12, color:'var(--tx-3)' }}>
            {filtered.length} total &bull; {open} open{overdue > 0 ? ' · ' : ''}{overdue > 0 && <span style={{ color:'#ef4444' }}>{overdue} overdue</span>}
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

        {view === 'kanban' ? (
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
                  {filtered.map(req => (
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
                  {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
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
                <input className="input-field" placeholder="Add a comment..." style={{ flex:1, fontSize:12 }} />
                <button className="btn-ghost btn-sm"><MessageSquare size={13} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

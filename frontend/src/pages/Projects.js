import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  FolderKanban, Plus, Calendar, Users, CheckSquare, ChevronRight,
  Circle, Clock, Folder, X, Edit3, Save, Trash2, CheckCircle2,
  ArrowRight, MoreHorizontal, AlertCircle, Target, BarChart3,
  Layers, FileText, Activity,
} from 'lucide-react';

// ── Config ───────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  'Campaign Build':     { color:'#a855f7', bg:'#a855f718' },
  'Client Onboarding':  { color:'#3b82f6', bg:'#3b82f618' },
  'Creative Sprint':    { color:'#22c55e', bg:'#22c55e18' },
  'Internal':           { color:'#606060', bg:'#60606018' },
};
const STATUS_CONFIG = {
  'Active':    { color:'#22c55e', icon: Circle },
  'Planning':  { color:'#f59e0b', icon: Clock },
  'Completed': { color:'#3b82f6', icon: CheckSquare },
  'On Hold':   { color:'#c92a3e', icon: AlertCircle },
};
const TEAM_MEMBERS = ['Vitto Pessanha','Taryn Pessanha','Jordan Kim','Lucca Rossini','Sarah Chen','Marcus Obi'];
const TYPE_OPTIONS = Object.keys(TYPE_CONFIG);
const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);
const CLIENT_OPTIONS = ['Thompson Real Estate','Riverside Realty Group','Apex Home Group','Dani K. Coaching','Burnham & Associates','Lakeside Homes Group','Summit Realty Calgary','Park Ave Properties'];

// ── Mock data ────────────────────────────────────────────────────────────────
const INITIAL_PROJECTS = [
  {
    id:1, name:'Thompson RE — April Campaign', type:'Campaign Build', client:'Thompson Real Estate',
    progress:65, status:'Active', dueDate:'2026-05-15', description:'Full campaign build — ad creative, landing page, email sequence, Meta Ads setup.',
    team:['Taryn Pessanha','Marcus Obi','Lucca Rossini'],
    milestones:[
      { id:'m1', label:'Creative brief approved', done:true },
      { id:'m2', label:'Ad creatives delivered',  done:true },
      { id:'m3', label:'Landing page live',       done:false },
      { id:'m4', label:'Ads launched',            done:false },
    ],
    tasks:[
      { id:'t1', title:'Design 3 static ad creatives',   status:'Done',        assignee:'Taryn Pessanha', due:'Mar 20' },
      { id:'t2', title:'Write ad copy variations (5x)',   status:'Done',        assignee:'Sarah Chen',     due:'Mar 21' },
      { id:'t3', title:'Build landing page in GHL',       status:'In Progress', assignee:'Lucca Rossini',  due:'Mar 28' },
      { id:'t4', title:'Set up Meta Ads campaign',        status:'Todo',        assignee:'Lucca Rossini',  due:'Apr 2' },
      { id:'t5', title:'Write email nurture sequence',    status:'Todo',        assignee:'Sarah Chen',     due:'Apr 5' },
      { id:'t6', title:'QA full funnel end-to-end',       status:'Todo',        assignee:'Marcus Obi',     due:'Apr 10' },
    ],
  },
  {
    id:2, name:'Riverside Realty Onboarding', type:'Client Onboarding', client:'Riverside Realty Group',
    progress:40, status:'Active', dueDate:'2026-04-30', description:'16-step onboarding checklist — GHL setup, branding, first campaign launch.',
    team:['Jordan Kim','Lucca Rossini'],
    milestones:[
      { id:'m5', label:'Kickoff call completed',    done:true },
      { id:'m6', label:'GHL pipeline configured',   done:true },
      { id:'m7', label:'First campaign live',        done:false },
      { id:'m8', label:'30-day check-in completed',  done:false },
    ],
    tasks:[
      { id:'t7',  title:'Kickoff call + asset collection',  status:'Done',        assignee:'Jordan Kim',    due:'Mar 10' },
      { id:'t8',  title:'Configure GHL pipeline & automations', status:'Done',    assignee:'Lucca Rossini', due:'Mar 14' },
      { id:'t9',  title:'Set up branded email templates',   status:'In Progress', assignee:'Lucca Rossini', due:'Mar 25' },
      { id:'t10', title:'Build first ad campaign',          status:'Todo',        assignee:'Jordan Kim',    due:'Apr 1' },
    ],
  },
  {
    id:3, name:'Apex Content Sprint — May', type:'Creative Sprint', client:'Apex Home Group',
    progress:10, status:'Planning', dueDate:'2026-05-31', description:'Monthly content batch — 8 social posts, 2 listing videos, 1 market update video.',
    team:['Marcus Obi','Taryn Pessanha'],
    milestones:[
      { id:'m9',  label:'Content calendar approved', done:true },
      { id:'m10', label:'All content delivered',     done:false },
    ],
    tasks:[
      { id:'t11', title:'Create content calendar for May',   status:'Done',  assignee:'Marcus Obi',     due:'Mar 22' },
      { id:'t12', title:'Shoot listing video — 123 Main St', status:'Todo',  assignee:'Marcus Obi',     due:'Apr 8' },
      { id:'t13', title:'Design 8 social post graphics',     status:'Todo',  assignee:'Taryn Pessanha', due:'Apr 15' },
      { id:'t14', title:'Record market update video',        status:'Todo',  assignee:'Marcus Obi',     due:'Apr 20' },
    ],
  },
  {
    id:4, name:'Dani K. Rebrand Package', type:'Campaign Build', client:'Dani K. Coaching',
    progress:90, status:'Active', dueDate:'2026-04-22', description:'Full rebrand — new logo suite, brand guidelines doc, social templates, website refresh.',
    team:['Taryn Pessanha','Sarah Chen'],
    milestones:[
      { id:'m11', label:'Logo concepts approved', done:true },
      { id:'m12', label:'Brand guide delivered',  done:true },
      { id:'m13', label:'Website refresh live',   done:false },
    ],
    tasks:[
      { id:'t15', title:'Design 3 logo concepts',      status:'Done',        assignee:'Taryn Pessanha', due:'Mar 5' },
      { id:'t16', title:'Create brand guidelines doc',  status:'Done',        assignee:'Taryn Pessanha', due:'Mar 15' },
      { id:'t17', title:'Design social media templates',status:'Done',        assignee:'Taryn Pessanha', due:'Mar 20' },
      { id:'t18', title:'Website colour/font refresh',  status:'In Progress', assignee:'Sarah Chen',     due:'Apr 1' },
    ],
  },
  {
    id:5, name:'Burnham Strategy Build', type:'Internal', client:'',
    progress:55, status:'Active', dueDate:'2026-05-10', description:'Internal strategy project — competitive analysis, positioning doc, pitch deck.',
    team:['Vitto Pessanha','Marcus Obi'],
    milestones:[
      { id:'m14', label:'Research complete',  done:true },
      { id:'m15', label:'Pitch deck delivered', done:false },
    ],
    tasks:[
      { id:'t19', title:'Competitive landscape research',  status:'Done',        assignee:'Marcus Obi',     due:'Mar 18' },
      { id:'t20', title:'Draft positioning document',      status:'In Progress', assignee:'Vitto Pessanha', due:'Mar 28' },
      { id:'t21', title:'Design pitch deck (20 slides)',   status:'Todo',        assignee:'Marcus Obi',     due:'Apr 5' },
    ],
  },
  {
    id:6, name:'RRM ISA Scripts Update', type:'Internal', client:'',
    progress:100, status:'Completed', dueDate:'2026-04-15', description:'Update all ISA scripts with new objection handling and qualification framework.',
    team:['Vitto Pessanha'],
    milestones:[
      { id:'m16', label:'Scripts rewritten',   done:true },
      { id:'m17', label:'Team trained on new scripts', done:true },
    ],
    tasks:[
      { id:'t22', title:'Audit existing ISA scripts',     status:'Done', assignee:'Vitto Pessanha', due:'Mar 10' },
      { id:'t23', title:'Rewrite objection handling',     status:'Done', assignee:'Vitto Pessanha', due:'Mar 15' },
      { id:'t24', title:'Record training walkthrough',    status:'Done', assignee:'Vitto Pessanha', due:'Mar 20' },
    ],
  },
  {
    id:7, name:'Riverside May Content Month', type:'Creative Sprint', client:'Riverside Realty Group',
    progress:0, status:'Planning', dueDate:'2026-05-31', description:'Monthly content package for May — social, video, blog.',
    team:['Taryn Pessanha'],
    milestones:[
      { id:'m18', label:'Brief approved', done:false },
      { id:'m19', label:'All assets delivered', done:false },
    ],
    tasks:[],
  },
  {
    id:8, name:'Team SOP Audit Q2', type:'Internal', client:'',
    progress:30, status:'Active', dueDate:'2026-05-20', description:'Review and update all team SOPs for Q2. Identify gaps and create missing documentation.',
    team:['Sarah Chen','Marcus Obi','Vitto Pessanha'],
    milestones:[
      { id:'m20', label:'Audit complete', done:true },
      { id:'m21', label:'All SOPs updated', done:false },
    ],
    tasks:[
      { id:'t25', title:'Audit existing SOPs — flag outdated',  status:'Done',        assignee:'Sarah Chen',   due:'Mar 15' },
      { id:'t26', title:'Rewrite client onboarding SOP',        status:'In Progress', assignee:'Sarah Chen',   due:'Mar 30' },
      { id:'t27', title:'Create ad campaign launch SOP',        status:'Todo',        assignee:'Marcus Obi',   due:'Apr 10' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const TASK_STATUS_COLORS = { 'Done':'#22c55e', 'In Progress':'#f59e0b', 'Todo':'#3b82f6', 'Blocked':'#ef4444' };

function TypePill({ type }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.Internal;
  return <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4, background:cfg.bg, color:cfg.color, textTransform:'uppercase', letterSpacing:'0.03em' }}>{type}</span>;
}

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Active;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:cfg.color }}>
      <cfg.icon size={11} /> {status}
    </span>
  );
}

function TaskStatusPill({ status }) {
  const c = TASK_STATUS_COLORS[status] || '#606060';
  return <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4, background:`${c}22`, color:c }}>{status}</span>;
}

const labelStyle = { fontSize:11, fontWeight:600, color:'var(--tx-3)', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' };

// ── New / Edit Modal ─────────────────────────────────────────────────────────
function ProjectModal({ project, onClose, onSave }) {
  const isEdit = !!project;
  const [form, setForm] = useState({
    name:        project?.name || '',
    type:        project?.type || '',
    client:      project?.client || '',
    dueDate:     project?.dueDate || '',
    status:      project?.status || 'Planning',
    description: project?.description || '',
    team:        project?.team || [],
  });
  const f = (k,v) => setForm(p => ({...p, [k]:v}));

  const toggleTeam = m => f('team', form.team.includes(m) ? form.team.filter(x=>x!==m) : [...form.team, m]);

  const handleSubmit = () => {
    if (!form.name.trim() || !form.type) { toast.error('Name and type are required.'); return; }
    onSave(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:520, maxHeight:'85vh', overflow:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:800, margin:0 }}>{isEdit ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)' }}><X size={16}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={labelStyle}>Project Name *</label>
            <input className="input-field" autoFocus placeholder="e.g. Thompson RE — April Campaign" value={form.name} onChange={e=>f('name',e.target.value)} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={labelStyle}>Type *</label>
              <select className="input-field" value={form.type} onChange={e=>f('type',e.target.value)}>
                <option value="">Select type…</option>
                {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="input-field" value={form.status} onChange={e=>f('status',e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {form.type !== 'Internal' && (
            <div>
              <label style={labelStyle}>Client</label>
              <select className="input-field" value={form.client} onChange={e=>f('client',e.target.value)}>
                <option value="">Select client…</option>
                {CLIENT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" className="input-field" value={form.dueDate} onChange={e=>f('dueDate',e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea className="input-field" rows={3} placeholder="What this project delivers…" value={form.description} onChange={e=>f('description',e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Team</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {TEAM_MEMBERS.map(m => (
                <button key={m} onClick={() => toggleTeam(m)}
                  style={{ padding:'5px 10px', borderRadius:5, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: form.team.includes(m) ? 'var(--red)' : 'var(--border)', background: form.team.includes(m) ? 'var(--red-bg)' : 'transparent', color: form.team.includes(m) ? 'var(--red)' : 'var(--tx-3)', transition:'all .1s' }}>
                  {m.split(' ').map(n=>n[0]).join('')} {m.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'Client Onboarding' && !isEdit && (
            <div style={{ padding:'10px 12px', background:'#3b82f618', border:'1px solid #3b82f630', borderRadius:8, fontSize:12, color:'#3b82f6', display:'flex', alignItems:'center', gap:8 }}>
              <CheckSquare size={13} /><span>Auto-generates 16-step onboarding checklist</span>
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="btn-ghost" style={{ flex:1 }} onClick={onClose}>Cancel</button>
            <button className="btn-primary" style={{ flex:2 }} onClick={handleSubmit}>
              {isEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────
function ProjectDetail({ project, onClose, onUpdate, onDelete }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const completedTasks = project.tasks.filter(t => t.status === 'Done').length;
  const completedMilestones = project.milestones.filter(m => m.done).length;

  const toggleMilestone = (mId) => {
    const updated = {
      ...project,
      milestones: project.milestones.map(m => m.id === mId ? { ...m, done: !m.done } : m),
    };
    onUpdate(updated);
  };

  const toggleTaskStatus = (tId) => {
    const updated = {
      ...project,
      tasks: project.tasks.map(t => {
        if (t.id !== tId) return t;
        return { ...t, status: t.status === 'Done' ? 'Todo' : 'Done' };
      }),
    };
    // Recalculate progress
    const done = updated.tasks.filter(t => t.status === 'Done').length;
    updated.progress = updated.tasks.length > 0 ? Math.round((done / updated.tasks.length) * 100) : 0;
    onUpdate(updated);
  };

  const tabs = [
    { id:'overview', label:'Overview', icon:BarChart3 },
    { id:'tasks',    label:`Tasks (${project.tasks.length})`, icon:CheckSquare },
    { id:'milestones', label:`Milestones (${project.milestones.length})`, icon:Target },
  ];

  return (
    <div style={{ width:480, borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto', background:'var(--bg-card)', animation:'slideRight 0.18s ease both' }}>

      {/* Header */}
      <div style={{ padding:'16px 18px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
              <TypePill type={project.type} />
              <StatusDot status={project.status} />
            </div>
            <h2 style={{ fontSize:15, fontWeight:800, margin:'0 0 4px', lineHeight:1.3 }}>{project.name}</h2>
            {project.client && (
              <div style={{ fontSize:12, color:'var(--tx-3)', display:'flex', alignItems:'center', gap:4 }}>
                <Folder size={11} /> {project.client}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:4 }}>
            <X size={15}/>
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:11, color:'var(--tx-3)' }}>{completedTasks}/{project.tasks.length} tasks</span>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--tx-1)' }}>{project.progress}%</span>
          </div>
          <div style={{ height:6, background:'var(--bg-elevated)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${project.progress}%`, background: project.progress === 100 ? '#22c55e' : 'var(--red)', borderRadius:3, transition:'width .3s' }} />
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--tx-3)' }}>
          <span><Calendar size={10} style={{ marginRight:3 }}/> Due {project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : '—'}</span>
          <span><Users size={10} style={{ marginRight:3 }}/> {project.team.length} members</span>
          <span><Target size={10} style={{ marginRight:3 }}/> {completedMilestones}/{project.milestones.length} milestones</span>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, marginTop:12, marginBottom:-1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1, padding:'6px 4px 8px', background:'transparent', border:'none', borderBottom: tab === t.id ? '2px solid var(--red)' : '2px solid transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all .12s' }}>
              <t.icon size={11} color={tab === t.id ? 'var(--red)' : 'var(--tx-3)'} />
              <span style={{ fontSize:11, fontWeight:600, color: tab === t.id ? 'var(--tx-1)' : 'var(--tx-3)' }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px' }}>

        {tab === 'overview' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Description */}
            {project.description && (
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Description</div>
                <div style={{ fontSize:12.5, color:'var(--tx-2)', lineHeight:1.6, background:'var(--bg-elevated)', padding:'10px 12px', borderRadius:8 }}>
                  {project.description}
                </div>
              </div>
            )}

            {/* Team */}
            <div>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--tx-3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>Team</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {project.team.map(m => (
                  <div key={m} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'var(--bg-elevated)', borderRadius:7 }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--red-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--red)', flexShrink:0 }}>
                      {m.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <span style={{ fontSize:12, color:'var(--tx-1)', fontWeight:500 }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'Progress',   value:`${project.progress}%`, color: project.progress === 100 ? '#22c55e' : 'var(--red)' },
                { label:'Tasks Done',  value:`${completedTasks}/${project.tasks.length}`, color:'#22c55e' },
                { label:'Milestones',  value:`${completedMilestones}/${project.milestones.length}`, color:'#a855f7' },
                { label:'Due Date',    value: project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}) : '—', color:'#06b6d4' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--bg-elevated)', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:'var(--tx-3)', marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', gap:4, color:'#ef4444', borderColor:'#ef444430' }}
                onClick={() => { onDelete(project.id); toast.success('Project deleted'); }}>
                <Trash2 size={11}/> Delete
              </button>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {project.tasks.length === 0 && (
              <div style={{ padding:'32px 16px', textAlign:'center', background:'var(--bg-elevated)', borderRadius:10 }}>
                <CheckSquare size={24} color="var(--tx-3)" style={{ marginBottom:8 }} />
                <p style={{ fontSize:13, color:'var(--tx-3)', margin:0 }}>No tasks yet.</p>
              </div>
            )}
            {project.tasks.map(t => (
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'var(--bg-elevated)', borderRadius:8, border:'1px solid var(--border)' }}>
                <button onClick={() => toggleTaskStatus(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color: t.status === 'Done' ? '#22c55e' : 'var(--tx-3)', padding:0, flexShrink:0, display:'flex' }}>
                  {t.status === 'Done' ? <CheckCircle2 size={16}/> : <Circle size={16}/>}
                </button>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:500, color: t.status === 'Done' ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: t.status === 'Done' ? 'line-through' : 'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:2, display:'flex', gap:8 }}>
                    <span>{t.assignee}</span>
                    <span>Due: {t.due}</span>
                  </div>
                </div>
                <TaskStatusPill status={t.status} />
              </div>
            ))}
          </div>
        )}

        {tab === 'milestones' && (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {project.milestones.map((m, i) => (
              <div key={m.id} style={{ display:'flex', gap:12, paddingBottom:16, position:'relative' }}>
                {i < project.milestones.length - 1 && (
                  <div style={{ position:'absolute', left:11, top:24, bottom:0, width:2, background: m.done ? '#22c55e30' : 'var(--border)' }} />
                )}
                <button onClick={() => toggleMilestone(m.id)}
                  style={{ width:24, height:24, borderRadius:'50%', border: m.done ? 'none' : '2px solid var(--border)', background: m.done ? '#22c55e' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, position:'relative', zIndex:1, transition:'all .15s' }}>
                  {m.done && <CheckCircle2 size={14} color="#fff" />}
                </button>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color: m.done ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: m.done ? 'line-through' : 'none' }}>
                    {m.label}
                  </div>
                  <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:2 }}>
                    {m.done ? 'Completed' : 'Pending'}
                  </div>
                </div>
              </div>
            ))}
            {project.milestones.length === 0 && (
              <div style={{ padding:'32px 16px', textAlign:'center', background:'var(--bg-elevated)', borderRadius:10 }}>
                <Target size={24} color="var(--tx-3)" style={{ marginBottom:8 }} />
                <p style={{ fontSize:13, color:'var(--tx-3)', margin:0 }}>No milestones set.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function Projects() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  const [filter, setFilter]     = useState('All');
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState(null);
  const [modal, setModal]       = useState(null); // null | 'new' | project
  const showNewOnLoad = searchParams.get('new') === '1';

  useState(() => { if (showNewOnLoad) setModal('new'); });

  const filtered = useMemo(() => {
    return projects
      .filter(p => filter === 'All' || p.type === filter)
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.client||'').toLowerCase().includes(search.toLowerCase()));
  }, [filter, search, projects]);

  const selProject = selected ? projects.find(p => p.id === selected) : null;

  const handleSave = (form) => {
    if (modal && typeof modal === 'object' && modal.id) {
      // Edit
      setProjects(prev => prev.map(p => p.id === modal.id ? { ...p, ...form } : p));
      toast.success('Project updated');
    } else {
      // Create
      const newP = {
        id: Date.now(),
        ...form,
        progress: 0,
        milestones: form.type === 'Client Onboarding' ? [
          { id:`m${Date.now()}a`, label:'Kickoff call completed', done:false },
          { id:`m${Date.now()}b`, label:'GHL pipeline configured', done:false },
          { id:`m${Date.now()}c`, label:'First campaign live', done:false },
          { id:`m${Date.now()}d`, label:'30-day check-in completed', done:false },
        ] : [],
        tasks: form.type === 'Client Onboarding' ? [
          { id:`t${Date.now()}a`, title:'Kickoff call + asset collection', status:'Todo', assignee:form.team[0]||'Unassigned', due:'TBD' },
          { id:`t${Date.now()}b`, title:'Configure GHL pipeline & automations', status:'Todo', assignee:form.team[0]||'Unassigned', due:'TBD' },
          { id:`t${Date.now()}c`, title:'Set up branded email templates', status:'Todo', assignee:form.team[0]||'Unassigned', due:'TBD' },
          { id:`t${Date.now()}d`, title:'Build first ad campaign', status:'Todo', assignee:form.team[0]||'Unassigned', due:'TBD' },
        ] : [],
      };
      setProjects(prev => [...prev, newP]);
      setSelected(newP.id);
      toast.success(`${form.name} created`);
    }
  };

  const handleUpdate = (updated) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleDelete = (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setSelected(null);
  };

  const formatDate = d => d ? new Date(d).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : '—';

  const daysLeft = d => {
    if (!d) return 999;
    return Math.ceil((new Date(d) - new Date()) / (1000*60*60*24));
  };

  // Stats
  const activeCount = projects.filter(p=>p.status==='Active').length;
  const planningCount = projects.filter(p=>p.status==='Planning').length;
  const completedCount = projects.filter(p=>p.status==='Completed').length;
  const totalTasks = projects.reduce((s,p)=>s+p.tasks.length,0);
  const doneTasks = projects.reduce((s,p)=>s+p.tasks.filter(t=>t.status==='Done').length,0);

  return (
    <div className="page-fill" style={{ flexDirection:'row' }}>

      {modal && (
        <ProjectModal
          project={typeof modal === 'object' ? modal : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <h1 style={{ fontSize:17, fontWeight:800, letterSpacing:'-.03em', margin:0 }}>Projects</h1>
          <span style={{ fontSize:12, color:'var(--tx-3)', padding:'2px 8px', background:'var(--bg-elevated)', borderRadius:10 }}>{filtered.length}</span>
          <div style={{ flex:1 }}/>
          <div style={{ position:'relative' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects…"
              style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, padding:'6px 10px', fontSize:12.5, color:'var(--tx-1)', outline:'none', width:180 }} />
          </div>
          <button onClick={() => setModal('new')} className="btn-primary btn-sm" style={{ gap:5 }}>
            <Plus size={13}/> New Project
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ display:'flex', gap:0, padding:'8px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {[
            { label:'Active',    value:activeCount,    color:'#22c55e' },
            { label:'Planning',  value:planningCount,  color:'#f59e0b' },
            { label:'Completed', value:completedCount, color:'#3b82f6' },
            { label:'Tasks Done',value:`${doneTasks}/${totalTasks}`, color:'var(--tx-1)' },
          ].map((m,i) => (
            <div key={i} style={{ paddingRight:20, marginRight:20, borderRight:i<3?'1px solid var(--border)':'none' }}>
              <div style={{ fontSize:15, fontWeight:700, color:m.color }}>{m.value}</div>
              <div style={{ fontSize:10.5, color:'var(--tx-3)', marginTop:1 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:4, padding:'8px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          {['All', ...TYPE_OPTIONS].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'4px 10px', borderRadius:5, fontSize:11, fontWeight:600, cursor:'pointer', border:'1px solid', borderColor: filter===f ? 'var(--red)' : 'var(--border)', background: filter===f ? 'var(--red-bg)' : 'transparent', color: filter===f ? 'var(--red)' : 'var(--tx-3)', transition:'all .1s' }}>
              {f}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex:1, overflowY:'auto', padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px,1fr))', gap:14, alignContent:'start' }}>
          {filtered.map(p => {
            const cfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.Internal;
            const sCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.Active;
            const dl = daysLeft(p.dueDate);
            const isSelected = selected === p.id;
            const completedT = p.tasks.filter(t=>t.status==='Done').length;

            return (
              <div key={p.id} onClick={() => setSelected(isSelected ? null : p.id)}
                className="card" style={{ padding:'16px 18px', cursor:'pointer', borderColor: isSelected ? 'var(--red)' : undefined, transition:'all .12s' }}>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <TypePill type={p.type} />
                    <StatusDot status={p.status} />
                  </div>
                  <button onClick={e => { e.stopPropagation(); setModal(p); }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--tx-3)', padding:2 }}>
                    <Edit3 size={12} />
                  </button>
                </div>

                <h3 style={{ fontSize:14, fontWeight:700, color:'var(--tx-1)', margin:'0 0 4px', lineHeight:1.3 }}>{p.name}</h3>
                {p.client && (
                  <div style={{ fontSize:11.5, color:'var(--tx-3)', display:'flex', alignItems:'center', gap:4, marginBottom:10 }}>
                    <Folder size={10} /> {p.client}
                  </div>
                )}

                {/* Progress */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:11, color:'var(--tx-3)' }}>{completedT}/{p.tasks.length} tasks</span>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--tx-1)' }}>{p.progress}%</span>
                  </div>
                  <div style={{ height:5, background:'var(--bg-elevated)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${p.progress}%`, background: p.progress === 100 ? '#22c55e' : 'var(--red)', borderRadius:3, transition:'width .3s' }} />
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', gap:-4 }}>
                    {p.team.slice(0,3).map((m,i) => (
                      <div key={m} style={{ width:24, height:24, borderRadius:'50%', background:'var(--bg-elevated)', border:'2px solid var(--bg-card)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'var(--tx-1)', marginLeft: i > 0 ? -6 : 0, zIndex:3-i, position:'relative' }} title={m}>
                        {m.split(' ').map(n=>n[0]).join('')}
                      </div>
                    ))}
                    {p.team.length > 3 && <span style={{ fontSize:10, color:'var(--tx-3)', marginLeft:4 }}>+{p.team.length-3}</span>}
                  </div>
                  <span style={{ fontSize:11, color: dl <= 7 ? '#ef4444' : dl <= 14 ? '#f59e0b' : 'var(--tx-3)', fontWeight: dl <= 14 ? 600 : 400, display:'flex', alignItems:'center', gap:4 }}>
                    <Calendar size={10} /> {formatDate(p.dueDate)}
                    {dl <= 14 && dl > 0 && <span>({dl}d)</span>}
                    {dl <= 0 && <span style={{ color:'#ef4444' }}>Overdue</span>}
                  </span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn:'1/-1', padding:'60px 20px', textAlign:'center' }}>
              <FolderKanban size={32} color="var(--tx-3)" style={{ marginBottom:12 }} />
              <p style={{ fontSize:14, color:'var(--tx-3)' }}>No projects match your filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selProject && (
        <ProjectDetail
          project={selProject}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

/**
 * TeamMemberPage — Full member profile page (like ProjectPage)
 *
 * Tabs:
 *   • Overview — info, stats, workload, recent activity
 *   • Tasks — all tasks assigned to this member
 *   • Files — contracts, documents uploaded for this member
 *   • SOPs — linked knowledge base articles
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Edit2, Mail, Shield, Activity, Circle,
  CheckSquare, FolderKanban, BarChart2, Calendar, Clock, Star,
  Users, Upload, FileText, BookOpen, Link2, Plus, X, Trash2,
  Download, File, Image, Loader2, AlertCircle, CheckCircle2,
  Briefcase, UserCheck, UserX,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');
const ax = () => axios.create({ headers: { Authorization: `Bearer ${tok()}` } });

const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
const AVATAR_COLORS = ['#c92a3e','#7c3aed','#2563eb','#059669','#d97706','#0891b2','#db2777','#65a30d'];
const avatarBg = (id) => AVATAR_COLORS[(typeof id === 'string' ? id.charCodeAt(0) + (id.charCodeAt(1) || 0) : id) % AVATAR_COLORS.length];
const capColor = (p) => p < 50 ? 'var(--green)' : p < 80 ? 'var(--yellow)' : 'var(--red)';
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

const ROLE_ICONS = {
  'Administrator': <Shield size={13} style={{ color: 'var(--red)' }} />,
  'Operator': <Activity size={13} style={{ color: 'var(--accent)' }} />,
  'Standard User': <Circle size={13} style={{ color: 'var(--tx-3)' }} />,
};

const TASK_STATUS_CONFIG = {
  backlog: { label: 'Backlog', color: '#606060' },
  todo: { label: 'To Do', color: '#3b82f6' },
  open: { label: 'To Do', color: '#3b82f6' },
  assigned: { label: 'Assigned', color: '#3b82f6' },
  doing: { label: 'In Progress', color: '#f59e0b' },
  review: { label: 'In Review', color: '#a855f7' },
  revision: { label: 'Revision', color: '#f59e0b' },
  done: { label: 'Done', color: '#22c55e' },
  completed: { label: 'Done', color: '#22c55e' },
  delivered: { label: 'Delivered', color: '#22c55e' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: '#ef4444' },
  high: { label: 'High', color: '#f59e0b' },
  medium: { label: 'Medium', color: '#3b82f6' },
  low: { label: 'Low', color: '#606060' },
};

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' };

function humanSize(bytes) {
  if (!bytes) return '—';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let s = bytes;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return `${s.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function fileIcon(ct, size = 16) {
  if (!ct) return <File size={size} />;
  if (ct.startsWith('image/')) return <Image size={size} style={{ color: 'var(--purple)' }} />;
  if (ct.includes('pdf')) return <FileText size={size} style={{ color: 'var(--red)' }} />;
  return <File size={size} style={{ color: 'var(--tx-3)' }} />;
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function TeamMemberPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  // Stats
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [sops, setSops] = useState([]);
  const [linkedSops, setLinkedSops] = useState([]);
  const [team, setTeam] = useState(null);

  const fetchMember = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/users/${id}`);
      const u = r.data;
      setMember(u);
      // Load team info
      if (u.team_id) {
        try {
          const tr = await ax().get(`${API}/teams/${u.team_id}`);
          setTeam(tr.data);
        } catch { /* no team */ }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('Member not found');
        navigate('/team');
      } else {
        toast.error('Failed to load member');
      }
    } finally { setLoading(false); }
  }, [id, navigate]);

  const fetchTasks = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/tasks`);
      const all = r.data?.data || r.data || [];
      setTasks(all.filter(t => (t.assignee_user_id || t.assignee_id) === id));
    } catch { /* ignore */ }
  }, [id]);

  const fetchFiles = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/files`, { params: { context_type: 'member', context_id: id } });
      setFiles(r.data || []);
    } catch { setFiles([]); }
  }, [id]);

  const fetchSops = useCallback(async () => {
    try {
      const r = await ax().get(`${API}/knowledge-base`);
      setSops(r.data?.data || r.data || []);
    } catch { setSops([]); }
  }, []);

  useEffect(() => { fetchMember(); }, [fetchMember]);
  useEffect(() => { fetchTasks(); fetchFiles(); fetchSops(); }, [fetchTasks, fetchFiles, fetchSops]);

  // Linked SOPs stored as a simple array in localStorage per member
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`member_sops_${id}`) || '[]');
      setLinkedSops(saved);
    } catch { setLinkedSops([]); }
  }, [id]);

  const saveSopLinks = (links) => {
    setLinkedSops(links);
    localStorage.setItem(`member_sops_${id}`, JSON.stringify(links));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={24} className="spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    );
  }

  if (!member) return null;

  const specialty = member.specialty ? (Array.isArray(member.specialty) ? member.specialty : [member.specialty]) : [];
  const maxTasks = member.maxTasks || member.max_tasks || 15;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const tasksThisWeek = tasks.filter(t => new Date(t.created_at || t.createdAt || 0) >= weekAgo).length;
  const completedMonth = tasks.filter(t => ['done', 'completed', 'delivered'].includes(t.status) && new Date(t.updated_at || t.updatedAt || 0) >= monthStart).length;
  const openTasks = tasks.filter(t => !['done', 'completed', 'delivered'].includes(t.status)).length;
  const utilization = pct(tasksThisWeek, maxTasks);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart2 },
    { id: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckSquare },
    { id: 'files', label: `Files (${files.length})`, icon: FileText },
    { id: 'sops', label: `SOPs (${linkedSops.length})`, icon: BookOpen },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <button onClick={() => navigate('/team')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-3)', padding: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <ArrowLeft size={13} /> Team
          </button>
          <ChevronRight size={10} color="var(--tx-3)" />
          <span style={{ fontSize: 12, color: 'var(--tx-1)', fontWeight: 600 }}>{member.name}</span>
        </div>

        {/* Profile header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: avatarBg(member.id), display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 18,
          }}>{initials(member.name)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--tx-1)', letterSpacing: '-.03em' }}>{member.name}</h1>
              {member.active === false && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(201,42,62,.12)', color: 'var(--red)', fontWeight: 600 }}>Inactive</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tx-2)' }}>
              {ROLE_ICONS[member.role]} {member.role}
              {team && (<><span style={{ color: 'var(--tx-3)' }}>·</span><span style={{ color: team.color || 'var(--accent)' }}>{team.name}</span></>)}
              {member.email && (<><span style={{ color: 'var(--tx-3)' }}>·</span><Mail size={11} /> {member.email}</>)}
            </div>
            {specialty.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {specialty.map((s, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--tx-2)' }}>{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, fontSize: 11, color: 'var(--tx-3)' }}>
          <span><CheckSquare size={10} style={{ marginRight: 3 }} /> {completedMonth} done this month</span>
          <span><FolderKanban size={10} style={{ marginRight: 3 }} /> {openTasks} open</span>
          <span style={{ color: capColor(utilization) }}>
            <Activity size={10} style={{ marginRight: 3 }} /> {utilization}% capacity ({tasksThisWeek}/{maxTasks})
          </span>
          <span><FileText size={10} style={{ marginRight: 3 }} /> {files.length} files</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  color: active ? 'var(--tx-1)' : 'var(--tx-3)',
                  fontSize: 12, fontWeight: active ? 600 : 500,
                }}>
                <t.icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0' }}>
        {tab === 'overview' && (
          <OverviewTab member={member} team={team} tasks={tasks} files={files}
            tasksThisWeek={tasksThisWeek} completedMonth={completedMonth}
            openTasks={openTasks} utilization={utilization} maxTasks={maxTasks}
            specialty={specialty} />
        )}
        {tab === 'tasks' && (
          <TasksTab tasks={tasks} onRefresh={fetchTasks} />
        )}
        {tab === 'files' && (
          <FilesTab memberId={id} files={files} onRefresh={fetchFiles} />
        )}
        {tab === 'sops' && (
          <SOPsTab sops={sops} linkedSops={linkedSops} onSave={saveSopLinks} />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   OVERVIEW TAB
   ═══════════════════════════════════════════════════════════ */
function OverviewTab({ member, team, tasks, files, tasksThisWeek, completedMonth, openTasks, utilization, maxTasks, specialty }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Capacity', value: `${utilization}%`, color: capColor(utilization), icon: Activity },
          { label: 'Done/mo', value: completedMonth, color: '#22c55e', icon: CheckSquare },
          { label: 'Open Tasks', value: openTasks, color: '#3b82f6', icon: FolderKanban },
          { label: 'Files', value: files.length, color: '#a855f7', icon: FileText },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <s.icon size={14} color={s.color} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Workload bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)' }}>Weekly Workload</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: capColor(utilization) }}>{tasksThisWeek} / {maxTasks}</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: 'var(--bg)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 5, width: `${Math.min(utilization, 100)}%`, background: capColor(utilization), transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Info table */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 10 }}>Details</h3>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {[
            { label: 'Role', value: member.role },
            { label: 'Account Type', value: member.account_type || '—' },
            { label: 'Team', value: team?.name || 'Unassigned' },
            { label: 'Email', value: member.email || '—' },
            { label: 'Status', value: member.active !== false ? 'Active' : 'Inactive', color: member.active !== false ? 'var(--green)' : 'var(--red)' },
          ].map((row, i) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'var(--tx-3)' }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: row.color || 'var(--tx-1)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent tasks */}
      {tasks.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 10 }}>Recent Tasks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {tasks.slice(0, 8).map(t => {
              const stCfg = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.todo;
              return (
                <div key={t.id || t._id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: stCfg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--tx-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title || t.name || 'Untitled'}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${stCfg.color}22`, color: stCfg.color, fontWeight: 600 }}>
                    {stCfg.label}
                  </span>
                  {t.due_at && (
                    <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>
                      <Calendar size={9} style={{ marginRight: 2 }} />
                      {new Date(t.due_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TASKS TAB
   ═══════════════════════════════════════════════════════════ */
function TasksTab({ tasks, onRefresh }) {
  const [filter, setFilter] = useState('all');

  const toggleDone = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await ax().patch(`${API}/tasks/${task.id || task._id}`, { status: newStatus });
      onRefresh();
    } catch { toast.error('Failed to update'); }
  };

  const doneCount = tasks.filter(t => ['done', 'completed', 'delivered'].includes(t.status)).length;
  const filtered = filter === 'all' ? tasks
    : filter === 'active' ? tasks.filter(t => !['done', 'completed', 'delivered'].includes(t.status))
    : tasks.filter(t => ['done', 'completed', 'delivered'].includes(t.status));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: 'var(--tx-1)' }}>Assigned Tasks</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>{doneCount}/{tasks.length} completed</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${tasks.length})` },
          { key: 'active', label: `Active (${tasks.length - doneCount})` },
          { key: 'done', label: `Done (${doneCount})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === f.key ? 'rgba(99,102,241,.1)' : 'transparent',
              color: filter === f.key ? 'var(--accent)' : 'var(--tx-3)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--tx-3)' }}>
          <CheckSquare size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-2)' }}>No tasks {filter !== 'all' ? 'matching this filter' : 'assigned'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map(t => {
            const isDone = ['done', 'completed', 'delivered'].includes(t.status);
            const stCfg = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.todo;
            const prCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.medium;
            return (
              <div key={t.id || t._id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
              }}>
                <button onClick={() => toggleDone(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDone ? '#22c55e' : 'var(--tx-3)', padding: 0, flexShrink: 0, display: 'flex' }}>
                  {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? 'var(--tx-3)' : 'var(--tx-1)', textDecoration: isDone ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title || t.name}
                  </div>
                  {t.due_at && (
                    <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>
                      <Calendar size={9} style={{ marginRight: 2 }} />
                      {new Date(t.due_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${prCfg.color}22`, color: prCfg.color }}>{prCfg.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${stCfg.color}22`, color: stCfg.color }}>{stCfg.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FILES TAB (contracts, docs uploaded for this member)
   ═══════════════════════════════════════════════════════════ */
function FilesTab({ memberId, files, onRefresh }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (fileList) => {
    if (!fileList?.length) return;
    setUploading(true);
    try {
      for (const f of fileList) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('context_type', 'member');
        fd.append('context_id', memberId);
        await ax().post(`${API}/files/upload`, fd);
      }
      toast.success('Uploaded');
      onRefresh();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const downloadFile = async (file) => {
    try {
      const { data } = await ax().get(`${API}/files/${file.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = file.original_filename || file.label; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Download failed'); }
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      await ax().delete(`${API}/files/${fileId}`);
      toast.success('Deleted');
      onRefresh();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: 'var(--tx-1)' }}>Files & Contracts</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Upload contracts, agreements, and documents for this member</p>
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
          background: 'var(--accent)', color: '#fff', borderRadius: 8,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Upload size={13} /> Upload
          <input type="file" multiple style={{ display: 'none' }} onChange={e => handleUpload(Array.from(e.target.files))} />
        </label>
      </div>

      {uploading && (
        <div style={{ padding: '10px 14px', background: 'var(--card)', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)' }}>
          <Loader2 size={14} className="spin" style={{ color: 'var(--tx-3)' }} />
          <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>Uploading…</span>
        </div>
      )}

      {files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--card)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <FileText size={32} style={{ color: 'var(--tx-3)', marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-2)', margin: '0 0 4px' }}>No files yet</p>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Upload contracts, NDAs, or any documents for this member</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
            }}>
              {fileIcon(f.content_type)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.label || f.original_filename}
                </div>
                <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>
                  {humanSize(f.file_size)} · {new Date(f.created_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <button onClick={() => downloadFile(f)} style={iconBtn} title="Download"><Download size={14} /></button>
              <button onClick={() => deleteFile(f.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Delete"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SOPS TAB (link knowledge base articles)
   ═══════════════════════════════════════════════════════════ */
function SOPsTab({ sops, linkedSops, onSave }) {
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const linked = sops.filter(s => linkedSops.includes(s.id || s._id));
  const available = sops.filter(s => !linkedSops.includes(s.id || s._id));
  const searched = search ? available.filter(s => (s.title || '').toLowerCase().includes(search.toLowerCase())) : available;

  const linkSop = (sopId) => {
    onSave([...linkedSops, sopId]);
  };

  const unlinkSop = (sopId) => {
    onSave(linkedSops.filter(id => id !== sopId));
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 2px', color: 'var(--tx-1)' }}>Linked SOPs</h3>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Knowledge base articles relevant to this team member's role</p>
        </div>
        <button onClick={() => setShowPicker(true)} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
          background: 'var(--accent)', color: '#fff', borderRadius: 8, border: 'none',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Link2 size={13} /> Link SOP
        </button>
      </div>

      {linked.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--card)', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <BookOpen size={32} style={{ color: 'var(--tx-3)', marginBottom: 8, opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx-2)', margin: '0 0 4px' }}>No SOPs linked</p>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: 0 }}>Link relevant SOPs from the knowledge base for this member</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {linked.map(s => (
            <div key={s.id || s._id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
            }}>
              <BookOpen size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </div>
                {s.category && <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>{s.category}</div>}
              </div>
              <button onClick={() => unlinkSop(s.id || s._id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Unlink">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SOP Picker Modal */}
      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShowPicker(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14,
            padding: 0, width: 440, maxHeight: '70vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 12px 40px rgba(0,0,0,.4)',
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx-1)' }}>Link a SOP</span>
              <button onClick={() => setShowPicker(false)} style={iconBtn}><X size={16} /></button>
            </div>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SOPs…"
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 400, padding: '8px 0' }}>
              {searched.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>
                  {available.length === 0 ? 'All SOPs are already linked' : 'No SOPs match your search'}
                </div>
              ) : (
                searched.map(s => (
                  <button key={s.id || s._id} onClick={() => { linkSop(s.id || s._id); setShowPicker(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 18px',
                      background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <BookOpen size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx-1)' }}>{s.title}</div>
                      {s.category && <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 2 }}>{s.category}</div>}
                    </div>
                    <Plus size={14} style={{ color: 'var(--accent)' }} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
  background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, color: 'var(--tx-3)',
};

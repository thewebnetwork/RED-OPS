import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, MoreHorizontal, Mail, X, Edit2, Trash2,
  Star, Clock, CheckSquare, BarChart2, UserPlus, Shield, Eye,
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const getToken = () => localStorage.getItem('token');
const headers = () => ({ Authorization: `Bearer ${getToken()}` });

/* ── tiny helpers ─────────────────────────────────────────── */
const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
const AVATAR_COLORS = ['#c92a3e','#7c3aed','#2563eb','#059669','#d97706'];
const avatarBg = (id) => AVATAR_COLORS[(typeof id === 'string' ? id.charCodeAt(0) : id) % AVATAR_COLORS.length];
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const pctColor = (p) => p < 50 ? 'var(--green)' : p < 80 ? 'var(--yellow)' : 'var(--red)';

const ROLES = ['Administrator', 'Operator', 'Standard User'];
const ACCOUNT_TYPES = ['Internal Staff', 'Partner', 'Media Client', 'Vendor/Freelancer'];

/* ══════════════════════════════════════════════════════════════
   ADD MEMBER MODAL
   ══════════════════════════════════════════════════════════════ */
const AddMemberModal = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Operator', account_type: 'Internal Staff' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email are required'); return; }
    if (!form.password || form.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/users`, {
        ...form,
        force_password_change: true,
        force_otp_setup: false,
        send_welcome_email: false,
      }, { headers: headers() });
      toast.success(`${form.name} added to the team`);
      setForm({ name: '', email: '', password: '', role: 'Operator', account_type: 'Internal Staff' });
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add member');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={20} /> Add Team Member</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <div>
            <label className="input-label">Full Name *</label>
            <input className="input" placeholder="e.g. Taryn Pessanha" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
          <div>
            <label className="input-label">Email *</label>
            <input className="input" type="email" placeholder="taryn@company.com" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="input-label">Temporary Password *</label>
            <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={e => set('password', e.target.value)} />
            <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 4 }}>They'll be asked to change this on first login.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="input-label">Role</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Account Type</label>
              <select className="input" value={form.account_type} onChange={e => set('account_type', e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   EDIT MEMBER MODAL
   ══════════════════════════════════════════════════════════════ */
const EditMemberModal = ({ member, open, onClose, onUpdated }) => {
  const [form, setForm] = useState({ name: '', role: '', account_type: '', active: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (member) setForm({ name: member.name, role: member.role, account_type: member.account_type || 'Internal Staff', active: member.active !== false });
  }, [member]);

  if (!open || !member) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.patch(`${API}/users/${member.id}`, form, { headers: headers() });
      toast.success(`${form.name} updated`);
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update member');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Edit2 size={18} /> Edit Member</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <div>
            <label className="input-label">Name</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="input-label">Role</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Account Type</label>
              <select className="input" value={form.account_type} onChange={e => set('account_type', e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="active-toggle" checked={form.active} onChange={e => set('active', e.target.checked)} />
            <label htmlFor="active-toggle" style={{ fontSize: 14 }}>Active account</label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MEMBER DETAIL PANEL (slide-in)
   ══════════════════════════════════════════════════════════════ */
const MemberDetailPanel = ({ member, open, onClose, onEdit }) => {
  if (!open || !member) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 400, maxWidth: '90vw',
        background: 'var(--card)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'auto', zIndex: 100,
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18 }}>Member Profile</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Avatar + Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: avatarBg(member.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20 }}>
              {initials(member.name)}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{member.name}</h3>
              <p style={{ margin: 0, color: 'var(--tx-2)', fontSize: 14 }}>{member.role}</p>
              {member.email && <p style={{ margin: '4px 0 0', color: 'var(--tx-3)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {member.email}</p>}
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              { label: 'Tasks/week', value: member.tasksThisWeek, icon: <CheckSquare size={14} /> },
              { label: 'Done/mo', value: member.tasksCompletedMonth, icon: <Clock size={14} /> },
              { label: 'Rating', value: member.satisfactionScore, icon: <Star size={14} /> },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ color: 'var(--tx-3)', marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 18 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--tx-3)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Info fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--tx-2)', fontSize: 13 }}>Account Type</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{member.account_type || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--tx-2)', fontSize: 13 }}>Status</span>
              <span className="pill pill-green" style={{ fontSize: 12 }}>{member.active !== false ? 'Active' : 'Inactive'}</span>
            </div>
            {member.specialty?.length > 0 && (
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--tx-2)', fontSize: 13 }}>Specialties</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {member.specialty.map((s, i) => <span key={i} className="pill pill-gray">{s}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => { onClose(); onEdit(member); }}>
              <Edit2 size={14} style={{ marginRight: 6 }} /> Edit Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MEMBER ACTIONS DROPDOWN
   ══════════════════════════════════════════════════════════════ */
const MemberActions = ({ member, onEdit, onViewProfile, onRemove }) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-ghost btn-sm" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 51,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.3)', minWidth: 160, overflow: 'hidden',
          }}>
            <button className="dropdown-item" onClick={() => { setOpen(false); onViewProfile(member); }}>
              <Eye size={14} /> View Profile
            </button>
            <button className="dropdown-item" onClick={() => { setOpen(false); onEdit(member); }}>
              <Edit2 size={14} /> Edit Member
            </button>
            <button className="dropdown-item" style={{ color: 'var(--red)' }} onClick={() => { setOpen(false); onRemove(member); }}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN TEAM PAGE
   ══════════════════════════════════════════════════════════════ */
const Team = () => {
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [viewMember, setViewMember] = useState(null);

  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getToken();
      if (!token) { setError('Please log in.'); setLoading(false); return; }

      const usersRes = await axios.get(`${API}/users`, { headers: headers() });
      let users = usersRes.data.data || usersRes.data || [];
      if (!Array.isArray(users)) users = [];

      // Fetch tasks for stats
      let taskStats = {};
      try {
        const tasksRes = await axios.get(`${API}/tasks`, { headers: headers() });
        const tasks = tasksRes.data.data || tasksRes.data || [];
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        users.forEach(u => { taskStats[u.id] = { week: 0, month: 0 }; });
        tasks.forEach(t => {
          const aid = t.assignee_id || t.assignedTo?.id;
          if (aid && taskStats[aid]) {
            if (new Date(t.created_at || t.createdAt) >= weekAgo) taskStats[aid].week++;
            if ((t.status === 'completed' || t.status === 'done') && new Date(t.updated_at || t.updatedAt) >= monthStart) taskStats[aid].month++;
          }
        });
      } catch { /* tasks fetch optional */ }

      setTeamMembers(users.map(u => ({
        id: u.id, name: u.name || u.username || 'Unknown',
        email: u.email || '', role: u.role || 'Team Member',
        account_type: u.account_type || '',
        specialty: u.specialty ? (Array.isArray(u.specialty) ? u.specialty : [u.specialty]) : [],
        active: u.active !== false,
        tasksThisWeek: taskStats[u.id]?.week || 0,
        tasksCompletedMonth: taskStats[u.id]?.month || 0,
        maxTasks: u.maxTasks || 15,
        avgDeliveryTime: '—', satisfactionScore: '—',
      })));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load team');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTeamMembers(); }, [fetchTeamMembers]);

  const handleRemove = async (member) => {
    if (!window.confirm(`Remove ${member.name} from the team? This will deactivate their account.`)) return;
    try {
      await axios.patch(`${API}/users/${member.id}`, { active: false }, { headers: headers() });
      toast.success(`${member.name} has been deactivated`);
      fetchTeamMembers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove member');
    }
  };

  /* ── Render ── */
  return (
    <div className="page-content">
      {/* Header */}
      <div className="team-header">
        <div>
          <h1>Team Hub</h1>
          <p className="text-secondary">Manage your team, assign roles, and monitor capacity</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} style={{ marginRight: 6 }} /> Add Member
        </button>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tx-2)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading team...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: 20, background: 'rgba(201,42,62,.1)', borderRadius: 8, color: 'var(--red)', border: '1px solid rgba(201,42,62,.2)' }}>
          <p>{error}</p>
          <button className="btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={fetchTeamMembers}>Retry</button>
        </div>
      )}

      {!loading && !error && teamMembers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--tx-2)' }}>
          <Users size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <h3 style={{ marginBottom: 8 }}>No team members yet</h3>
          <p style={{ marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>Add your first team member to start managing workload, assigning tasks, and tracking capacity.</p>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <UserPlus size={16} style={{ marginRight: 6 }} /> Add Your First Member
          </button>
        </div>
      )}

      {/* Team Grid */}
      {!loading && !error && teamMembers.length > 0 && (
        <>
          <div className="team-grid">
            {teamMembers.map(member => {
              const wp = pct(member.tasksThisWeek, member.maxTasks);
              return (
                <div className="card team-card" key={member.id} style={{ cursor: 'pointer' }} onClick={() => setViewMember(member)}>
                  <div className="team-card-header">
                    <div className="avatar" style={{ backgroundColor: avatarBg(member.id) }}>{initials(member.name)}</div>
                    <div className="team-member-info">
                      <h3 className="team-member-name">{member.name}</h3>
                      <p className="team-member-role">{member.role}</p>
                    </div>
                    <MemberActions member={member} onEdit={setEditMember} onViewProfile={setViewMember} onRemove={handleRemove} />
                  </div>

                  {member.specialty.length > 0 && (
                    <div className="specialties">
                      {member.specialty.map((s, i) => <span key={i} className="pill pill-gray">{s}</span>)}
                    </div>
                  )}

                  <div className="workload-section">
                    <div className="workload-label">
                      <span className="text-secondary">{member.tasksThisWeek} tasks this week</span>
                      <span className="workload-percentage">{wp}%</span>
                    </div>
                    <div className="workload-bar">
                      <div className="workload-fill" style={{ width: `${Math.min(wp, 100)}%`, backgroundColor: pctColor(wp) }} />
                    </div>
                  </div>

                  <div className="stats-grid">
                    {[
                      { icon: <CheckSquare size={16} />, val: member.tasksCompletedMonth, lbl: 'Completed/mo' },
                      { icon: <Clock size={16} />, val: member.avgDeliveryTime, lbl: 'Avg delivery' },
                      { icon: <Star size={16} />, val: member.satisfactionScore, lbl: 'Satisfaction' },
                    ].map(s => (
                      <div className="stat" key={s.lbl}>
                        <div className="stat-icon">{s.icon}</div>
                        <div className="stat-content">
                          <div className="stat-value">{s.val}</div>
                          <div className="stat-label">{s.lbl}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="btn-ghost btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={(e) => { e.stopPropagation(); setViewMember(member); }}>
                    View Profile
                  </button>
                </div>
              );
            })}
          </div>

          {/* Workload Table */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h2>Workload Overview</h2>
              <BarChart2 size={18} style={{ color: 'var(--tx-2)' }} />
            </div>
            <div className="workload-overview-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team Member</th><th>Role</th><th>Tasks This Week</th><th>Capacity</th><th>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map(m => {
                    const wp = pct(m.tasksThisWeek, m.maxTasks);
                    return (
                      <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => setViewMember(m)}>
                        <td>
                          <div className="table-member-info">
                            <div className="small-avatar" style={{ backgroundColor: avatarBg(m.id) }}>{initials(m.name)}</div>
                            <span className="font-medium">{m.name}</span>
                          </div>
                        </td>
                        <td className="text-secondary">{m.role}</td>
                        <td className="text-center">{m.tasksThisWeek} / {m.maxTasks}</td>
                        <td>
                          <div className="mini-workload-bar">
                            <div className="mini-workload-fill" style={{ width: `${Math.min(wp, 100)}%`, backgroundColor: pctColor(wp) }} />
                          </div>
                        </td>
                        <td className="text-right"><span style={{ color: pctColor(wp), fontWeight: 500 }}>{wp}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="capacity-summary">
              {[
                { color: 'var(--green)', label: 'under 50% capacity', count: teamMembers.filter(m => pct(m.tasksThisWeek, m.maxTasks) < 50).length },
                { color: 'var(--yellow)', label: 'at 50-80% capacity', count: teamMembers.filter(m => { const p = pct(m.tasksThisWeek, m.maxTasks); return p >= 50 && p < 80; }).length },
                { color: 'var(--red)', label: 'over 80% capacity', count: teamMembers.filter(m => pct(m.tasksThisWeek, m.maxTasks) >= 80).length },
              ].map(c => (
                <div className="capacity-item" key={c.label}>
                  <div className="capacity-dot" style={{ backgroundColor: c.color }} />
                  <span><strong>{c.count}</strong> members {c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddMemberModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreated={fetchTeamMembers} />
      <EditMemberModal member={editMember} open={!!editMember} onClose={() => setEditMember(null)} onUpdated={fetchTeamMembers} />
      <MemberDetailPanel member={viewMember} open={!!viewMember} onClose={() => setViewMember(null)} onEdit={setEditMember} />
    </div>
  );
};

export default Team;
